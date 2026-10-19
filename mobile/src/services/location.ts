import * as Location from 'expo-location';
import type { UserLocation } from '../types';

export async function getCurrentLocation(): Promise<UserLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Location permission denied');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Location timed out')), 20_000);
      }),
    ]);
    return position.coords;
  } finally {
    clearTimeout(timer);
  }
}

export async function watchLocation(
  onPosition: (position: UserLocation) => void,
  onError: (error: unknown) => void,
): Promise<() => void> {
  const subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 3_000 },
    (position) => onPosition(position.coords),
    onError,
  );
  return () => subscription.remove();
}
