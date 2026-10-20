import type { ArtType } from './types';

export const ART_TYPES: readonly ArtType[] = ['Piece', 'Mural', 'Lettering', 'Stencil', 'Other'];
// Older archives and backups store only kind. Keep it as the first category for
// compatibility, while new records preserve every selected category in kinds.
export function artworkKinds(artwork: { kind: ArtType; kinds?: ArtType[] }): ArtType[] {
  return artwork.kinds ?? [artwork.kind];
}
export function validArtworkKinds(value: { kind?: unknown; kinds?: unknown }): boolean {
  if (!ART_TYPES.includes(value.kind as ArtType)) return false;
  if (value.kinds === undefined) return true;
  return Array.isArray(value.kinds) && value.kinds.length > 0 && value.kinds.length <= ART_TYPES.length &&
    new Set(value.kinds).size === value.kinds.length && value.kinds[0] === value.kind &&
    value.kinds.every((kind) => ART_TYPES.includes(kind));
}
export function toggleArtworkKind(artwork: { kind: ArtType; kinds?: ArtType[] }, kind: ArtType) {
  const current = artworkKinds(artwork);
  const kinds = current.includes(kind) ? current.filter((value) => value !== kind) : [...current, kind];
  return { kinds, kind: kinds[0] ?? artwork.kind };
}
