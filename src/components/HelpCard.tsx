import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  title: string;
  body: string;
  initiallyOpen?: boolean;
};

export function HelpCard({ title, body, initiallyOpen = false }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.accentSoft,
          borderColor: colors.border,
        },
      ]}
    >
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.chevron, { color: colors.accent }]}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? (
        <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    flex: 1,
  },
  chevron: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    lineHeight: 24,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
});
