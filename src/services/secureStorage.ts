import * as SecureStore from 'expo-secure-store';
import { AI_MODELS } from '../constants/modules';
import { AiConfig, AiProvider } from '../types';

const API_KEY_PREFIX = 'solar_calculator_api_key_';
const PROVIDER_KEY = 'solar_calculator_ai_provider';

export async function saveApiKey(provider: AiProvider, apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(`${API_KEY_PREFIX}${provider}`, apiKey.trim());
  await SecureStore.setItemAsync(PROVIDER_KEY, provider);
}

export async function loadApiKey(provider: AiProvider): Promise<string> {
  return (await SecureStore.getItemAsync(`${API_KEY_PREFIX}${provider}`)) ?? '';
}

export async function loadAiProvider(): Promise<AiProvider> {
  const stored = await SecureStore.getItemAsync(PROVIDER_KEY);
  return stored === 'gemini' ? 'gemini' : 'openai';
}

export async function loadAiConfig(): Promise<AiConfig> {
  const provider = await loadAiProvider();
  const apiKey = await loadApiKey(provider);
  return {
    provider,
    apiKey,
    model: AI_MODELS[provider],
  };
}

export async function clearApiKey(provider: AiProvider): Promise<void> {
  await SecureStore.deleteItemAsync(`${API_KEY_PREFIX}${provider}`);
}
