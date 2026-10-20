import { artworkKinds } from '../categories';
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { fields, inViewport, validateContribution, validateFields } from '../domain';
import type {
  Contribution,
  Photo,
  RecordDetails,
  Report,
  Revision,
  Tag,
  TagFields,
  Viewport,
} from '../types';
import { readBytes, saveLocalMedia } from './media';
import { loadLocalArchive, saveLocalArchive } from './localArchive';
import { isDemo, supabase } from './supabase';

function hydrate(tag: Tag): Tag {
  return {
    ...tag,
    photos: tag.photos.map((p) => ({
      ...p,
      uri: p.previewPath
        ? supabase!.storage.from('previews').getPublicUrl(p.previewPath).data.publicUrl
        : p.uri,
    })),
  };
}
function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listTags(view?: Viewport, query = ''): Promise<Tag[]> {
  if (isDemo) return (await loadLocalArchive()).tags.filter((t) => query || !view || inViewport(t, view));
  const { data, error } = await supabase!.rpc('browse_tags', {
    center_lat: view?.latitude ?? 0,
    center_lng: view?.longitude ?? 0,
    lat_span: view?.latitudeDelta ?? 180,
    lng_span: view?.longitudeDelta ?? 360,
    search_text: query,
  });
  fail(error);
  return (data as Tag[]).map(hydrate);
}
export async function getTag(id: string): Promise<Tag | null> {
  if (isDemo) return (await loadLocalArchive()).tags.find((t) => t.id === id) ?? null;
  const { data, error } = await supabase!.rpc('read_tag', { tag_id: id });
  fail(error);
  return data ? hydrate(data as Tag) : null;
}
export async function contribute(c: Contribution, actor: string): Promise<string> {
  const error = validateContribution(c);
  if (error) throw new Error(error);
  const id = c.submissionId || Crypto.randomUUID();
  const original = await readBytes(c.imageUri);
  if (original.byteLength > 30 * 1024 * 1024)
    throw new Error('Choose a photograph smaller than 30 MB.');
  const context = ImageManipulator.manipulate(c.imageUri);
  context.resize({ width: 1400 });
  const image = await context.renderAsync();
  const reduced = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
  const preview = await readBytes(reduced.uri);
  const extension = (
    {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'image/heif': 'heif',
    } as Record<string, string>
  )[c.mimeType];
  if (!extension) throw new Error('Please choose a JPEG, PNG, WebP, or HEIC photograph.');
  const uploadedAt = new Date().toISOString();
  const photo: Photo = {
    id,
    artworkId: c.artworkId || Crypto.randomUUID(),
    uri: '',
    year: c.precision === 'unknown' ? null : +c.year,
    takenOn: c.precision === 'exact' ? c.takenOn : null,
    precision: c.precision,
    condition: c.condition,
    caption: c.caption.trim(),
    photographer: c.photographer.trim() || actor,
    contributor: actor,
    uploadedAt,
  };
  const artwork = {
    id: photo.artworkId,
    title: c.artworkTitle.trim(),
    artist: c.artist.trim() || 'Unknown artist',
    kind: c.kind,
    kinds: artworkKinds(c),
  };
  if (isDemo) {
    const data = await loadLocalArchive();
    const committed = data.tags.find((t) => t.photos.some((p) => p.id === id));
    if (committed) return committed.id;
    let tag = c.tagId ? data.tags.find((t) => t.id === c.tagId) : undefined;
    if (c.tagId && !tag) throw new Error('This tag no longer exists. Refresh and try again.');
    photo.uri = await saveLocalMedia(id, original, preview, extension);
    if (!tag) {
      tag = {
        id: Crypto.randomUUID(),
        title: c.title.trim(),
        description: c.description.trim(),
        ...c.point,
        artworks: [],
        photos: [],
        revision: 1,
        createdAt: uploadedAt,
      };
      data.tags.push(tag);
    }
    if (c.artworkId && !tag.artworks.some((a) => a.id === c.artworkId))
      throw new Error('Choose an artwork from this wall.');
    if (!c.artworkId) tag.artworks.push(artwork);
    tag.photos.push(photo);
    data.revisions.push({
      id: Crypto.randomUUID(),
      tagId: tag.id,
      actor,
      action: 'Added a photograph',
      createdAt: uploadedAt,
      before: null,
      after: fields(tag),
      version: tag.revision,
    });
    await saveLocalArchive(data);
    return tag.id;
  }
  const { data: auth } = await supabase!.auth.getUser();
  if (!auth.user) throw new Error('Sign in to contribute to the public archive.');
  const originalPath = `${auth.user.id}/${id}.${extension}`,
    previewPath = `${auth.user.id}/${id}.jpg`;
  for (const [bucket, path, bytes, contentType] of [
    ['originals', originalPath, original, c.mimeType],
    ['previews', previewPath, preview, 'image/jpeg'],
  ] as const) {
    const { error: uploadError } = await supabase!.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: false });
    // Retrying the same submission reuses immutable object paths; the RPC is idempotent.
    if (uploadError && !('status' in uploadError && uploadError.status === 409)) throw uploadError;
  }
  const { data, error: rpcError } = await supabase!.rpc('add_contribution', {
    payload: {
      tagId: c.tagId ?? null,
      artworkId: c.artworkId ?? null,
      wall: { title: c.title.trim(), description: c.description.trim(), ...c.point },
      artwork,
      photo: { ...photo, originalPath, previewPath },
      rightsConfirmed: c.rightsConfirmed,
    },
  });
  fail(rpcError);
  return data as string;
}
export async function editTag(
  tag: Tag,
  update: TagFields,
  reason: string,
  actor: string,
): Promise<void> {
  const error = validateFields(update);
  if (error) throw new Error(error);
  if (reason.trim().length < 5)
    throw new Error('Briefly explain this change (at least 5 characters).');
  if (isDemo) {
    const data = await loadLocalArchive(),
      old = data.tags.find((t) => t.id === tag.id);
    if (!old || old.revision !== tag.revision)
      throw new Error('This tag changed. Refresh it before editing.');
    data.revisions.push({
      id: Crypto.randomUUID(),
      tagId: tag.id,
      actor,
      action: reason.trim(),
      before: fields(old),
      after: update,
      version: old.revision + 1,
      createdAt: new Date().toISOString(),
    });
    Object.assign(old, update, { revision: old.revision + 1 });
    await saveLocalArchive(data);
    return;
  }
  const { error: e } = await supabase!.rpc('edit_tag', {
    tag_id: tag.id,
    expected_revision: tag.revision,
    changes: update,
    reason,
  });
  fail(e);
}
export async function history(tagId: string): Promise<Revision[]> {
  if (isDemo) return (await loadLocalArchive()).revisions.filter((r) => r.tagId === tagId).reverse();
  const { data, error } = await supabase!
    .from('revisions')
    .select('*')
    .eq('tag_id', tagId)
    .order('created_at', { ascending: false });
  fail(error);
  return data!.map((r) => ({
    id: r.id,
    tagId: r.tag_id,
    actor: r.actor,
    action: r.action,
    createdAt: r.created_at,
    before: r.before,
    after: r.after,
    version: r.version,
  }));
}
export function recordDetails(tag: Tag, photoId: string): RecordDetails {
  const p = tag.photos.find((x) => x.id === photoId);
  const a = tag.artworks.find((x) => x.id === p?.artworkId);
  if (!p || !a) throw new Error('This photograph could not be found.');
  return {
    photoId,
    artworkTitle: a.title,
    artist: a.artist,
    kind: a.kind,
    kinds: artworkKinds(a),
    year: p.year,
    takenOn: p.takenOn,
    precision: p.precision,
    condition: p.condition,
    caption: p.caption,
    photographer: p.photographer,
  };
}
export async function editRecord(
  tag: Tag,
  changes: RecordDetails,
  reason: string,
  actor: string,
): Promise<void> {
  const error = validateContribution({
    tagId: tag.id,
    title: tag.title,
    description: tag.description,
    point: tag,
    imageUri: 'existing',
    mimeType: 'image/jpeg',
    rightsConfirmed: true,
    artworkTitle: changes.artworkTitle,
    artist: changes.artist,
    kind: changes.kind,
    kinds: artworkKinds(changes),
    year: changes.year === null ? '' : String(changes.year),
    takenOn: changes.takenOn || '',
    precision: changes.precision,
    condition: changes.condition,
    caption: changes.caption,
    photographer: changes.photographer,
  });
  if (error) throw new Error(error);
  if (reason.trim().length < 5) throw new Error('Briefly explain this correction.');
  if (!changes.photographer.trim()) throw new Error('Credit the photographer, or enter Unknown.');
  if (isDemo) {
    const data = await loadLocalArchive(),
      wall = data.tags.find((x) => x.id === tag.id);
    if (!wall || wall.revision !== tag.revision)
      throw new Error('This tag changed. Refresh it before editing.');
    const before = recordDetails(wall, changes.photoId),
      p = wall.photos.find((x) => x.id === changes.photoId)!,
      a = wall.artworks.find((x) => x.id === p.artworkId)!;
    Object.assign(a, {
      title: changes.artworkTitle,
      artist: changes.artist || 'Unknown artist',
      kind: changes.kind,
      kinds: artworkKinds(changes),
    });
    Object.assign(p, {
      year: changes.year,
      takenOn: changes.takenOn,
      precision: changes.precision,
      condition: changes.condition,
      caption: changes.caption,
      photographer: changes.photographer,
    });
    wall.revision++;
    data.revisions.push({
      id: Crypto.randomUUID(),
      tagId: tag.id,
      actor,
      action: reason,
      createdAt: new Date().toISOString(),
      version: wall.revision,
      before: { ...fields(wall), record: before },
      after: { ...fields(wall), record: changes },
    });
    await saveLocalArchive(data);
    return;
  }
  fail(
    (
      await supabase!.rpc('edit_record', {
        tag_id: tag.id,
        photo_id: changes.photoId,
        expected_revision: tag.revision,
        changes,
        reason,
      })
    ).error,
  );
}
export async function reportTag(tagId: string, reason: string, actor: string): Promise<void> {
  if (reason.trim().length < 8)
    throw new Error('Add a little more detail (at least 8 characters).');
  if (isDemo) {
    const data = await loadLocalArchive();
    data.reports.push({
      id: Crypto.randomUUID(),
      tagId,
      reason,
      reporter: actor,
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    await saveLocalArchive(data);
    return;
  }
  fail((await supabase!.from('reports').insert({ tag_id: tagId, reason: reason.trim() })).error);
}
export async function listReports(): Promise<Report[]> {
  if (isDemo) return (await loadLocalArchive()).reports.filter((r) => r.status === 'open');
  const { data, error } = await supabase!
    .from('reports')
    .select('*')
    .eq('status', 'open')
    .order('created_at');
  fail(error);
  return data!.map((r) => ({
    id: r.id,
    tagId: r.tag_id,
    reason: r.reason,
    createdAt: r.created_at,
    reporter: r.reporter,
    status: r.status,
  }));
}
export async function resolveReport(id: string): Promise<void> {
  if (isDemo) {
    const data = await loadLocalArchive();
    const report = data.reports.find((r) => r.id === id);
    if (report) report.status = 'resolved';
    await saveLocalArchive(data);
    return;
  }
  fail((await supabase!.rpc('resolve_report', { report_id: id })).error);
}
