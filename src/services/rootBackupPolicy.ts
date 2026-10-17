export const ROOT_BACKUP_FOLDER = 'Calculadora Solar/Backups';
export const ROOT_BACKUP_DISPLAY = 'Meus Documentos/Calculadora Solar/Backups';
export const ROOT_BACKUP_FILE = 'solar-calculator-backup.json';

export type StartupRestore = 'silent' | 'reception';

export function startupRestoreMode(input: {
  activeHasData: boolean;
  folderBackupFound: boolean;
}): StartupRestore {
  if (input.activeHasData || input.folderBackupFound) return 'silent';
  return 'reception';
}

export function shouldMigrateExistingData(alreadyMigrated: boolean, hasUserData: boolean): boolean {
  return !alreadyMigrated && hasUserData;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function migrationFileName(date = new Date()): string {
  return `solar-calculator-backup-migracao-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.json`;
}

export function safeBackupFileName(fileName: string): string {
  const base = fileName.split('/').pop()?.split('\\').pop()?.trim() || ROOT_BACKUP_FILE;
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '-');
  return cleaned.toLowerCase().endsWith('.json') ? cleaned : `${cleaned}.json`;
}

type InspectedBackup = {
  savedAt: string;
  hasData: boolean;
};

export function newestBackupRaw(
  raws: readonly string[],
  inspect: (raw: string) => InspectedBackup | null,
): string | null {
  let best: { raw: string; time: number } | null = null;
  for (const raw of raws) {
    const info = inspect(raw);
    if (!info?.hasData) continue;
    const time = Date.parse(info.savedAt) || 0;
    if (!best || time >= best.time) best = { raw, time };
  }
  return best?.raw ?? null;
}
