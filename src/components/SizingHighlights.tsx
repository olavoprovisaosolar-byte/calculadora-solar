import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export type HighlightItem = {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
};

type Props = {
  title: string;
  items: HighlightItem[];
};

/** Destaques principais após escolher a placa: quantidade, área e inversor. */
export function SizingHighlights({ title, items }: Props) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <View style={styles.grid}>
        {items.map((item) => (
          <View
            key={item.label}
            style={[
              styles.item,
              {
                backgroundColor: item.accent ? colors.accentSoft : colors.backgroundAlt,
                borderColor: item.accent ? colors.accent : colors.border,
              },
            ]}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>{item.label}</Text>
            <Text
              style={[
                styles.value,
                { color: item.accent ? colors.accent : colors.text },
              ]}
            >
              {item.value}
            </Text>
            {item.hint ? (
              <Text style={[styles.hint, { color: colors.textMuted }]}>{item.hint}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 17,
    marginBottom: 12,
  },
  grid: {
    gap: 10,
  },
  item: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    marginBottom: 4,
  },
  value: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    lineHeight: 28,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
});
