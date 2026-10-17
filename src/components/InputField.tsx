import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { FieldLabel } from './InfoTip';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  tip?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Destaca o campo (usado no condutor neutro). */
  highlight?: boolean;
};

export function InputField({ label, hint, error, tip, icon, highlight, style, ...rest }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={highlight ? colors.accent : colors.primary}
            style={styles.icon}
          />
        ) : null}
        <View style={styles.labelFlex}>
          <FieldLabel label={label} tip={tip} />
        </View>
      </View>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: highlight ? colors.accentSoft : colors.inputBg,
            borderColor: error ? colors.danger : highlight ? colors.accent : colors.border,
            color: colors.text,
          },
          style,
        ]}
        {...rest}
      />
      {hint && !error ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  labelFlex: { flex: 1 },
  icon: { marginTop: 1 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginTop: 6,
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginTop: 6,
  },
});
