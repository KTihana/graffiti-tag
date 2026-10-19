export const BACKUP_TIME_KEY = 'graffiti-tag-personal-last-backup-v1';
export type BackupImportResult = { imported: number; skipped: number };

function unsupported(): Error {
  return new Error('Personal archive backups are available in the web app only.');
}

export async function exportPersonalBackup(): Promise<{ tags: number; photos: number }> {
  throw unsupported();
}

export async function importPersonalBackup(): Promise<BackupImportResult | null> {
  throw unsupported();
}
