import { SolarModule } from '../types';

export type MergeableBackup = {
  savedAt: string;
  modules: SolarModule[];
  roof: {
    roofWidthText?: string;
    roofLengthText?: string;
    obstacles?: unknown[];
  } | null;
  offGrid: {
    clientName?: string;
    currentAText?: string;
    currentBText?: string;
    currentCText?: string;
  } | null;
  calculation: { input?: string } | null;
  loadHistory?: readonly unknown[] | null;
};

function text(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function backupHasUserData(backup: MergeableBackup): boolean {
  if (backup.modules.length > 0) return true;
  if (
    backup.roof &&
    (text(backup.roof.roofWidthText) ||
      text(backup.roof.roofLengthText) ||
      (backup.roof.obstacles?.length ?? 0) > 0)
  ) {
    return true;
  }
  if (
    backup.offGrid &&
    (text(backup.offGrid.clientName) ||
      text(backup.offGrid.currentAText) ||
      text(backup.offGrid.currentBText) ||
      text(backup.offGrid.currentCText))
  ) {
    return true;
  }
  if ((backup.loadHistory?.length ?? 0) > 0) return true;
  return Boolean(backup.calculation && text(backup.calculation.input));
}

export function mergeBackups<T extends MergeableBackup>(current: T, incoming: T): T {
  const currentHas = backupHasUserData(current);
  const incomingHas = backupHasUserData(incoming);
  if (currentHas && !incomingHas) return current;
  if (incomingHas && !currentHas) return incoming;

  const currentTime = Date.parse(current.savedAt) || 0;
  const incomingTime = Date.parse(incoming.savedAt) || 0;
  const newer = incomingTime >= currentTime ? incoming : current;
  const older = newer === incoming ? current : incoming;
  const byId = new Map<string, SolarModule>();
  for (const module of [...older.modules, ...newer.modules]) {
    if (module?.id) byId.set(module.id, module);
  }
  return {
    ...newer,
    modules: Array.from(byId.values()),
    roof: newer.roof ?? older.roof,
    offGrid: newer.offGrid ?? older.offGrid,
    calculation: newer.calculation ?? older.calculation,
  };
}
