import type { Point, Viewport } from '../types';
import { getNativeBridge } from './nativeBridge';

export type PlaceResult = Point & {
  id: string;
  title: string;
  address: string;
  kind: string;
  houseNumber?: string;
  viewport: Viewport;
};
const cache = new Map<string, PlaceResult[]>();
const pending = new Map<string, Promise<PlaceResult[]>>();
const unavailable = 'Place search is unavailable. Check your internet connection and try again.';
export const PLACE_SEARCH_TIMEOUT = 30000;

// Recognize street-number-town input for Photon's structured address endpoint.
// Free-form lookup can ignore the house number and return a distant road segment.
export function normalizePlaceQuery(query: string): string {
  const value = query.trim().replace(/\s+/g, ' ');
  if (value.includes(',')) return value;
  const address = value.match(/^(.+?\s+\d+[\p{L}]?(?:[/-]\d+)?)\s+([^\d].+)$/u);
  return address ? `${address[1]}, ${address[2]}` : value;
}

export function coordinatePlace(query: string): PlaceResult | null {
  const match = query.match(/^\s*([+-]?\d{1,3}(?:\.\d+)?)\s*[,;]\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const latitude = Number(match[1]), longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Coordinates must be latitude −90 to 90 and longitude −180 to 180.');
  const point = { latitude, longitude };
  return { ...point, id: `coordinates:${latitude},${longitude}`, title: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, address: 'Coordinates', kind: 'coordinates', viewport: { ...point, latitudeDelta: 0.004, longitudeDelta: 0.004 } };
}

export function parsePlaces(data: unknown, query: string): PlaceResult[] {
  const features = (data as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) throw new Error(unavailable);
  const results: PlaceResult[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const f = feature as { geometry?: { coordinates?: unknown[] }; properties?: Record<string, unknown> } | null;
    const [longitude, latitude] = f?.geometry?.coordinates || [];
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    const p = f?.properties || {};
    const text = (key: string) => typeof p[key] === 'string' ? (p[key] as string).trim() : '';
    const street = [text('street'), text('housenumber')].filter(Boolean).join(' ');
    const title = text('name') || street || query;
    const address = [...new Set([street, text('district'), text('city'), text('county'), text('state'), text('country')].filter((part) => part && part !== title))].join(', ');
    const kind = text('osm_value') || text('type') || 'place';
    const city = ['city', 'town', 'village', 'municipality', 'county', 'state', 'country'].some((value) => value === kind || value === text('type'));
    const delta = city ? 0.08 : kind === 'street' || text('type') === 'street' ? 0.012 : 0.004;
    const viewport: Viewport = { latitude, longitude, latitudeDelta: delta, longitudeDelta: delta };
    // Photon extent is west, north, east, south. Fit the place rather than using
    // a city-sized zoom for individual buildings and streets.
    const extent = p.extent;
    if (Array.isArray(extent) && extent.length === 4 && extent.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      const [west, north, east, south] = extent as number[];
      if (west >= -180 && east <= 180 && south >= -90 && north <= 90 && east > west && north > south) {
        viewport.latitude = (north + south) / 2;
        viewport.longitude = (east + west) / 2;
        viewport.latitudeDelta = Math.max(0.002, Math.min(170, (north - south) * 1.2));
        viewport.longitudeDelta = Math.max(0.002, Math.min(350, (east - west) * 1.2));
      }
    }
    const unique = `${title}|${address}|${latitude.toFixed(4)}|${longitude.toFixed(4)}`;
    if (seen.has(unique)) continue;
    seen.add(unique);
    results.push({ latitude, longitude, id: `${p.osm_type || ''}${p.osm_id || unique}`, title, address, kind, houseNumber: text('housenumber') || undefined, viewport });
  }
  if (features.length && !results.length) throw new Error(unavailable);
  return results.slice(0, 5);
}

// Submit-only lookup: no network requests while typing. Successful queries and
// simultaneous duplicates are cached; location permission is never required.
export async function searchOpenPlaces(query: string): Promise<PlaceResult[]> {
  const normalized = query.trim();
  if (!normalized) throw new Error('Enter a town, address, place, or coordinates.');
  const coordinate = coordinatePlace(normalized);
  if (coordinate) return [coordinate];
  const key = normalized.toLocaleLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PLACE_SEARCH_TIMEOUT);
    try {
      const endpoint = process.env.EXPO_PUBLIC_PHOTON_URL || 'https://photon.komoot.io/api/';
      const url = new URL(endpoint);
      const normalizedQuery = normalizePlaceQuery(normalized);
      const address = normalizedQuery.match(/^(.+?)\s+(\d+[\p{L}]?(?:[/-]\d+)?)\s*,\s*(.+)$/u);
      if (address && /\/api\/?$/.test(url.pathname)) {
        url.pathname = url.pathname.replace(/\/api\/?$/, '/structured');
        url.searchParams.set('street', address[1]);
        url.searchParams.set('housenumber', address[2]);
        const town = address[3].split(',').map((part) => part.trim()).filter(Boolean);
        url.searchParams.set('city', town[0]);
        if (town.length > 1) url.searchParams.set('country', town[town.length - 1]);
      } else url.searchParams.set('q', normalizedQuery);
      url.searchParams.set('limit', '5');
      let data: unknown;
      try {
        const native = getNativeBridge();
        if (native?.searchPlaces) data = await Promise.race([
          native.searchPlaces(url.toString()),
          new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })),
        ]);
        else {
          const response = await fetch(url.toString(), { signal: controller.signal });
          if (!response.ok) throw new Error(unavailable);
          data = await response.json();
        }
      } catch {
        throw new Error(controller.signal.aborted ? 'Place search took too long. Please try again.' : unavailable);
      }
      let results = parsePlaces(data, normalized);
      if (address) {
        results = results.filter((place) => place.houseNumber?.toLocaleLowerCase() === address[2].toLocaleLowerCase());
        if (!results.length) throw new Error('No matching house number found. Try the street and town without a number, or enter coordinates.');
      }
      if (!results.length) throw new Error('No place found. Try adding the town or country, or enter coordinates.');
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, results);
      return results;
    } finally { clearTimeout(timer); }
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}

export async function findOpenPlace(query: string): Promise<Point> {
  const place = (await searchOpenPlaces(query))[0];
  return { latitude: place.latitude, longitude: place.longitude };
}
