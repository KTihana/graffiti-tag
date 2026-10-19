import * as Location from 'expo-location';
import type { Point } from '../types';
export async function findPlace(query: string): Promise<Point> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      'Android requires location permission for address search. You can still pan the map and search archived tags.',
    );
  const results = await Location.geocodeAsync(query);
  if (!results.length) throw new Error('No place found. Try a city and country.');
  return results[0];
}
