import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { AiReviewPayload, AiReviewResult } from '../types';
import { PrimaryButton } from './PrimaryButton';

type Props = {
  onReview: (payload: AiReviewPayload) => Promise<AiReviewResult>;
  payload: AiReviewPayload | null;
  disabledReason?: string;
};

export function AiReviewCard({ onReview, payload, disabledReason }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiReviewResult | null>(null);
  const [expanded, setExpanded] = useState(true);

  const handlePress = async () => {
    if (!payload) return;
    setLoading(true);
    setError(null);
    try {
      const review = await onReview(payload);
      setResult(review);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na revisão com IA.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Validação Inteligente</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Envie os dados e resultados calculados para a IA revisar a coerência técnica do
        dimensionamento.
      </Text>

      {disabledReason ? (
        <Text style={[styles.warning, { color: colors.warning }]}>{disabledReason}</Text>
      ) : null}

      <PrimaryButton
        label="🔍 Revisar Dimensionamento com IA"
        onPress={handlePress}
        loading={loading}
        disabled={!payload || Boolean(disabledReason)}
        style={styles.button}
      />

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Analisando em segundo plano…
          </Text>
        </View>
      ) : null}

      {result ? (
        <View
          style={[
            styles.resultBox,
            {
              backgroundColor: colors.backgroundAlt,
              borderColor: colors.border,
            },
          ]}
        >
          <Pressable onPress={() => setExpanded((v) => !v)} style={styles.resultHeader}>
            <Text style={[styles.resultTitle, { color: colors.text }]}>
              Parecer da IA {result.coherent ? '· Coerente' : '· Revisar pontos'}
            </Text>
            <Text style={{ color: colors.primary, fontFamily: 'Outfit_700Bold' }}>
              {expanded ? '−' : '+'}
            </Text>
          </Pressable>
          {expanded ? (
            <View style={styles.resultBody}>
              <Text style={[styles.summary, { color: colors.text }]}>{result.summary}</Text>
              {result.observations.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                    Observações
                  </Text>
                  {result.observations.map((item) => (
                    <Text key={item} style={[styles.bullet, { color: colors.text }]}>
                      • {item}
                    </Text>
                  ))}
                </>
              ) : null}
              {result.suggestions.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                    Sugestões
                  </Text>
                  {result.suggestions.map((item) => (
                    <Text key={item} style={[styles.bullet, { color: colors.text }]}>
                      • {item}
                    </Text>
                  ))}
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 17,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  warning: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginBottom: 12,
  },
  button: { marginBottom: 8 },
  error: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  loadingText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
  },
  resultBox: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  resultTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    flex: 1,
  },
  resultBody: { marginTop: 10 },
  summary: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
  },
  sectionLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    marginTop: 12,
    marginBottom: 4,
  },
  bullet: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 2,
  },
});
