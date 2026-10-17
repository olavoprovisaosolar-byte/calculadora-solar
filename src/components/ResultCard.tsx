import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export type ResultRow = {
  label: string;
  value: string;
  emphasize?: boolean;
};

type Props = {
  title: string;
  rows: ResultRow[];
};

export function ResultCard({ title, rows }: Props) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {rows.map((row) => (
        <View key={row.label} style={[styles.row, { borderTopColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{row.label}</Text>
          <Text
            style={[
              styles.value,
              {
                color: row.emphasize ? colors.accent : colors.text,
                fontFamily: row.emphasize ? 'Outfit_700Bold' : 'Outfit_600SemiBold',
              },
            ]}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 17,
    marginBottom: 4,
  },
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    flex: 1,
  },
  value: {
    fontSize: 16,
    textAlign: 'right',
  },
});
