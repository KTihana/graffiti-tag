async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('graffiti-tag-media', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export type LocalMediaBackup = {
  extension: string;
  mimeType: string;
  original: ArrayBuffer;
  preview: ArrayBuffer;
};
export async function readBytes(uri: string): Promise<ArrayBuffer> {
  return (await fetch(uri)).arrayBuffer();
}
export async function saveLocalMedia(
  id: string,
  original: ArrayBuffer,
  preview: ArrayBuffer,
  extension: string,
): Promise<string> {
  await restoreLocalMedia(id, original, preview, extension, mimeForExtension(extension));
  return `idb:${id}`;
}
function mimeForExtension(extension: string): string {
  return (
    {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
    } as Record<string, string>
  )[extension.toLowerCase()] || 'application/octet-stream';
}
export async function readLocalMediaBackup(id: string): Promise<LocalMediaBackup> {
  const db = await database();
  try {
    return await new Promise<LocalMediaBackup>((resolve, reject) => {
    const tx = db.transaction('photos');
    const store = tx.objectStore('photos');
    const keysRequest = store.getAllKeys();
    keysRequest.onerror = () => reject(keysRequest.error);
    keysRequest.onsuccess = () => {
      const originalKey = keysRequest.result.find(
        (key): key is string => typeof key === 'string' && key.startsWith(`${id}.`),
      );
      if (!originalKey) {
        reject(new Error(`The original photograph for ${id} is missing from browser storage.`));
        return;
      }
      const extension = originalKey.slice(id.length + 1);
      const originalRequest = store.get(originalKey);
      const previewRequest = store.get(id);
      let original: Blob | undefined;
      let preview: Blob | undefined;
      const finish = () => {
        if (!original || !preview) return;
        const originalBlob = original;
        const previewBlob = preview;
        Promise.all([originalBlob.arrayBuffer(), previewBlob.arrayBuffer()]).then(
          ([originalBytes, previewBytes]) =>
            resolve({
              extension,
              mimeType: originalBlob.type || mimeForExtension(extension),
              original: originalBytes,
              preview: previewBytes,
            }),
          reject,
        );
      };
      originalRequest.onerror = () => reject(originalRequest.error);
      previewRequest.onerror = () => reject(previewRequest.error);
      originalRequest.onsuccess = () => {
        if (!(originalRequest.result instanceof Blob)) {
          reject(new Error(`The original photograph for ${id} is missing or invalid.`));
          return;
        }
        original = originalRequest.result;
        finish();
      };
      previewRequest.onsuccess = () => {
        if (!(previewRequest.result instanceof Blob)) {
          reject(new Error(`The preview photograph for ${id} is missing or invalid.`));
          return;
        }
        preview = previewRequest.result;
        finish();
      };
    };
    });
  } finally {
    db.close();
  }
}
export async function restoreLocalMedia(
  id: string,
  original: ArrayBuffer,
  preview: ArrayBuffer,
  extension: string,
  mimeType: string,
): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').put(new Blob([original], { type: mimeType }), `${id}.${extension}`);
    tx.objectStore('photos').put(new Blob([preview], { type: 'image/jpeg' }), id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
const urls = new Map<string, string>();
export async function resolvePhotoUri(uri: string): Promise<string> {
  if (!uri.startsWith('idb:')) return uri;
  if (urls.has(uri)) return urls.get(uri)!;
  const db = await database();
  const blob = await new Promise<Blob>((resolve, reject) => {
    const r = db.transaction('photos').objectStore('photos').get(uri.slice(4));
    r.onsuccess = () =>
      r.result ? resolve(r.result) : reject(new Error('Local photograph was removed.'));
    r.onerror = () => reject(r.error);
  });
  db.close();
  const url = URL.createObjectURL(blob);
  urls.set(uri, url);
  return url;
}
