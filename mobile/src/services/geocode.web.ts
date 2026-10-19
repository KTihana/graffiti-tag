import { findOpenPlace } from './placeSearch';
import type { Point } from '../types';
export async function findPlace(query: string): Promise<Point> {
  if (typeof google !== 'undefined' && google.maps?.Geocoder) {
    const result = await new google.maps.Geocoder().geocode({ address: query });
    if (!result.results.length) throw new Error('No place found. Try a city and country.');
    const p = result.results[0].geometry.location;
    return { latitude: p.lat(), longitude: p.lng() };
  }
  return findOpenPlace(query);
}
