import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SolarModule } from '../types';
import { formatNumber } from '../utils/calculations';

type Props = {
  module?: SolarModule;
};

/** Card compacto com comprimento/largura da placa selecionada. */
export function SelectedModuleDims({ module }: Props) {
  const { colors } = useTheme();
  if (!module) return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.primarySoft, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        Placa selecionada · {module.powerWp} Wp
      </Text>
      <Text style={[styles.row, { color: colors.textSecondary }]}>
        Comprimento: {formatNumber(module.lengthM)} m ({formatNumber(module.lengthM * 1000, 0)} mm)
      </Text>
      <Text style={[styles.row, { color: colors.textSecondary }]}>
        Largura: {formatNumber(module.widthM)} m ({formatNumber(module.widthM * 1000, 0)} mm)
      </Text>
      <Text style={[styles.row, { color: colors.textSecondary }]}>
        Área unitária: {formatNumber(module.areaM2)} m²
        {module.isCustom ? ' · customizada' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    marginBottom: 6,
  },
  row: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
});
