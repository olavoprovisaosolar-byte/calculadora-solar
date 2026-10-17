import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { SolarModule } from '../types';
import { mergeSurveyHistory, normalizeSurveyHistory, SurveyRecord } from '../utils/surveyHistory';
import { backupHasUserData, mergeBackups } from './backupMerge';
import { normalizeModules } from './storage';

export const APP_BACKUP_KEY = '@solar_calculator/app_backup_v2';
export const APP_BACKUP_FILE = 'solar-calculator-backup.json';
export const APP_BACKUP_SCHEMA = 'solar-calculator.backup.v2';

export type RoofWorkspaceDraft = {
  selectedId?: string;
  quantityText: string;
  roofWidthText: string;
  roofLengthText: string;
  roofAreaText: string;
  areaManual: boolean;
  marginText: string;
  edgeMarginText: string;
  endClampText: string;
  panelGapText: string;
  corridorEnabled: boolean;
  corridorWidthText: string;
  corridorEveryText: string;
  obstacleClearanceText: string;
  shapeMode: 'rectangle' | 'polygon';
  draftVertices: Array<{ x: number; y: number }>;
  polygonClosed: boolean;
  edgeLengthTexts: string[];
  calibrateEdgeIndex: number;
  obstacles: unknown[];
};

export type OffGridDraft = {
  supply: string;
  monoVoltage: number;
  triPair: string;
  currentAText: string;
  currentBText: string;
  currentCText: string;
  currentNeutralText: string;
  utilization: number;
  acOutput: string;
  inverterBus: number;
  busVoltage: number;
  busTouched: boolean;
  autonomyText: string;
  autonomyUnit: 'hours' | 'days';
  useDod: boolean;
  dodText: string;
  batteryModelId: string;
  efficiencyText: string;
  clientName: string;
  clientLocation: string;
  surveyDate: string;
};

export type CalculationDraft = {
  mode: 'monthly' | 'daily';
  input: string;
};

export type AppBackup = {
  schema: typeof APP_BACKUP_SCHEMA;
  app: 'Solar Calculator';
  savedAt: string;
  modules: SolarModule[];
  roof: RoofWorkspaceDraft | null;
  offGrid: OffGridDraft | null;
  calculation: CalculationDraft | null;
  loadHistory: SurveyRecord[];
};

const listeners = new Set<() => void>();

let memory: AppBackup | null = null;
let loadingPromise: Promise<AppBackup> | null = null;

function emptyBackup(): AppBackup {
  return {
    schema: APP_BACKUP_SCHEMA,
    app: 'Solar Calculator',
    savedAt: new Date().toISOString(),
    modules: [],
    roof: null,
    offGrid: null,
    calculation: null,
    loadHistory: [],
  };
}

export function mergeBackupWithHistory(current: AppBackup, incoming: AppBackup): AppBackup {
  return {
    ...mergeBackups(current, incoming),
    loadHistory: mergeSurveyHistory(current.loadHistory ?? [], incoming.loadHistory ?? []),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseAppBackup(raw: string): AppBackup {
  const parsed = JSON.parse(raw) as Record<string, unknown> | SolarModule[];
  if (Array.isArray(parsed)) {
    return { ...emptyBackup(), modules: normalizeModules(parsed) };
  }
  const record = asRecord(parsed) ?? {};
  const modules = Array.isArray(record.modules) ? normalizeModules(record.modules) : [];
  return {
    ...emptyBackup(),
    savedAt: typeof record.savedAt === 'string' ? record.savedAt : new Date().toISOString(),
    modules,
    roof: (asRecord(record.roof) as RoofWorkspaceDraft | null) ?? null,
    offGrid: (asRecord(record.offGrid) as OffGridDraft | null) ?? null,
    calculation: (asRecord(record.calculation) as CalculationDraft | null) ?? null,
    loadHistory: normalizeSurveyHistory(record.loadHistory),
  };
}

function fileUri(): string | null {
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  return `${base}${APP_BACKUP_FILE}`;
}

async function writeFile(backup: AppBackup): Promise<void> {
  const uri = fileUri();
  if (!uri) return;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

async function readFileRaw(): Promise<string | null> {
  try {
    const uri = fileUri();
    if (!uri) return null;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    return null;
  }
}

export async function loadAppBackup(): Promise<AppBackup> {
  if (memory) return memory;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const rawSources: string[] = [];
      let loaded = emptyBackup();
      try {
        const raw = await AsyncStorage.getItem(APP_BACKUP_KEY);
        if (raw) {
          rawSources.push(raw);
          loaded = parseAppBackup(raw);
        }
      } catch {
        // segue para o arquivo interno
      }
      const fromFileRaw = await readFileRaw();
      if (fromFileRaw) {
        rawSources.push(fromFileRaw);
        try {
          loaded = mergeBackupWithHistory(loaded, parseAppBackup(fromFileRaw));
        } catch {
          // arquivo interno ilegível
        }
      }
      const externalRaw = await readExternalBackup();
      if (externalRaw) {
        rawSources.push(externalRaw);
        try {
          loaded = mergeBackupWithHistory(loaded, parseAppBackup(externalRaw));
        } catch {
          // arquivo público ilegível não apaga o backup interno
        }
      }
      const root = await import('./rootFolder');
      loaded = await root.absorbRootFolder(loaded, rawSources);
      memory = loaded;
      if (backupHasUserData(memory) || memory.loadHistory.length > 0) {
        await AsyncStorage.setItem(APP_BACKUP_KEY, JSON.stringify(memory));
        await writeFile(memory).catch(() => undefined);
        void nudgeSystemBackup();
      }
      return memory;
    })().finally(() => {
      loadingPromise = null;
    });
  }
  return loadingPromise;
}

let writeQueue: Promise<void> = Promise.resolve();

export function patchAppBackup(
  partial: Partial<Pick<AppBackup, 'modules' | 'roof' | 'offGrid' | 'calculation' | 'loadHistory'>>,
): Promise<AppBackup> {
  const job = writeQueue.then(async () => {
    const current = await loadAppBackup();
    memory = {
      ...current,
      ...partial,
      schema: APP_BACKUP_SCHEMA,
      app: 'Solar Calculator',
      savedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(memory);
    await AsyncStorage.setItem(APP_BACKUP_KEY, json);
    await writeFile(memory).catch(() => undefined);
    await publishDurableCopy(json);
    return memory;
  });
  writeQueue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

async function readExternalBackup(): Promise<string | null> {
  try {
    const durable = await import('solar-durable-backup');
    return await durable.readPublicBackup();
  } catch {
    return null;
  }
}

async function publishDurableCopy(json: string): Promise<void> {
  try {
    const durable = await import('solar-durable-backup');
    await durable.writePublicBackup(json);
    durable.requestSystemBackup();
  } catch {
    // a cópia interna já foi gravada
  }
  try {
    const root = await import('./rootFolder');
    await root.writeRootBackupFile(json, APP_BACKUP_FILE);
  } catch {
    // Meus Documentos/Calculadora Solar/Backups será tentada de novo na próxima abertura
  }
}

function nudgeSystemBackup(): void {
  import('solar-durable-backup')
    .then((durable) => durable.requestSystemBackup())
    .catch(() => undefined);
}

export function subscribeAppBackup(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyAppBackupImported(): void {
  listeners.forEach((listener) => listener());
}

export async function appBackupFileUri(): Promise<string> {
  const backup = await loadAppBackup();
  await writeFile(backup);
  const uri = fileUri();
  if (!uri) {
    throw new Error('Armazenamento interno indisponível neste dispositivo.');
  }
  return uri;
}
