import type { UserLocation } from '../types';

export type NativePhoto = {
  uri: string;
  mimeType: string;
  exif?: Record<string, unknown>;
};

export type PersonalNativeBridge = {
  isNative: true;
  searchPlaces?: (url: string) => Promise<unknown>;
  getAppVersion?: () => Promise<string>;
  takePhoto: (camera: boolean) => Promise<NativePhoto>;
  getLocation: () => Promise<UserLocation>;
  watchLocation: (
    onPosition: (position: UserLocation) => void,
    onError: (error: unknown) => void,
  ) => Promise<() => void>;
  saveBackup: (contents: string, filename: string) => Promise<void>;
  consumeRestoredPhoto?: () => NativePhoto | undefined;
};
export function getNativeBridge(): PersonalNativeBridge | undefined {
  return typeof window === 'undefined'
    ? undefined
    : (window as Window & { GraffitiNative?: PersonalNativeBridge }).GraffitiNative;
}
