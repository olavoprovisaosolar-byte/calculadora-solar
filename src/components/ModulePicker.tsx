import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SolarModule } from '../types';
import { formatNumber } from '../utils/calculations';

type Props = {
  modules: SolarModule[];
  selectedId?: string;
  onSelect: (module: SolarModule) => void;
  /** Exibe comprimento × largura da placa no chip. */
  showDimensions?: boolean;
};

export function ModulePicker({
  modules,
  selectedId,
  onSelect,
  showDimensions = true,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.text }]}>Modelo de placa / painel</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {modules.map((module) => {
          const selected = module.id === selectedId;
          const fg = selected
            ? colors.mode === 'light'
              ? '#fff'
              : colors.background
            : colors.text;
          const meta = selected
            ? colors.mode === 'light'
              ? 'rgba(255,255,255,0.85)'
              : colors.backgroundAlt
            : colors.textSecondary;
          return (
            <Pressable
              key={module.id}
              onPress={() => onSelect(module)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipTitle, { color: fg }]}>{module.powerWp} Wp</Text>
              {showDimensions ? (
                <Text style={[styles.chipMeta, { color: meta }]}>
                  {formatNumber(module.lengthM)} × {formatNumber(module.widthM)} m
                </Text>
              ) : null}
              <Text style={[styles.chipMeta, { color: meta }]}>
                {formatNumber(module.areaM2)} m²
                {module.isCustom ? ' · custom' : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    marginBottom: 10,
  },
  row: { gap: 10, paddingRight: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 120,
  },
  chipTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  chipMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginTop: 4,
  },
});
