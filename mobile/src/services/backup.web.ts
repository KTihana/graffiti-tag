import { getNativeBridge } from './nativeBridge';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocalData } from './localArchive';
import { loadLocalArchive, saveLocalArchive, SAVED_KEY } from './localArchive';
import { isPersonal } from './supabase';
import { readLocalMediaBackup, restoreLocalMedia } from './media.web';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  decodeBackupBase64,
  MAX_BACKUP_BYTES,
  validatePersonalBackup,
} from './backupFormat';
import type { BackupMediaEntry, PersonalBackup } from './backupFormat';

export const BACKUP_TIME_KEY = 'graffiti-tag-personal-last-backup-v1';
export type BackupImportResult = { imported: number; skipped: number };

function base64(bytes: ArrayBuffer): string {
  const values = new Uint8Array(bytes);
  let binary = '';
  const stride = 0x8000;
  for (let offset = 0; offset < values.length; offset += stride) {
    binary += String.fromCharCode(...values.subarray(offset, offset + stride));
  }
  return btoa(binary);
}
function assertPersonalMode() {
  if (!isPersonal) throw new Error('Backups are available in personal mode only.');
}
function readSavedIds(value: string | null): string[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
    throw new Error(
      'Saved tags could not be read. Repair the saved list before importing a backup.',
    );
  }
  return parsed;
}

export async function exportPersonalBackup(): Promise<{ tags: number; photos: number }> {
  assertPersonalMode();
  const archive = await loadLocalArchive();
  const media: Record<string, BackupMediaEntry> = Object.create(null);
  let photos = 0;
  let estimatedBytes = new Blob([JSON.stringify(archive)]).size;
  const tooLarge = () => new Error(
    'This archive exceeds the 50 MB single-file backup limit. Your data remains intact.',
  );
  for (const tag of archive.tags) {
    for (const photo of tag.photos) {
      photos++;
      if (photo.uri !== `idb:${photo.id}`) {
        throw new Error(`Cannot back up photo ${photo.id}: local image data is missing.`);
      }
      const files = await readLocalMediaBackup(photo.id);
      // Check before encoding so oversized archives cannot exhaust memory while
      // constructing a backup. Base64 uses four bytes per three source bytes.
      estimatedBytes += 4 * Math.ceil(files.original.byteLength / 3)
        + 4 * Math.ceil(files.preview.byteLength / 3) + 512;
      if (estimatedBytes > MAX_BACKUP_BYTES) throw tooLarge();
      media[photo.id] = {
        extension: files.extension,
        mimeType: files.mimeType,
        originalBase64: base64(files.original),
        previewBase64: base64(files.preview),
      };
    }
  }
  const savedIds = readSavedIds(await AsyncStorage.getItem(SAVED_KEY));
  const document: PersonalBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    archive,
    savedIds,
    media,
  };
  const contents = JSON.stringify(document);
  if (new Blob([contents]).size > MAX_BACKUP_BYTES) {
    throw new Error(
      'This archive exceeds the 50 MB single-file backup limit. Your data remains intact.',
    );
  }
  const native = getNativeBridge();
  if (native) {
    await native.saveBackup(
      contents,
      `graffiti-tag-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
  } else {
    const blob = new Blob([contents], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = documentLink(url);
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  await AsyncStorage.setItem(BACKUP_TIME_KEY, new Date().toISOString());
  return { tags: archive.tags.length, photos };
}

function documentLink(url: string): HTMLAnchorElement {
  const link = window.document.createElement('a');
  link.href = url;
  link.download = `graffiti-tag-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return link;
}

function pickBackupFile(): Promise<File | null> {
  return new Promise((resolve, reject) => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    let settled = false;
    let focusTimeout: number | undefined;
    const cleanup = () => {
      input.remove();
      window.removeEventListener('focus', onFocus);
      if (focusTimeout !== undefined) window.clearTimeout(focusTimeout);
    };
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };
    const onFocus = () => {
      // Fallback for browsers that omit the file input's cancel event.
      focusTimeout = window.setTimeout(() => {
        if (!input.files?.length) finish(null);
      }, 500);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    window.addEventListener('focus', onFocus, { once: true });
    window.document.body.appendChild(input);
    try {
      input.click();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export async function importPersonalBackup(): Promise<BackupImportResult | null> {
  assertPersonalMode();
  const file = await pickBackupFile();
  if (!file) return null;
  if (file.size > MAX_BACKUP_BYTES) {
    throw new Error('Backup files must be 50 MB or smaller.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('This backup file is not valid JSON.');
  }
  const backup = validatePersonalBackup(parsed);
  const existing = await loadLocalArchive();
  const savedIds = readSavedIds(await AsyncStorage.getItem(SAVED_KEY));
  const existingIds = new Set(existing.tags.map((tag) => tag.id));
  const newTags = backup.archive.tags.filter((tag) => !existingIds.has(tag.id));
  const newIds = new Set(newTags.map((tag) => tag.id));
  const newPhotoIds = new Set(newTags.flatMap((tag) => tag.photos.map((photo) => photo.id)));
  const currentPhotoIds = new Set(
    existing.tags.flatMap((tag) => tag.photos.map((photo) => photo.id)),
  );
  if ([...newPhotoIds].some((id) => currentPhotoIds.has(id))) {
    throw new Error(
      'Backup reuses an image ID already present in this archive. No data was changed.',
    );
  }

  // All backup data has been checked above. Restore photo blobs before linking new tags in storage.
  for (const id of newPhotoIds) {
    const photo = backup.media[id];
    if (!photo) continue;
    await restoreLocalMedia(
      id,
      decodeBackupBase64(photo.originalBase64, 'original'),
      decodeBackupBase64(photo.previewBase64, 'preview'),
      photo.extension,
      photo.mimeType,
    );
  }

  const next: LocalData = {
    tags: [...existing.tags, ...newTags],
    revisions: [
      ...existing.revisions,
      ...backup.archive.revisions.filter((revision) => newIds.has(revision.tagId)),
    ],
    reports: [
      ...existing.reports,
      ...backup.archive.reports.filter((report) => newIds.has(report.tagId)),
    ],
  };
  await saveLocalArchive(next);
  const savedSet = new Set(savedIds);
  for (const id of backup.savedIds) if (newIds.has(id)) savedSet.add(id);
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([...savedSet]));
  return { imported: newTags.length, skipped: backup.archive.tags.length - newTags.length };
}
