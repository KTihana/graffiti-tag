import type { Contribution, Photo, Point, Tag, TagFields, Viewport } from './types';

export function dateLabel(p: Pick<Photo, 'precision' | 'year' | 'takenOn'>): string {
  if (p.precision === 'unknown' || p.year === null) return 'Date unknown';
  if (p.precision === 'approximate') return `c. ${p.year}`;
  if (p.precision === 'exact' && p.takenOn)
    return new Date(`${p.takenOn}T12:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  return String(p.year);
}
export function orderedPhotos(photos: Photo[]): Photo[] {
  return [...photos].sort(
    (a, b) =>
      (b.year ?? -1) - (a.year ?? -1) ||
      (b.takenOn ?? '').localeCompare(a.takenOn ?? '') ||
      b.uploadedAt.localeCompare(a.uploadedAt),
  );
}
export function coverPhoto(tag: Tag): Photo | undefined {
  return orderedPhotos(tag.photos)[0];
}
export function fields(tag: Tag): TagFields {
  const { title, description, latitude, longitude } = tag;
  return { title, description, latitude, longitude };
}
export function validPoint(p: Point): boolean {
  return (
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  );
}
export function validateFields(f: TagFields): string | null {
  if (f.title.trim().length < 3 || f.title.length > 100)
    return 'Give this wall a name between 3 and 100 characters.';
  if (f.description.length > 2000) return 'Keep the wall description under 2,000 characters.';
  if (!validPoint(f)) return 'Choose a valid location for the wall.';
  return null;
}
export function validateContribution(c: Contribution, today = new Date()): string | null {
  if (!c.imageUri) return 'Choose a photograph first.';
  if (!c.rightsConfirmed) return 'Confirm that you can share this photograph.';
  if (!validPoint(c.point)) return 'Choose a valid location for the wall.';
  if (!c.tagId) {
    const error = validateFields({ title: c.title, description: c.description, ...c.point });
    if (error) return error;
  }
  if (!c.artworkId && (c.artworkTitle.trim().length < 2 || c.artworkTitle.length > 100))
    return 'Give the artwork a short name, or use “Untitled”.';
  if (c.artist.length > 100 || c.photographer.length > 100 || c.caption.length > 2000)
    return 'Shorten the artist, photographer, or caption.';
  if (c.precision !== 'unknown') {
    if (!/^\d{4}$/.test(c.year) || +c.year < 1826 || +c.year > today.getFullYear())
      return 'Enter a photo year between 1826 and this year, or select Unknown.';
    if (c.precision === 'exact') {
      const date = new Date(`${c.takenOn}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(c.takenOn) ||
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== c.takenOn ||
        date.getUTCFullYear() !== +c.year ||
        c.takenOn >
          `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      )
        return 'Enter a real photo date in YYYY-MM-DD format, no later than today.';
    }
  }
  return null;
}
export function distanceMeters(a: Point, b: Point): number {
  const r = Math.PI / 180,
    dLat = (b.latitude - a.latitude) * r,
    dLon = (b.longitude - a.longitude) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function inViewport(tag: Point, v: Viewport): boolean {
  const dLon = Math.abs(((tag.longitude - v.longitude + 540) % 360) - 180);
  return (
    Math.abs(tag.latitude - v.latitude) <= v.latitudeDelta / 2 &&
    dLon <= Math.min(180, v.longitudeDelta / 2)
  );
}
export function matches(tag: Tag, query: string, kind: string, year: string): boolean {
  const searchable = [
    tag.title,
    tag.description,
    ...tag.artworks.flatMap((a) => [a.title, a.artist]),
  ]
    .join(' ')
    .toLowerCase();
  if (query && !searchable.includes(query.toLowerCase())) return false;
  const artworks = kind === 'All' ? tag.artworks : tag.artworks.filter((a) => a.kind === kind);
  if (kind !== 'All' && !artworks.length) return false;
  return tag.photos.some(
    (p) =>
      (kind === 'All' || artworks.some((a) => a.id === p.artworkId)) &&
      (!year || p.year === Number(year)),
  );
}
