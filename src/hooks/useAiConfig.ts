import { useCallback, useEffect, useState } from 'react';
import { AI_MODELS } from '../constants/modules';
import { loadAiConfig, loadApiKey, saveApiKey } from '../services/secureStorage';
import { reviewDimensioning, testAiConnection } from '../services/aiService';
import { AiConfig, AiProvider, AiReviewPayload, AiReviewResult } from '../types';

const emptyConfig: AiConfig = {
  provider: 'openai',
  apiKey: '',
  model: AI_MODELS.openai,
};

export function useAiConfig() {
  const [config, setConfig] = useState<AiConfig>(emptyConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const loaded = await loadAiConfig();
    setConfig(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setProvider = useCallback(async (provider: AiProvider) => {
    const apiKey = await loadApiKey(provider);
    setConfig({
      provider,
      apiKey,
      model: AI_MODELS[provider],
    });
    setTestMessage(null);
    setTestOk(null);
  }, []);

  const setApiKey = useCallback((apiKey: string) => {
    setConfig((prev) => ({ ...prev, apiKey }));
    setTestMessage(null);
    setTestOk(null);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await saveApiKey(config.provider, config.apiKey);
      setTestMessage('Configuração salva com segurança no dispositivo.');
      setTestOk(true);
    } finally {
      setSaving(false);
    }
  }, [config]);

  const testConnection = useCallback(async () => {
    setTesting(true);
    setTestMessage(null);
    try {
      const message = await testAiConnection(config);
      setTestOk(true);
      setTestMessage(`Conexão bem-sucedida: ${message}`);
      await saveApiKey(config.provider, config.apiKey);
    } catch (error) {
      setTestOk(false);
      setTestMessage(error instanceof Error ? error.message : 'Falha no teste de conexão.');
    } finally {
      setTesting(false);
    }
  }, [config]);

  const review = useCallback(
    async (payload: AiReviewPayload): Promise<AiReviewResult> => {
      const current = await loadAiConfig();
      return reviewDimensioning(current, payload);
    },
    [],
  );

  return {
    config,
    loading,
    saving,
    testing,
    testMessage,
    testOk,
    setProvider,
    setApiKey,
    save,
    testConnection,
    review,
    refresh,
    hasApiKey: Boolean(config.apiKey.trim()),
  };
}
