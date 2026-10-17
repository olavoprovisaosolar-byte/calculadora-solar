import { requireOptionalNativeModule } from 'expo-modules-core';

type SolarDurableBackupNative = {
  requestSystemBackup: () => boolean;
  writePublicBackup: (json: string) => string;
  readPublicBackup: () => string | null;
  writeRootBackup: (json: string, fileName: string) => string;
  readRootBackups: () => string;
  readDedicatedBackup: () => string | null;
};

const native = requireOptionalNativeModule<SolarDurableBackupNative>('SolarDurableBackup');

export function requestSystemBackup(): void {
  try {
    native?.requestSystemBackup();
  } catch {
    // Web e aparelhos sem o módulo seguem só com o backup interno.
  }
}

export async function writePublicBackup(json: string): Promise<string> {
  try {
    return native?.writePublicBackup(json) ?? 'interno';
  } catch {
    return 'interno';
  }
}

export async function readPublicBackup(): Promise<string | null> {
  try {
    const raw = native?.readPublicBackup();
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

export async function writeRootBackup(json: string, fileName: string): Promise<string> {
  try {
    return native?.writeRootBackup(json, fileName) ?? 'interno';
  } catch {
    return 'interno';
  }
}

export async function readRootBackups(): Promise<string | null> {
  try {
    const raw = native?.readRootBackups();
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

export async function readDedicatedBackup(): Promise<string | null> {
  try {
    const raw = native?.readDedicatedBackup();
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}
