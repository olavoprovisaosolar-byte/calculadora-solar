import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export type AmpTone = 'A' | 'B' | 'C' | 'N';

const TONES: Record<AmpTone, { title: string; background: string; border: string; ink: string }> = {
  A: { title: 'Corrente Fase A', background: '#DBEAFE', border: '#1D4ED8', ink: '#1E3A8A' },
  B: { title: 'Corrente Fase B', background: '#FFEDD5', border: '#C2410C', ink: '#9A3412' },
  C: { title: 'Corrente Fase C', background: '#DCFCE7', border: '#15803D', ink: '#14532D' },
  N: { title: 'Corrente no Neutro', background: '#FEF3C7', border: '#B45309', ink: '#78350F' },
};

type Props = {
  tone: AmpTone;
  value: string;
  onChangeText: (value: string) => void;
  tip?: string;
};

export function CurrentAmpCard({ tone, value, onChangeText, tip }: Props) {
  const palette = TONES[tone];
  const [tipOpen, setTipOpen] = useState(false);

  return (
    <View
      accessibilityLabel={palette.title}
      style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: palette.ink }]}>{palette.title}</Text>
        {tip ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Explicar ${palette.title}`}
            hitSlop={8}
            onPress={() => setTipOpen((open) => !open)}
          >
            <Ionicons name={tipOpen ? 'help-circle' : 'help-circle-outline'} size={20} color={palette.ink} />
          </Pressable>
        ) : null}
      </View>
      {tipOpen && tip ? <Text style={[styles.tip, { color: palette.ink }]}>{tip}</Text> : null}
      <View style={[styles.field, { borderColor: palette.border }]}>
        <TextInput
          accessibilityLabel={palette.title}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#64748B"
          style={[styles.input, { color: palette.ink }]}
        />
        <Text accessibilityLabel="Ampere" style={[styles.suffix, { color: palette.ink }]}>
          A
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 3,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    lineHeight: 24,
    flex: 1,
  },
  tip: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 22,
    paddingVertical: 8,
  },
  suffix: {
    flexShrink: 0,
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    marginLeft: 8,
  },
});
