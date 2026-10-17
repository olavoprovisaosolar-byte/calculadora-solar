import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { mergeSurveyHistory } from '../utils/surveyHistory';
import {
  loadAppBackup,
  notifyAppBackupImported,
  parseAppBackup,
  patchAppBackup,
} from './appBackup';
import { mergeBackups } from './backupMerge';
import { ROOT_BACKUP_FILE } from './rootBackupPolicy';
import { loadSurveyHistory, replaceSurveyHistory } from './surveyStore';

const DRIVE_FOLDER_KEY = '@solar_calculator/drive_folder_uri';
const DRIVE_WEB_FLAG = '@solar_calculator/drive_web_linked';
const WEB_PICKER_ID = 'solar-calculator-backup';

type WebFile = {
  getFile: () => Promise<{ text: () => Promise<string> }>;
};

type WebDir = {
  getFileHandle: (
    name: string,
    options: { create: boolean },
  ) => Promise<{
    createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
    getFile: () => Promise<{ text: () => Promise<string> }>;
  }>;
  entries: () => AsyncIterable<[string, { kind: string } & WebFile]>;
};

let webDirectory: WebDir | null = null;

export type CloudBackupFile = {
  id: string;
  label: string;
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function backupFileName(date = new Date()): string {
  return `solar-calculator-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
}

function fileLabel(uriOrName: string): string {
  const raw = decodeURIComponent(uriOrName.split('/').pop() ?? uriOrName);
  return raw.replace(/%2F/gi, '/').split('/').pop() ?? raw;
}

async function backupPayload(): Promise<string> {
  const backup = await loadAppBackup();
  const localHistory = await loadSurveyHistory();
  return JSON.stringify(
    {
      ...backup,
      loadHistory: mergeSurveyHistory(backup.loadHistory ?? [], localHistory),
      savedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

async function pickWebDirectory(): Promise<WebDir> {
  const picker = (globalThis as { showDirectoryPicker?: (options: { id: string; mode: 'readwrite' }) => Promise<WebDir> })
    .showDirectoryPicker;
  if (!picker) {
    throw new Error('Este navegador não abre pasta do Google Drive. Use o backup local e envie o arquivo para o Drive.');
  }
  const handle = await picker({ id: WEB_PICKER_ID, mode: 'readwrite' });
  webDirectory = handle;
  await AsyncStorage.setItem(DRIVE_WEB_FLAG, '1');
  return handle;
}

export async function driveLinkStatus(): Promise<string> {
  if (Platform.OS === 'android') {
    const uri = await AsyncStorage.getItem(DRIVE_FOLDER_KEY);
    return uri
      ? 'Pasta do Google Drive vinculada neste aparelho.'
      : 'Nenhuma pasta vinculada. Toque em Vincular Google Drive e escolha a pasta no Drive.';
  }
  if (webDirectory || (await AsyncStorage.getItem(DRIVE_WEB_FLAG))) {
    return 'A pasta do Google Drive será reaberta ao fazer o backup.';
  }
  return 'Nenhuma pasta vinculada. Toque em Vincular Google Drive e escolha a pasta no Drive.';
}

export async function linkDriveFolder(): Promise<void> {
  if (Platform.OS === 'android') {
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Vinculação cancelada.');
    }
    await AsyncStorage.setItem(DRIVE_FOLDER_KEY, permission.directoryUri);
    return;
  }
  if (Platform.OS === 'web') {
    await pickWebDirectory();
    return;
  }
  throw new Error('A vinculação da pasta do Google Drive está disponível no Android.');
}

async function androidFolder(): Promise<string> {
  const saved = await AsyncStorage.getItem(DRIVE_FOLDER_KEY);
  if (saved) return saved;
  await linkDriveFolder();
  const uri = await AsyncStorage.getItem(DRIVE_FOLDER_KEY);
  if (!uri) throw new Error('Vinculação cancelada.');
  return uri;
}

async function dedicatedBackupPayload(): Promise<string> {
  const json = await backupPayload();
  const root = await import('./rootFolder');
  await root.writeRootBackupFile(json, ROOT_BACKUP_FILE);
  const dedicated = await root.readDedicatedBackupRaw();
  return dedicated?.trim() ? dedicated : json;
}

async function writeAndroidMirror(folder: string, filename: string, json: string): Promise<void> {
  const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(folder);
  const existing = entries.find((uri) => fileLabel(uri).toLowerCase() === filename.toLowerCase());
  if (existing) {
    await FileSystem.writeAsStringAsync(existing, json, { encoding: FileSystem.EncodingType.UTF8 });
    return;
  }
  const stem = filename.replace(/\.json$/i, '');
  const uri = await FileSystem.StorageAccessFramework.createFileAsync(folder, stem, 'application/json');
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
}

export async function saveCloudBackup(): Promise<string> {
  const json = await dedicatedBackupPayload();
  const filename = ROOT_BACKUP_FILE;

  if (Platform.OS === 'android') {
    const folder = await androidFolder();
    await writeAndroidMirror(folder, filename, json);
    return filename;
  }

  if (Platform.OS === 'web') {
    const directory = webDirectory ?? (await pickWebDirectory());
    const handle = await directory.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
    return filename;
  }

  throw new Error('O backup na nuvem está disponível no Android, escolhendo a pasta do Google Drive.');
}

export async function listCloudBackups(): Promise<CloudBackupFile[]> {
  if (Platform.OS === 'android') {
    const folder = await androidFolder();
    const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(folder);
    return entries
      .filter((uri) => fileLabel(uri).includes('solar-calculator-backup'))
      .map((uri) => ({ id: uri, label: fileLabel(uri) }))
      .sort((a, b) => b.label.localeCompare(a.label));
  }
  if (Platform.OS === 'web') {
    const directory = webDirectory ?? (await pickWebDirectory());
    const files: CloudBackupFile[] = [];
    for await (const [name, child] of directory.entries()) {
      if (child.kind === 'file' && name.includes('solar-calculator-backup')) {
        files.push({ id: name, label: name });
      }
    }
    return files.sort((a, b) => b.label.localeCompare(a.label));
  }
  throw new Error('A busca na nuvem está disponível no Android, na pasta vinculada do Google Drive.');
}

export async function readCloudBackup(file: CloudBackupFile): Promise<string> {
  if (Platform.OS === 'web') {
    const directory = webDirectory ?? (await pickWebDirectory());
    const handle = await directory.getFileHandle(file.id, { create: false });
    const blob = await handle.getFile();
    return blob.text();
  }
  return FileSystem.readAsStringAsync(file.id, { encoding: FileSystem.EncodingType.UTF8 });
}

export async function saveLocalBackup(): Promise<'shared' | 'downloaded'> {
  const json = await dedicatedBackupPayload();
  const filename = ROOT_BACKUP_FILE;
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return 'downloaded';
  }
  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!base) throw new Error('Armazenamento indisponível neste aparelho.');
  const uri = `${base}${filename}`;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Compartilhamento indisponível. O backup interno continua neste aparelho.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Salvar backup local',
    UTI: 'public.json',
  });
  return 'shared';
}

export async function pickLocalBackup(): Promise<string> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) {
    throw new Error('Restauração cancelada.');
  }
  try {
    return await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    const response = await fetch(result.assets[0].uri);
    if (!response.ok) throw new Error('Não foi possível ler o arquivo de backup.');
    return response.text();
  }
}

export async function applyBackupJson(raw: string): Promise<{ surveys: number }> {
  const backup = parseAppBackup(raw);
  const current = await loadAppBackup();
  const merged = mergeBackups(current, backup);
  const history = await replaceSurveyHistory(backup.loadHistory);
  await patchAppBackup({
    modules: merged.modules,
    roof: merged.roof,
    offGrid: merged.offGrid,
    calculation: merged.calculation,
    loadHistory: history,
  });
  notifyAppBackupImported();
  return { surveys: history.length };
}
