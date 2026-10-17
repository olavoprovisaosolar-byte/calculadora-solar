import {
  DMSans_400Regular,
  DMSans_500Medium,
  useFonts as useDmSans,
} from '@expo-google-fonts/dm-sans';
import {
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts as useOutfit,
} from '@expo-google-fonts/outfit';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { RestoreBackupOffer } from './src/components/RestoreBackupOffer';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ModulesProvider } from './src/hooks/ModulesContext';
import { RoofWorkspaceProvider } from './src/hooks/RoofWorkspaceContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

enableScreens(true);
SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppShell() {
  const { isDark } = useTheme();
  return (
    <View style={styles.shell}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
      <RestoreBackupOffer />
    </View>
  );
}

export default function App() {
  const [dmLoaded] = useDmSans({
    DMSans_400Regular,
    DMSans_500Medium,
  });
  const [outfitLoaded] = useOutfit({
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  const fontsReady = dmLoaded && outfitLoaded;

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider>
          <ModulesProvider>
            <RoofWorkspaceProvider>
              <AppShell />
            </RoofWorkspaceProvider>
          </ModulesProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  shell: { flex: 1 },
});
