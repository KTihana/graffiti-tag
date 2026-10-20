import { searchOpenPlaces, coordinatePlace, type PlaceResult } from './placeSearch';
import type { Point } from '../types';
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const coordinates = coordinatePlace(query);
  if (coordinates) return [coordinates];
  if (typeof google !== 'undefined' && google.maps?.Geocoder) {
    try {
      const result = await new google.maps.Geocoder().geocode({ address: query });
      if (result.results.length) return result.results.slice(0, 5).map((item) => {
        const location = item.geometry.location, bounds = item.geometry.viewport;
        return {
          id: item.place_id, title: item.formatted_address.split(',')[0],
          address: item.formatted_address, kind: item.types[0] || 'place',
          latitude: location.lat(), longitude: location.lng(),
          viewport: { latitude: bounds.getCenter().lat(), longitude: bounds.getCenter().lng(), latitudeDelta: Math.max(0.002, bounds.getNorthEast().lat() - bounds.getSouthWest().lat()) * 1.2, longitudeDelta: Math.max(0.002, bounds.getNorthEast().lng() - bounds.getSouthWest().lng()) * 1.2 },
        };
      });
    } catch { /* Continue with the key-free geocoder when Google is unavailable. */ }
  }
  return searchOpenPlaces(query);
}
export async function findPlace(query: string): Promise<Point> {
  const place = (await searchPlaces(query))[0];
  return { latitude: place.latitude, longitude: place.longitude };
}
