import type { Point } from '../types';
export async function findPlace(query: string): Promise<Point> {
  if (typeof google !== 'undefined' && google.maps?.Geocoder) {
    const result = await new google.maps.Geocoder().geocode({ address: query });
    if (!result.results.length) throw new Error('No place found. Try a city and country.');
    const p = result.results[0].geometry.location;
    return { latitude: p.lat(), longitude: p.lng() };
  }
  const cities: Record<string, Point> = {
    zagreb: { latitude: 45.807, longitude: 15.978 },
    london: { latitude: 51.5074, longitude: -0.1278 },
    berlin: { latitude: 52.52, longitude: 13.405 },
    paris: { latitude: 48.8566, longitude: 2.3522 },
    'new york': { latitude: 40.7128, longitude: -74.006 },
    'são paulo': { latitude: -23.55, longitude: -46.633 },
    split: { latitude: 43.508, longitude: 16.44 },
  };
  const match = cities[query.toLowerCase().trim()];
  if (match) return match;
  throw new Error(
    'Full address search needs the Google Maps connection. In this browser preview, try Zagreb, London, Berlin, Paris, New York, Split, or São Paulo.',
  );
}
