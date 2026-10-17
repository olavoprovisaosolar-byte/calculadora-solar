import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DriveSyncSection } from '../components/DriveSyncSection';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { AI_MODELS } from '../constants/modules';
import { useAiConfig } from '../hooks/useAiConfig';
import { useTheme } from '../theme/ThemeContext';
import { AiProvider, ThemeMode } from '../types';
import { providerLabel } from '../services/aiService';

const THEME_OPTIONS: Array<{ key: ThemeMode; label: string }> = [
  { key: 'system', label: 'Sistema' },
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Escuro' },
];

export function ConfigAiScreen() {
  const { colors, mode, setMode } = useTheme();
  const {
    config,
    setProvider,
    setApiKey,
    save,
    testConnection,
    saving,
    testing,
    testMessage,
    testOk,
  } = useAiConfig();

  const providers: AiProvider[] = ['openai', 'gemini'];

  return (
    <ScreenContainer
      title="Configurações"
      subtitle="Tema visual e integração com IA para revisão inteligente dos dimensionamentos."
    >
      <Text style={[styles.section, { color: colors.text }]}>Aparência</Text>
      <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {THEME_OPTIONS.map((item) => {
          const selected = mode === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setMode(item.key)}
              style={[
                styles.segmentItem,
                { backgroundColor: selected ? colors.primary : 'transparent' },
              ]}
            >
              <Text
                style={{
                  fontFamily: 'Outfit_600SemiBold',
                  color: selected
                    ? colors.mode === 'light'
                      ? '#fff'
                      : colors.background
                    : colors.textSecondary,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.section, { color: colors.text }]}>Provedor de IA</Text>
      <View style={styles.providerList}>
        {providers.map((provider) => {
          const selected = config.provider === provider;
          return (
            <Pressable
              key={provider}
              onPress={() => setProvider(provider)}
              style={[
                styles.providerCard,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.providerTitle, { color: colors.text }]}>
                {providerLabel(provider)}
              </Text>
              <Text style={[styles.providerMeta, { color: colors.textSecondary }]}>
                Modelo: {AI_MODELS[provider]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <InputField
        label="Chave de API"
        value={config.apiKey}
        onChangeText={setApiKey}
        placeholder={
          config.provider === 'openai' ? 'sk-...' : 'AIza...'
        }
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        hint="A chave é armazenada de forma segura no dispositivo (SecureStore)."
      />

      <PrimaryButton
        label="Salvar configuração"
        onPress={save}
        loading={saving}
        style={styles.cta}
      />
      <PrimaryButton
        label="Testar conexão"
        onPress={testConnection}
        loading={testing}
        variant="secondary"
        style={styles.cta}
      />

      {testMessage ? (
        <View
          style={[
            styles.status,
            {
              backgroundColor: testOk
                ? colors.primarySoft
                : colors.mode === 'dark'
                  ? '#3A1A1A'
                  : '#FDECEC',
              borderColor: testOk ? colors.success : colors.danger,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: testOk ? colors.success : colors.danger },
            ]}
          >
            {testMessage}
          </Text>
        </View>
      ) : null}

      <DriveSyncSection />

      <View
        style={[
          styles.info,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.infoTitle, { color: colors.text }]}>Como usar a revisão com IA</Text>
        <Text style={[styles.infoBody, { color: colors.textSecondary }]}>
          1. Salve uma API Key válida da OpenAI ou do Gemini.{'\n'}
          2. Teste a conexão nesta tela.{'\n'}
          3. Nas telas de resultado, toque em “Revisar Dimensionamento com IA”.{'\n'}
          4. O parecer aparece em um card expansível na mesma tela.{'\n'}
          Os cálculos funcionam sem a chave. Se a OpenAI avisar que não há créditos, adicione saldo na conta ou use o Google Gemini.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    marginBottom: 12,
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minHeight: 42,
  },
  providerList: { gap: 10, marginBottom: 16 },
  providerCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  providerTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
  },
  providerMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 4,
  },
  cta: { marginBottom: 12 },
  status: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  statusText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  info: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    marginBottom: 8,
  },
  infoBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
});
