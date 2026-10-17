import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { mergeSurveyHistory, normalizeSurveyHistory } from '../utils/surveyHistory';
import {
  AppBackup,
  mergeBackupWithHistory,
  parseAppBackup,
} from './appBackup';
import { backupHasUserData } from './backupMerge';
import {
  ROOT_BACKUP_FILE,
  ROOT_BACKUP_FOLDER,
  migrationFileName,
  newestBackupRaw,
  safeBackupFileName,
  shouldMigrateExistingData,
} from './rootBackupPolicy';

const MIGRATED_KEY = '@solar_calculator/root_migrated_v1';
const FOLDER_INDEX_KEY = '@solar_calculator/CalculadoraSolar_Backups_index';
const SURVEY_HISTORY_KEY = '@solar_calculator/survey_history_v1';

type FolderIndex = Record<string, string>;

function inspect(raw: string): { savedAt: string; hasData: boolean } | null {
  try {
    const backup = parseAppBackup(raw);
    return { savedAt: backup.savedAt, hasData: backupHasUserData(backup) };
  } catch {
    return null;
  }
}

function sandboxDir(): string | null {
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  return `${base}${ROOT_BACKUP_FOLDER}/`;
}

async function readFolderIndex(): Promise<FolderIndex> {
  try {
    const raw = await AsyncStorage.getItem(FOLDER_INDEX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const index: FolderIndex = {};
    for (const [name, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.trim()) index[name] = value;
    }
    return index;
  } catch {
    return {};
  }
}

async function writeFolderIndex(fileName: string, json: string): Promise<boolean> {
  const index = await readFolderIndex();
  index[safeBackupFileName(fileName)] = json;
  await AsyncStorage.setItem(FOLDER_INDEX_KEY, JSON.stringify(index));
  return true;
}

async function readSandboxRaws(): Promise<string[]> {
  if (Platform.OS === 'web') return [];
  const dir = sandboxDir();
  if (!dir) return [];
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) return [];
    const names = await FileSystem.readDirectoryAsync(dir);
    const raws: string[] = [];
    for (const name of names) {
      if (!name.toLowerCase().endsWith('.json')) continue;
      try {
        const raw = await FileSystem.readAsStringAsync(`${dir}${name}`, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (raw.trim()) raws.push(raw);
      } catch {
        // arquivo ilegível permanece no disco
      }
    }
    return raws;
  } catch {
    return [];
  }
}

async function writeSandbox(json: string, fileName: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const dir = sandboxDir();
  if (!dir) return false;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  await FileSystem.writeAsStringAsync(`${dir}${safeBackupFileName(fileName)}`, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return true;
}

function unwrapNativePayload(payload: string): string[] {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed.filter((item) => item.trim());
    }
  } catch {
    // payload único
  }
  return payload.trim() ? [payload] : [];
}

async function readNativeRaws(): Promise<string[]> {
  try {
    const durable = await import('solar-durable-backup');
    const payload = await durable.readRootBackups();
    if (!payload) return [];
    return unwrapNativePayload(payload);
  } catch {
    return [];
  }
}

export async function readRootBackupRaws(): Promise<string[]> {
  const [nativeRaws, sandboxRaws, index] = await Promise.all([
    readNativeRaws(),
    readSandboxRaws(),
    readFolderIndex(),
  ]);
  return [...nativeRaws, ...sandboxRaws, ...Object.values(index)];
}

export async function folderContainsUserBackup(): Promise<boolean> {
  const raws = await readRootBackupRaws();
  return newestBackupRaw(raws, inspect) != null;
}

export async function readDedicatedBackupRaw(): Promise<string | null> {
  try {
    const durable = await import('solar-durable-backup');
    const raw = await durable.readDedicatedBackup();
    if (raw?.trim()) return raw;
  } catch {
    // sem módulo nativo a cópia segue no índice da pasta
  }
  const indexed = (await readFolderIndex())[ROOT_BACKUP_FILE];
  if (indexed?.trim()) return indexed;
  if (Platform.OS === 'web') return null;
  const dir = sandboxDir();
  if (!dir) return null;
  try {
    const uri = `${dir}${ROOT_BACKUP_FILE}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
    return raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

export async function writeRootBackupFile(json: string, fileName: string): Promise<boolean> {
  const safeName = safeBackupFileName(fileName);
  let wrote = false;
  try {
    const durable = await import('solar-durable-backup');
    const where = await durable.writeRootBackup(json, safeName);
    if (where === 'raiz' || where === 'documentos' || where === 'downloads') wrote = true;
  } catch {
    // sem módulo nativo a cópia segue na pasta do aplicativo
  }
  try {
    if (await writeSandbox(json, safeName)) wrote = true;
  } catch {
    // diretório interno indisponível
  }
  try {
    if (await writeFolderIndex(safeName, json)) wrote = true;
  } catch {
    // índice local indisponível
  }
  return wrote;
}

async function attachSeparateHistory(loaded: AppBackup): Promise<AppBackup> {
  try {
    const raw = await AsyncStorage.getItem(SURVEY_HISTORY_KEY);
    if (!raw) return loaded;
    const history = normalizeSurveyHistory(JSON.parse(raw));
    if (history.length === 0) return loaded;
    return {
      ...loaded,
      loadHistory: mergeSurveyHistory(loaded.loadHistory ?? [], history),
    };
  } catch {
    return loaded;
  }
}

export async function absorbRootFolder(loaded: AppBackup, rawSources: readonly string[]): Promise<AppBackup> {
  const withHistory = await attachSeparateHistory(loaded);
  const discovered = newestBackupRaw(await readRootBackupRaws(), inspect);
  let next = withHistory;
  if (discovered) {
    try {
      next = mergeBackupWithHistory(withHistory, parseAppBackup(discovered));
    } catch {
      // arquivo da pasta ilegível não apaga o banco ativo
    }
  }

  const alreadyMigrated = (await AsyncStorage.getItem(MIGRATED_KEY)) === '1';
  if (shouldMigrateExistingData(alreadyMigrated, backupHasUserData(next))) {
    const seen = new Set<string>();
    let index = 1;
    const sources = discovered ? [...rawSources, discovered] : [...rawSources];
    for (const raw of sources) {
      const trimmed = raw.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      if (!inspect(trimmed)?.hasData) continue;
      await writeRootBackupFile(trimmed, `solar-calculator-backup-origem-${index}.json`);
      index += 1;
    }
    const snapshot = JSON.stringify(next, null, 2);
    await writeRootBackupFile(snapshot, migrationFileName());
    await writeRootBackupFile(snapshot, ROOT_BACKUP_FILE);
    await AsyncStorage.setItem(MIGRATED_KEY, '1');
    return next;
  }

  if (backupHasUserData(next)) {
    await writeRootBackupFile(JSON.stringify(next, null, 2), ROOT_BACKUP_FILE);
  }
  return next;
}
