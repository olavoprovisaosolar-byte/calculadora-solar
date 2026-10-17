import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SolarModule } from '../types';
import {
  appBackupFileUri,
  notifyAppBackupImported,
  parseAppBackup,
  patchAppBackup,
} from './appBackup';
import {
  loadCustomModules,
  mergeCustomModules,
  normalizeModules,
  saveCustomModules,
} from './storage';
import { replaceSurveyHistory } from './surveyStore';

export const BACKUP_FILE_NAME = 'solar-calculator-modules-backup.json';
export const BACKUP_SCHEMA = 'solar-calculator.modules.v1';

type ModulesBackupPayload = {
  schema: typeof BACKUP_SCHEMA;
  app: 'Solar Calculator';
  exportedAt: string;
  modules: SolarModule[];
};

function backupUri(): string {
  const base = FileSystem.documentDirectory;
  if (!base) {
    throw new Error('Armazenamento interno indisponível neste dispositivo.');
  }
  return `${base}${BACKUP_FILE_NAME}`;
}

export function buildBackupPayload(modules: SolarModule[]): ModulesBackupPayload {
  return {
    schema: BACKUP_SCHEMA,
    app: 'Solar Calculator',
    exportedAt: new Date().toISOString(),
    modules: normalizeModules(modules),
  };
}

export async function writeLocalModulesBackup(modules: SolarModule[]): Promise<string> {
  const uri = backupUri();
  const payload = buildBackupPayload(modules);
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return uri;
}

export async function readLocalModulesBackup(): Promise<SolarModule[] | null> {
  try {
    const uri = backupUri();
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return parseBackupText(raw);
  } catch {
    return null;
  }
}

export function parseBackupText(raw: string): SolarModule[] {
  const parsed = JSON.parse(raw) as Partial<ModulesBackupPayload> | SolarModule[];
  if (Array.isArray(parsed)) {
    return normalizeModules(parsed);
  }
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.modules)) {
    return normalizeModules(parsed.modules);
  }
  throw new Error('Arquivo de backup inválido.');
}

/**
 * Se o AsyncStorage estiver vazio (ex.: limpeza parcial), tenta recuperar
 * o último backup interno automático.
 */
export async function restoreModulesFromLocalBackupIfNeeded(): Promise<SolarModule[]> {
  const current = await loadCustomModules();
  if (current.length > 0) return current;

  const fromFile = await readLocalModulesBackup();
  if (!fromFile || fromFile.length === 0) return [];

  await saveCustomModules(fromFile);
  return fromFile;
}

export async function exportModulesBackup(modules: SolarModule[]): Promise<string> {
  await writeLocalModulesBackup(modules);
  await patchAppBackup({ modules });
  const uri = await appBackupFileUri();
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error(
      'Compartilhamento indisponível. O backup interno foi salvo no app; use outro dispositivo Android com compartilhamento.',
    );
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Salvar backup do Solar Calculator',
    UTI: 'public.json',
  });
  return uri;
}

export async function importModulesBackupFromPicker(): Promise<{
  modules: SolarModule[];
  addedOrMerged: number;
}> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    throw new Error('Importação cancelada.');
  }

  const asset = result.assets[0];
  const raw = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const backup = parseAppBackup(raw);
  const incoming = backup.modules;
  if (
    incoming.length === 0 &&
    !backup.roof &&
    !backup.offGrid &&
    !backup.calculation &&
    backup.loadHistory.length === 0
  ) {
    throw new Error('Nenhuma placa válida encontrada no arquivo.');
  }

  const before = await loadCustomModules();
  const merged = incoming.length > 0 ? await mergeCustomModules(incoming) : before;
  if (incoming.length > 0) {
    await writeLocalModulesBackup(merged);
  }

  const record = JSON.parse(raw) as Record<string, unknown> | SolarModule[];
  const partial: {
    modules?: SolarModule[];
    roof?: typeof backup.roof;
    offGrid?: typeof backup.offGrid;
    calculation?: typeof backup.calculation;
    loadHistory?: typeof backup.loadHistory;
  } = {};
  if (merged.length > 0) partial.modules = merged;
  if (record && typeof record === 'object' && !Array.isArray(record)) {
    if (record.roof) partial.roof = backup.roof;
    if (record.offGrid) partial.offGrid = backup.offGrid;
    if (record.calculation) partial.calculation = backup.calculation;
    if (backup.loadHistory.length > 0) {
      partial.loadHistory = await replaceSurveyHistory(backup.loadHistory);
    }
  }
  await patchAppBackup(partial);
  notifyAppBackupImported();

  return {
    modules: merged,
    addedOrMerged: Math.max(0, merged.length - before.length) || incoming.length,
  };
}
