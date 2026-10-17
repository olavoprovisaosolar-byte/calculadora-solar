import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Action = {
  label: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  message: string;
  primary: Action;
  secondary?: Action;
  tertiary?: Action;
};

export function ActionDialog({ visible, title, message, primary, secondary, tertiary }: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={secondary?.onPress ?? primary.onPress}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={primary.onPress}
            style={[styles.primary, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.primaryLabel}>{primary.label}</Text>
          </Pressable>
          {secondary ? (
            <Pressable accessibilityRole="button" onPress={secondary.onPress} style={[styles.secondary, { borderColor: colors.border }]}>
              <Text style={[styles.secondaryLabel, { color: colors.text }]}>{secondary.label}</Text>
            </Pressable>
          ) : null}
          {tertiary ? (
            <Pressable accessibilityRole="button" onPress={tertiary.onPress} style={styles.tertiary}>
              <Text style={[styles.secondaryLabel, { color: colors.primary }]}>{tertiary.label}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    lineHeight: 26,
  },
  message: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 16,
  },
  primary: {
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryLabel: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  secondary: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },
  tertiary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  secondaryLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
  },
});
