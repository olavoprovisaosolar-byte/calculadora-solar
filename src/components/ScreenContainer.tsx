import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  rightSlot?: React.ReactNode;
  scrollRef?: React.Ref<ScrollView>;
};

export function ScreenContainer({
  title,
  subtitle,
  children,
  scroll = true,
  contentStyle,
  rightSlot,
  scrollRef,
}: Props) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isWide = Math.min(width, height) >= 600 || width >= 900;

  const body = (
    <View style={[styles.content, isWide && styles.contentWide, contentStyle]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.brand, { color: colors.accent }]}>Solar Calculator</Text>
          <Text style={[styles.title, isWide && styles.titleWide, { color: colors.text }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
        {rightSlot}
      </View>
      {children}
    </View>
  );

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.gradientMid, colors.gradientBottom]}
      style={styles.flex}
    >
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: 36, flexGrow: 1 },
  scrollLandscape: { paddingBottom: 28 },
  content: { paddingHorizontal: 20, paddingTop: 12, width: '100%' },
  contentWide: {
    paddingHorizontal: 32,
    maxWidth: 920,
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  headerText: { flex: 1 },
  brand: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 28,
    lineHeight: 34,
  },
  titleWide: {
    fontSize: 32,
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
});
