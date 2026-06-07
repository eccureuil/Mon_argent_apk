import { useEffect, useRef, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, Text } from 'react-native';
import * as Updates from 'expo-updates';
import * as SplashScreen from 'expo-splash-screen';
import GradientBg from '../components/GradientBg';

SplashScreen.preventAutoHideAsync();
const SPLASH_TIMEOUT_MS = 5000;
import {
  useFonts,
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import { SessionProvider, useSession } from '../hooks/useSession';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import {
  requestPermissions,
  scheduleDailySummary,
  checkOverdueBills,
  cancelAllScheduled,
  checkUpcomingDueBills,
  setSoundEnabled,
} from '../services/notifications';
import { getDb } from '../database/db';

function NotificationManager() {
  const { user } = useSession();
  const appState = useRef(AppState.currentState);

  const syncNotifications = useCallback(async (userId: number) => {
    const db = await getDb();

    const getPref = async (key: string, def: string): Promise<string> => {
      const row = await db.getFirstAsync<{ valeur: string }>(
        'SELECT valeur FROM parametres WHERE user_id = ? AND cle = ?',
        userId,
        key
      );
      return row?.valeur ?? def;
    };

    const rappelsEnabled = await getPref('notif_rappels_enabled', 'true');
    const echeanceEnabled = await getPref('notif_echeance_enabled', 'true');
    const soundPref = await getPref('notif_sound_enabled', 'true');
    const hour = parseInt(await getPref('notif_rappels_heure', '19'), 10);
    const minute = parseInt(await getPref('notif_rappels_minute', '0'), 10);
    const joursAvant = parseInt(await getPref('notif_echeance_jours', '1'), 10);

    setSoundEnabled(soundPref === 'true');

    if (rappelsEnabled === 'true') {
      await scheduleDailySummary(userId, hour, minute);
    } else {
      await cancelAllScheduled();
    }

    if (echeanceEnabled === 'true') {
      await checkUpcomingDueBills(userId, joursAvant);
    }

    await checkOverdueBills(userId);
  }, []);

  useEffect(() => {
    if (!user) return;

    requestPermissions().then((granted) => {
      if (granted) {
        syncNotifications(user.id);
      }
    });

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (user) {
          syncNotifications(user.id);
        }
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [user, syncNotifications]);

  return null;
}

function OtaUpdater() {
  useEffect(() => {
    async function checkUpdate() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        // silently ignore in dev
      }
    }
    if (!__DEV__) checkUpdate();
  }, []);
  return null;
}

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      (Text as any).defaultProps = { style: { fontFamily: 'IBMPlexSans_400Regular' } };
      const timer = setTimeout(() => {
        SplashScreen.hideAsync();
      }, SPLASH_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SessionProvider>
      <ThemeProvider>
        <OtaUpdater />
        <ThemedStatusBar />
        <GradientBg>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </GradientBg>
      </ThemeProvider>
    </SessionProvider>
  );
}
