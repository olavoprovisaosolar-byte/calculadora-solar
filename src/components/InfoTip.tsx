import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  label: string;
  tip?: string;
};

/** Rótulo de campo com ícone (?) que abre a explicação do termo. */
export function FieldLabel({ label, tip }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {tip ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Explicar ${label}`}
            hitSlop={8}
            onPress={() => setOpen((value) => !value)}
          >
            <Ionicons name={open ? 'help-circle' : 'help-circle-outline'} size={18} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>
      {open && tip ? (
        <Text style={[styles.tip, { color: colors.textSecondary, backgroundColor: colors.accentSoft }]}>
          {tip}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    flexShrink: 1,
  },
  tip: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
});
