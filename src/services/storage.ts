import AsyncStorage from '@react-native-async-storage/async-storage';
import { SolarModule } from '../types';

export const CUSTOM_MODULES_KEY = '@solar_calculator/custom_modules';

function optionalPositive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text : undefined;
}

function normalizeModules(input: unknown): SolarModule[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is SolarModule => {
      if (!item || typeof item !== 'object') return false;
      const m = item as Partial<SolarModule>;
      return (
        typeof m.id === 'string' &&
        typeof m.powerWp === 'number' &&
        Number.isFinite(m.powerWp) &&
        m.powerWp > 0 &&
        typeof m.widthM === 'number' &&
        typeof m.lengthM === 'number'
      );
    })
    .map((m) => {
      const thicknessMm = optionalPositive(m.thicknessMm);
      const weightKg = optionalPositive(m.weightKg);
      const frame = optionalText(m.frame);
      const glass = optionalText(m.glass);
      const datasheetNotes = optionalText(m.datasheetNotes);
      return {
        id: m.id,
        manufacturer: String(m.manufacturer || 'Customizado'),
        model: String(m.model || `${m.powerWp} Wp`),
        powerWp: m.powerWp,
        widthM: m.widthM,
        lengthM: m.lengthM,
        areaM2:
          typeof m.areaM2 === 'number' && Number.isFinite(m.areaM2)
            ? m.areaM2
            : Math.round(m.lengthM * m.widthM * 100) / 100,
        isCustom: true,
        ...(thicknessMm != null ? { thicknessMm } : {}),
        ...(weightKg != null ? { weightKg } : {}),
        ...(frame ? { frame } : {}),
        ...(glass ? { glass } : {}),
        ...(datasheetNotes ? { datasheetNotes } : {}),
      };
    });
}

export async function loadCustomModules(): Promise<SolarModule[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_MODULES_KEY);
    if (!raw) return [];
    return normalizeModules(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function saveCustomModules(modules: SolarModule[]): Promise<void> {
  const normalized = normalizeModules(modules);
  await AsyncStorage.setItem(CUSTOM_MODULES_KEY, JSON.stringify(normalized));
}

export async function addCustomModule(module: SolarModule): Promise<SolarModule[]> {
  const current = await loadCustomModules();
  const next = [module, ...current.filter((m) => m.id !== module.id)];
  await saveCustomModules(next);
  return next;
}

export async function removeCustomModule(id: string): Promise<SolarModule[]> {
  const current = await loadCustomModules();
  const next = current.filter((m) => m.id !== id);
  await saveCustomModules(next);
  return next;
}

export async function mergeCustomModules(incoming: SolarModule[]): Promise<SolarModule[]> {
  const current = await loadCustomModules();
  const byId = new Map<string, SolarModule>();
  for (const mod of [...incoming, ...current]) {
    if (!byId.has(mod.id)) {
      byId.set(mod.id, { ...mod, isCustom: true });
    }
  }
  const next = Array.from(byId.values());
  await saveCustomModules(next);
  return next;
}

export { normalizeModules };
