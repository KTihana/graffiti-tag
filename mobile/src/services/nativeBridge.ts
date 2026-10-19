export type NativePhoto = {
  uri: string;
  mimeType: string;
  exif?: Record<string, unknown>;
};

export type PersonalNativeBridge = {
  isNative: true;
  takePhoto: (camera: boolean) => Promise<NativePhoto>;
  getLocation: () => Promise<{ latitude: number; longitude: number }>;
  saveBackup: (contents: string, filename: string) => Promise<void>;
  consumeRestoredPhoto?: () => NativePhoto | undefined;
};
export function getNativeBridge(): PersonalNativeBridge | undefined {
  return typeof window === 'undefined'
    ? undefined
    : (window as Window & { GraffitiNative?: PersonalNativeBridge }).GraffitiNative;
}
