import { getNativeBridge } from './nativeBridge';
import type { UserLocation } from '../types';

const options: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 20_000,
};

export async function getCurrentLocation(): Promise<UserLocation> {
  const native = getNativeBridge();
  if (native) return native.getLocation();
  if (!navigator.geolocation) throw new Error('Location unavailable');
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      }),
      reject,
      options,
    );
  });
}

export async function watchLocation(
  onPosition: (position: UserLocation) => void,
  onError: (error: unknown) => void,
): Promise<() => void> {
  const native = getNativeBridge();
  if (native) return native.watchLocation(onPosition, onError);
  if (!navigator.geolocation) throw new Error('Location unavailable');
  const id = navigator.geolocation.watchPosition(
    ({ coords }) => onPosition({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
    }),
    onError,
    options,
  );
  return () => navigator.geolocation.clearWatch(id);
}
