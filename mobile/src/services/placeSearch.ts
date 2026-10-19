import type { Point } from '../types';

const cache = new Map<string, Point>();
const pending = new Map<string, Promise<Point>>();
const unavailable = 'Place search is unavailable. Check your internet connection and try again.';

// Only called on explicit submission, never while typing. Photon uses OSM data;
// attribution is displayed on the map. Successful searches are cached per session.
export async function findOpenPlace(query: string): Promise<Point> {
  const normalized = query.trim();
  if (!normalized) throw new Error('Enter a city or address to search.');
  const key = normalized.toLocaleLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const existing = pending.get(key);
  if (existing) return existing;

  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const endpoint = process.env.EXPO_PUBLIC_PHOTON_URL || 'https://photon.komoot.io/api/';
      const url = new URL(endpoint);
      url.searchParams.set('q', normalized);
      url.searchParams.set('limit', '1');
      let response: Response;
      try {
        response = await fetch(url.toString(), { signal: controller.signal });
      } catch {
        throw new Error(controller.signal.aborted
          ? 'Place search took too long. Please try again.' : unavailable);
      }
      if (!response.ok) throw new Error(unavailable);
      let data;
      try { data = await response.json(); } catch { throw new Error(unavailable); }
      if (!Array.isArray(data?.features)) throw new Error(unavailable);
      if (!data.features.length) throw new Error('No place found. Try a city and country.');
      const coordinates = data.features[0]?.geometry?.coordinates;
      if (!Array.isArray(coordinates)) throw new Error(unavailable);
      const [longitude, latitude] = coordinates;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error(unavailable);
      const point = { latitude, longitude };
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, point);
      return point;
    } finally {
      clearTimeout(timer);
    }
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}
