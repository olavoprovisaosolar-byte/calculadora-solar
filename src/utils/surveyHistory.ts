export type PhaseCurrents = {
  A: string;
  B: string;
  C: string;
  neutro: string;
};

export type ClientLoadSnapshot = {
  supply: string;
  monoVoltage: number;
  triPair: string;
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
};

export type SurveyRecord = {
  id: string;
  savedAt: string;
  dataCadastro: string;
  nomeCliente: string;
  clientName: string;
  clientLocation: string;
  surveyDate: string;
  fases: PhaseCurrents;
  cargas: ClientLoadSnapshot;
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
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function foldClientName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeSurveyHistory(value: unknown): SurveyRecord[] {
  if (!Array.isArray(value)) return [];
  const rows: SurveyRecord[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const fases = asRecord(record.fases);
    const cargas = asRecord(record.cargas);
    const id = text(record.id).trim();
    const clientName = text(record.clientName).trim() || text(record.nomeCliente).trim();
    const savedAt = text(record.savedAt).trim() || text(record.dataCadastro).trim();
    if (!id || !clientName || !savedAt) continue;
    const supply = text(record.supply) || text(cargas?.supply, 'biphasic');
    const monoVoltage = record.monoVoltage === 220 || cargas?.monoVoltage === 220 ? 220 : 127;
    const triPair = record.triPair === '220_380' || cargas?.triPair === '220_380' ? '220_380' : '127_220';
    const currentAText = text(record.currentAText) || text(fases?.A);
    const currentBText = text(record.currentBText) || text(fases?.B);
    const currentCText = text(record.currentCText) || text(fases?.C);
    const currentNeutralText = text(record.currentNeutralText) || text(fases?.neutro);
    const utilization =
      typeof record.utilization === 'number'
        ? record.utilization
        : typeof cargas?.utilization === 'number'
          ? cargas.utilization
          : 0.8;
    const acOutput = text(record.acOutput) || text(cargas?.acOutput, 'mono220');
    const inverterBus = record.inverterBus === 24 || cargas?.inverterBus === 24 ? 24 : 48;
    const busVoltage = record.busVoltage === 24 || cargas?.busVoltage === 24 ? 24 : 48;
    const busTouched = Boolean(record.busTouched ?? cargas?.busTouched);
    const autonomyText = text(record.autonomyText) || text(cargas?.autonomyText, '12');
    const autonomyUnit =
      record.autonomyUnit === 'days' || cargas?.autonomyUnit === 'days' ? 'days' : 'hours';
    const useDod = (record.useDod ?? cargas?.useDod) !== false;
    const dodText = text(record.dodText) || text(cargas?.dodText, '80');
    const batteryModelId = text(record.batteryModelId) || text(cargas?.batteryModelId, 'li-48-100');
    const efficiencyText = text(record.efficiencyText) || text(cargas?.efficiencyText, '92');
    const cargasSnapshot: ClientLoadSnapshot = {
      supply,
      monoVoltage,
      triPair,
      utilization,
      acOutput,
      inverterBus,
      busVoltage,
      busTouched,
      autonomyText,
      autonomyUnit,
      useDod,
      dodText,
      batteryModelId,
      efficiencyText,
    };
    rows.push({
      id,
      savedAt,
      dataCadastro: savedAt,
      nomeCliente: clientName,
      clientName,
      clientLocation: text(record.clientLocation),
      surveyDate: text(record.surveyDate),
      fases: {
        A: currentAText,
        B: currentBText,
        C: currentCText,
        neutro: currentNeutralText,
      },
      cargas: cargasSnapshot,
      ...cargasSnapshot,
      currentAText,
      currentBText,
      currentCText,
      currentNeutralText,
    });
  }
  return mergeSurveyHistory(rows, []);
}

export function mergeSurveyHistory(current: SurveyRecord[], incoming: SurveyRecord[]): SurveyRecord[] {
  const byId = new Map<string, SurveyRecord>();
  for (const item of [...current, ...incoming]) {
    const previous = byId.get(item.id);
    if (!previous || Date.parse(item.savedAt) >= (Date.parse(previous.savedAt) || 0)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((a, b) => (Date.parse(b.savedAt) || 0) - (Date.parse(a.savedAt) || 0));
}

export function searchSurveys(records: SurveyRecord[], query: string): SurveyRecord[] {
  const needle = foldClientName(query);
  if (!needle) return records;
  return records.filter((item) => foldClientName(item.nomeCliente || item.clientName).includes(needle));
}

export function shouldShowClientLookup(focused: boolean, query: string): boolean {
  return focused || query.trim().length > 0;
}

export function removeSurvey(records: SurveyRecord[], id: string): SurveyRecord[] {
  return records.filter((item) => item.id !== id);
}
