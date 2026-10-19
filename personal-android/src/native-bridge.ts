import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Camera, CameraDirection, CameraResultType, CameraSource, MediaTypeSelection } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { StatusBar, Style } from '@capacitor/status-bar';

type ArchiveBackupPlugin = {
  prepareBackup(): Promise<{ id: string }>;
  appendBackup(options: { id: string; chunk: string }): Promise<void>;
  discardBackup(options: { id: string }): Promise<void>;
  saveBackup(options: { id: string; filename: string }): Promise<void>;
};

const ArchiveBackup = registerPlugin<ArchiveBackupPlugin>('ArchiveBackup');

type NativePhoto = {
  uri: string;
  mimeType: string;
  exif?: Record<string, unknown>;
};
type UserLocation = { latitude: number; longitude: number; accuracy: number | null };

const RESTORED_PHOTO_KEY = 'graffiti-native-restored-photo';
const CAMERA_ROUTE_KEY = 'graffiti-native-camera-route';

type GraffitiNativeBridge = {
  isNative: true;
  getAppVersion(): Promise<string>;
  takePhoto(camera: boolean): Promise<NativePhoto>;
  getLocation(): Promise<UserLocation>;
  watchLocation(onPosition: (position: UserLocation) => void, onError: (error: unknown) => void): Promise<() => void>;
  saveBackup(contents: string, filename: string): Promise<void>;
  lastRestoredPhoto?: NativePhoto;
  consumeRestoredPhoto(): NativePhoto | undefined;
};

declare global {
  interface Window {
    GraffitiNative?: GraffitiNativeBridge;
  }
}

function decodeExif(value?: string | Record<string, unknown>): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (typeof value === 'object') return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function mimeTypeFor(format?: string): string {
  const normalized = format?.toLowerCase().replace(/^\./, '');
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
  if (normalized === 'png') return 'image/png';
  if (normalized === 'webp') return 'image/webp';
  if (normalized === 'heic') return 'image/heic';
  if (normalized === 'heif') return 'image/heif';
  return 'image/jpeg';
}

async function takePhoto(camera: boolean): Promise<NativePhoto> {
  if (camera) {
    // Capacitor 8.2's new takePhoto flow does not restore its activity call after
    // Android reclaims the process. Keep the supported legacy flow until fixed.
    const photo = await Camera.getPhoto({
      quality: 100,
      direction: CameraDirection.Rear,
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
      correctOrientation: true,
    });
    const uri = photo.webPath || (photo.path ? Capacitor.convertFileSrc(photo.path) : undefined);
    if (!uri) throw new Error('The captured photo could not be opened.');
    return { uri, mimeType: mimeTypeFor(photo.format), exif: decodeExif(photo.exif) };
  }
  const result = (await Camera.chooseFromGallery({
    mediaType: MediaTypeSelection.Photo,
    limit: 1,
    includeMetadata: true,
  })).results[0];

  if (!result) throw new Error('No photo was selected.');
  // Capacitor's webPath is served through its local WebView origin and can be
  // consumed by fetch(), while uri may be an inaccessible content:// location.
  const uri = result.webPath || result.uri;
  if (!uri) throw new Error('The selected photo could not be opened.');
  return {
    uri,
    mimeType: mimeTypeFor(result.metadata?.format),
    exif: decodeExif(result.metadata?.exif),
  };
}

async function getLocation(): Promise<UserLocation> {
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 20_000,
    maximumAge: 0,
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };
}

async function watchLocation(
  onPosition: (position: UserLocation) => void,
  onError: (error: unknown) => void,
): Promise<() => void> {
  const id = await Geolocation.watchPosition({
    enableHighAccuracy: true,
    timeout: 20_000,
    maximumAge: 0,
    interval: 3_000,
    minimumUpdateInterval: 3_000,
  }, (position, error) => {
    if (error) onError(error);
    else if (position) onPosition({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    });
  });
  return () => { void Geolocation.clearWatch({ id }).catch(() => {}); };
}

async function saveBackup(contents: string, filename: string): Promise<void> {
  const safeName = filename.trim().replace(/[^a-zA-Z0-9._-]/g, '_') || 'graffiti-tag-backup.json';
  const { id } = await ArchiveBackup.prepareBackup();
  try {
    for (let offset = 0; offset < contents.length;) {
      let end = Math.min(offset + 65536, contents.length);
      // Keep UTF-16 surrogate pairs together when Java writes each UTF-8 chunk.
      const last = contents.charCodeAt(end - 1);
      if (end < contents.length && last >= 0xd800 && last <= 0xdbff) end--;
      await ArchiveBackup.appendBackup({ id, chunk: contents.slice(offset, end) });
      offset = end;
    }
    await ArchiveBackup.saveBackup({ id, filename: safeName });
  } finally {
    await ArchiveBackup.discardBackup({ id }).catch(() => {});
  }
}

const bridge: GraffitiNativeBridge = {
  isNative: true,
  async getAppVersion() { return (await App.getInfo()).version; },
  takePhoto,
  getLocation,
  watchLocation,
  saveBackup,
  consumeRestoredPhoto() {
    const photo = bridge.lastRestoredPhoto;
    bridge.lastRestoredPhoto = undefined;
    return photo;
  },
};
window.GraffitiNative = bridge;

// A process-reclaimed camera activity may relaunch the WebView at its default
// route. Keep the small result across the route reload so Contribute can apply it.
try {
  const restoredPhoto = localStorage.getItem(RESTORED_PHOTO_KEY);
  if (restoredPhoto) {
    bridge.lastRestoredPhoto = JSON.parse(restoredPhoto) as NativePhoto;
    localStorage.removeItem(RESTORED_PHOTO_KEY);
  }
} catch {
  // The in-memory result path below remains available if web storage is blocked.
}

if (Capacitor.isNativePlatform()) {
  // LIGHT means dark status-bar glyphs, matching the app's light paper surface.
  void StatusBar.setStyle({ style: Style.Light });

  // Camera launches an external Android activity. If Android reclaims this
  // process while the camera is open, expose the restored result to the app.
  void App.addListener('appRestoredResult', (event) => {
    if (event.pluginId !== 'Camera' || !event.success || !event.data) return;
    const data = event.data as {
      uri?: string;
      webPath?: string;
      path?: string;
      metadata?: { format?: string; exif?: string };
      format?: string;
      exif?: string;
    };
    const rawUri = data.webPath || data.uri || data.path;
    if (!rawUri) return;
    const uri = data.webPath || Capacitor.convertFileSrc(rawUri);
    const photo: NativePhoto = {
      uri,
      mimeType: mimeTypeFor(data.metadata?.format || data.format),
      exif: decodeExif(data.metadata?.exif || data.exif),
    };
    let restoreRoute: string | null = null;
    try {
      restoreRoute = localStorage.getItem(CAMERA_ROUTE_KEY) || '/contribute';
      if (!restoreRoute.startsWith('/') || restoreRoute.startsWith('//')) {
        restoreRoute = '/contribute';
      }
      const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (currentRoute !== restoreRoute) {
        localStorage.setItem(RESTORED_PHOTO_KEY, JSON.stringify(photo));
        localStorage.removeItem(CAMERA_ROUTE_KEY);
        window.location.replace(restoreRoute);
        return;
      }
      localStorage.removeItem(CAMERA_ROUTE_KEY);
    } catch {
      // Fall through to the in-memory result and event for the active route.
    }
    bridge.lastRestoredPhoto = photo;
    window.dispatchEvent(new CustomEvent('graffiti-native-photo-restored', { detail: photo }));
  });

  // Let Expo Router's browser history handle Back on pushed screens. At the app
  // root, exit normally instead of leaving the user on an empty WebView.
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });
}
