import { validateSocialBackup, type SocialData } from './socialModel';
import type { ArtType, Condition, Precision, Report, Revision, Tag } from '../types';

export const BACKUP_FORMAT = 'graffiti-tag-personal-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export type BackupMediaEntry = {
  extension: string;
  mimeType: string;
  originalBase64: string;
  previewBase64: string;
};
export type PersonalBackup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  archive: { tags: Tag[]; revisions: Revision[]; reports: Report[] };
  savedIds: string[];
  social?: SocialData;
  media: Record<string, BackupMediaEntry>;
};

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const artTypes = new Set<ArtType>(['Piece', 'Mural', 'Lettering', 'Stencil', 'Other']);
const precisions = new Set<Precision>(['exact', 'year', 'approximate', 'unknown']);
const conditions = new Set<Condition>(['present', 'faded', 'covered', 'gone']);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isId(value: unknown): value is string {
  return typeof value === 'string' && idPattern.test(value);
}
function isDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}
function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function isSnapshot(value: unknown): boolean {
  if (!record(value)) return false;
  if (
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    !Number.isFinite(value.latitude) ||
    !Number.isFinite(value.longitude) ||
    Math.abs(value.latitude as number) > 90 ||
    Math.abs(value.longitude as number) > 180
  )
    return false;
  if (value.record === undefined) return true;
  const detail = value.record;
  return (
    record(detail) &&
    isId(detail.photoId) &&
    typeof detail.artworkTitle === 'string' &&
    typeof detail.artist === 'string' &&
    artTypes.has(detail.kind as ArtType) &&
    validPhotoDate(detail) &&
    conditions.has(detail.condition as Condition) &&
    typeof detail.caption === 'string' &&
    typeof detail.photographer === 'string'
  );
}
function validPhotoDate(value: Record<string, unknown>): boolean {
  const { precision, year, takenOn } = value;
  if (!precisions.has(precision as Precision)) return false;
  if (precision === 'unknown') return year === null && takenOn === null;
  if (
    !Number.isInteger(year) ||
    (year as number) < 1826 ||
    (year as number) > new Date().getFullYear()
  )
    return false;
  if (precision === 'exact') {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return isDate(takenOn) && +takenOn.slice(0, 4) === year && takenOn <= today;
  }
  return takenOn === null;
}
function validTag(value: unknown): value is Tag {
  if (
    !record(value) ||
    !isId(value.id) ||
    typeof value.title !== 'string' ||
    value.title.length < 3 ||
    value.title.length > 100 ||
    typeof value.description !== 'string' ||
    value.description.length > 2000 ||
    !Number.isFinite(value.latitude) ||
    !Number.isFinite(value.longitude) ||
    Math.abs(value.latitude as number) > 90 ||
    Math.abs(value.longitude as number) > 180 ||
    !Number.isInteger(value.revision) ||
    (value.revision as number) < 1 ||
    !isDateTime(value.createdAt) ||
    !Array.isArray(value.artworks) ||
    !Array.isArray(value.photos) ||
    value.photos.length === 0 ||
    (value.demo !== undefined && value.demo !== false)
  )
    return false;
  const artworkIds = new Set<string>();
  for (const artwork of value.artworks) {
    if (
      !record(artwork) ||
      !isId(artwork.id) ||
      artworkIds.has(artwork.id) ||
      typeof artwork.title !== 'string' ||
      artwork.title.length < 2 ||
      artwork.title.length > 100 ||
      typeof artwork.artist !== 'string' ||
      artwork.artist.length > 100 ||
      !artTypes.has(artwork.kind as ArtType)
    )
      return false;
    artworkIds.add(artwork.id);
  }
  const photoIds = new Set<string>();
  for (const photo of value.photos) {
    if (
      !record(photo) ||
      !isId(photo.id) ||
      photoIds.has(photo.id) ||
      !artworkIds.has(photo.artworkId as string) ||
      photo.uri !== `idb:${photo.id}` ||
      !isDateTime(photo.uploadedAt) ||
      !validPhotoDate(photo) ||
      !conditions.has(photo.condition as Condition) ||
      typeof photo.caption !== 'string' ||
      photo.caption.length > 2000 ||
      typeof photo.photographer !== 'string' ||
      photo.photographer.length === 0 ||
      photo.photographer.length > 100 ||
      typeof photo.contributor !== 'string'
    )
      return false;
    if (
      (photo.originalPath !== undefined && typeof photo.originalPath !== 'string') ||
      (photo.previewPath !== undefined && typeof photo.previewPath !== 'string') ||
      (photo.sourceUrl !== undefined && typeof photo.sourceUrl !== 'string') ||
      (photo.license !== undefined && typeof photo.license !== 'string')
    )
      return false;
    photoIds.add(photo.id);
  }
  return true;
}
function validRevision(
  value: unknown,
  tagIds: Set<string>,
  photoOwners: Map<string, string>,
): value is Revision {
  if (
    !record(value) ||
    !isId(value.id) ||
    !isId(value.tagId) ||
    !tagIds.has(value.tagId) ||
    typeof value.actor !== 'string' ||
    typeof value.action !== 'string' ||
    !isDateTime(value.createdAt) ||
    !Number.isInteger(value.version) ||
    (value.version as number) < 1 ||
    !(value.before === null || isSnapshot(value.before)) ||
    !isSnapshot(value.after)
  )
    return false;
  for (const snapshot of [value.before, value.after]) {
    if (
      record(snapshot) &&
      record(snapshot.record) &&
      photoOwners.get(snapshot.record.photoId as string) !== value.tagId
    )
      return false;
  }
  return true;
}
function validReport(value: unknown, tagIds: Set<string>): value is Report {
  return (
    record(value) &&
    isId(value.id) &&
    isId(value.tagId) &&
    tagIds.has(value.tagId) &&
    typeof value.reason === 'string' &&
    value.reason.trim().length >= 8 &&
    isDateTime(value.createdAt) &&
    (value.status === 'open' || value.status === 'resolved') &&
    typeof value.reporter === 'string'
  );
}
function decodeBase64(value: unknown, label: string): ArrayBuffer {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new Error(`Backup contains invalid ${label} image data.`);
  }
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new Error(`Backup contains invalid ${label} image data.`);
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function decodeBackupBase64(value: unknown, label: string): ArrayBuffer {
  return decodeBase64(value, label);
}

export function validatePersonalBackup(value: unknown): PersonalBackup {
  if (
    !record(value) ||
    value.format !== BACKUP_FORMAT ||
    value.version !== BACKUP_VERSION ||
    !isDateTime(value.createdAt) ||
    !record(value.archive) ||
    !Array.isArray(value.archive.tags) ||
    !Array.isArray(value.archive.revisions) ||
    !Array.isArray(value.archive.reports) ||
    !Array.isArray(value.savedIds) ||
    !value.savedIds.every(isId) ||
    !record(value.media)
  ) {
    throw new Error('This file is not a supported personal archive backup.');
  }
  const tags = value.archive.tags;
  const tagIds = new Set<string>();
  const photoOwners = new Map<string, string>();
  for (const tag of tags) {
    if (!validTag(tag) || tagIds.has(tag.id)) throw new Error('Backup contains an invalid tag record.');
    tagIds.add(tag.id);
    for (const photo of tag.photos) {
      if (photoOwners.has(photo.id)) throw new Error('Backup contains duplicate photo IDs.');
      photoOwners.set(photo.id, tag.id);
    }
  }
  if (!value.archive.revisions.every((item) => validRevision(item, tagIds, photoOwners))) {
    throw new Error('Backup contains an invalid revision or tag reference.');
  }
  if (!value.archive.reports.every((item) => validReport(item, tagIds))) {
    throw new Error('Backup contains an invalid report or tag reference.');
  }
  if (!value.savedIds.every((id) => isId(id) && tagIds.has(id))) {
    throw new Error('Backup contains a saved-tag reference that does not exist.');
  }

  if (value.social !== undefined) {
    const owners = new Map(tags.flatMap((tag) => (tag as Tag).artworks.map((a) => [a.id, (tag as Tag).id] as [string, string])));
    validateSocialBackup(value.social, owners);
    // Local counts are derived from likes, never trusted from an imported file.
    value.social.counts = Object.fromEntries(value.social.liked.map((id) => [id, 1]));
  }
  const mediaIds = Object.keys(value.media);
  if (
    mediaIds.length !== photoOwners.size ||
    mediaIds.some((id) => !photoOwners.has(id) || !isId(id))
  ) {
    throw new Error('Backup is missing image files or contains unlinked image files.');
  }
  for (const id of mediaIds) {
    const entry = value.media[id];
    if (
      !record(entry) ||
      typeof entry.extension !== 'string' ||
      !/^(jpg|jpeg|png|webp|heic|heif)$/i.test(entry.extension) ||
      typeof entry.mimeType !== 'string' ||
      !/^image\/(jpeg|png|webp|heic|heif)$/.test(entry.mimeType) ||
      !mimeMatchesExtension(entry.mimeType, entry.extension)
    ) {
      throw new Error(`Backup contains invalid image metadata for ${id}.`);
    }
    // Decode every file before any IndexedDB or archive write can occur.
    decodeBase64(entry.originalBase64, 'original');
    decodeBase64(entry.previewBase64, 'preview');
  }
  return value as PersonalBackup;
}

function mimeMatchesExtension(mimeType: string, extension: string): boolean {
  const expected: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  return expected[extension.toLowerCase()] === mimeType;
}
