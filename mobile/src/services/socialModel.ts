export type SavedPiece = { artworkId: string; tagId: string };
export type GraffitiCollection = { id: string; name: string; artworkIds: string[] };
export type SocialData = {
  liked: string[];
  counts: Record<string, number>;
  pieces: SavedPiece[];
  collections: GraffitiCollection[];
};
export type SocialAction = {
  kind: 'like' | 'save' | 'membership' | 'create' | 'rename' | 'delete';
  artworkId?: string;
  tagId?: string;
  collectionId?: string;
  name?: string;
  enabled?: boolean;
};
export const emptySocial = (): SocialData => ({ liked: [], counts: {}, pieces: [], collections: [] });
export function collectionName(value = '') {
  const name = value.trim();
  if (!name || name.length > 60) throw new Error('Use a collection name between 1 and 60 characters.');
  return name;
}
// Pure transitions keep local storage and community behavior consistent.
export function changeSocial(current: SocialData, action: SocialAction): SocialData {
  const next: SocialData = JSON.parse(JSON.stringify(current));
  const { kind, artworkId = '', tagId = '', collectionId = '', enabled } = action;
  const collection = next.collections.find((c) => c.id === collectionId);
  if (kind === 'create' || kind === 'rename') {
    const name = collectionName(action.name);
    if (next.collections.some((c) => c.id !== collectionId && c.name.toLowerCase() === name.toLowerCase()))
      throw new Error('You already have a collection with this name.');
    if (kind === 'create') next.collections.push({ id: collectionId, name, artworkIds: [] });
    else if (collection) collection.name = name;
    else throw new Error('This collection no longer exists.');
  } else if (kind === 'delete') {
    next.collections = next.collections.filter((c) => c.id !== collectionId);
  } else if (kind === 'like') {
    const wasLiked = next.liked.includes(artworkId);
    next.liked = next.liked.filter((id) => id !== artworkId);
    if (enabled) next.liked.push(artworkId);
    next.counts[artworkId] = Math.max(0, (next.counts[artworkId] || 0) + Number(!!enabled) - Number(wasLiked));
  } else if (kind === 'save' || kind === 'membership') {
    if (kind === 'membership' && !collection) throw new Error('This collection no longer exists.');
    if (enabled && !next.pieces.some((p) => p.artworkId === artworkId)) next.pieces.push({ artworkId, tagId });
    if (kind === 'membership' && collection) {
      collection.artworkIds = collection.artworkIds.filter((id) => id !== artworkId);
      if (enabled) collection.artworkIds.push(artworkId);
    }
    if (kind === 'save' && !enabled) {
      next.pieces = next.pieces.filter((p) => p.artworkId !== artworkId);
      next.collections.forEach((c) => { c.artworkIds = c.artworkIds.filter((id) => id !== artworkId); });
    }
  }
  return next;
}

export function validateSocialBackup(value: unknown, owners: Map<string, string>): asserts value is SocialData {
  const data = value as SocialData;
  const invalid = () => { throw new Error('Backup contains invalid likes or collections.'); };
  if (!data || typeof data !== 'object' || !Array.isArray(data.liked) || !Array.isArray(data.pieces) || !Array.isArray(data.collections)) return invalid();
  if (new Set(data.liked).size !== data.liked.length || data.liked.some((id) => !owners.has(id))) return invalid();
  const saved = new Set<string>();
  for (const piece of data.pieces) {
    if (!piece || !owners.has(piece.artworkId) || owners.get(piece.artworkId) !== piece.tagId || saved.has(piece.artworkId)) return invalid();
    saved.add(piece.artworkId);
  }
  const ids = new Set<string>(), names = new Set<string>();
  for (const c of data.collections) {
    if (!c || typeof c.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(c.id) || ids.has(c.id) || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 60 || names.has(c.name.trim().toLowerCase()) || !Array.isArray(c.artworkIds) || new Set(c.artworkIds).size !== c.artworkIds.length || c.artworkIds.some((id) => !saved.has(id))) return invalid();
    ids.add(c.id); names.add(c.name.trim().toLowerCase());
  }
}

// Import new records without overwriting preferences for walls already on this device.
export function mergeSocialBackup(current: SocialData, incoming: SocialData, newArtworkIds: Set<string>): SocialData {
  const next: SocialData = JSON.parse(JSON.stringify(current));
  for (const id of incoming.liked.filter((id) => newArtworkIds.has(id))) {
    if (!next.liked.includes(id)) next.liked.push(id);
  }
  next.counts = Object.fromEntries(next.liked.map((id) => [id, 1]));
  for (const piece of incoming.pieces.filter((p) => newArtworkIds.has(p.artworkId))) {
    if (!next.pieces.some((p) => p.artworkId === piece.artworkId)) next.pieces.push({ ...piece });
  }
  for (const c of incoming.collections) {
    const artworkIds = c.artworkIds.filter((id) => newArtworkIds.has(id));
    let target = next.collections.find((existing) => existing.id === c.id || existing.name.toLowerCase() === c.name.toLowerCase());
    if (!target) {
      target = { id: c.id, name: c.name, artworkIds: [] };
      next.collections.push(target);
    }
    target.artworkIds = [...new Set([...target.artworkIds, ...artworkIds])];
  }
  return next;
}
