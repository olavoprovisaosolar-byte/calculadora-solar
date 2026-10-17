import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeSurveyHistory, normalizeSurveyHistory, removeSurvey, SurveyRecord } from '../utils/surveyHistory';
import { patchAppBackup } from './appBackup';

export const SURVEY_HISTORY_KEY = '@solar_calculator/survey_history_v1';

const listeners = new Set<(records: SurveyRecord[]) => void>();

export function subscribeSurveyHistory(listener: (records: SurveyRecord[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(records: SurveyRecord[]): void {
  listeners.forEach((listener) => listener(records));
}

export async function loadSurveyHistory(): Promise<SurveyRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(SURVEY_HISTORY_KEY);
    if (!raw) return [];
    return normalizeSurveyHistory(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function persist(history: SurveyRecord[]): Promise<SurveyRecord[]> {
  const next = mergeSurveyHistory(history, []);
  await AsyncStorage.setItem(SURVEY_HISTORY_KEY, JSON.stringify(next));
  await patchAppBackup({ loadHistory: next }).catch(() => undefined);
  emit(next);
  return next;
}

export async function rememberSurvey(record: SurveyRecord): Promise<SurveyRecord[]> {
  const current = await loadSurveyHistory();
  return persist(mergeSurveyHistory(current, normalizeSurveyHistory([record])));
}

export async function forgetSurvey(id: string): Promise<SurveyRecord[]> {
  const current = await loadSurveyHistory();
  return persist(removeSurvey(current, id));
}

export async function replaceSurveyHistory(records: SurveyRecord[]): Promise<SurveyRecord[]> {
  const current = await loadSurveyHistory();
  return persist(mergeSurveyHistory(current, normalizeSurveyHistory(records)));
}
