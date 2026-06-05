import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { SessionProvider, useSession } from '../hooks/useSession';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import {
  requestPermissions,
  scheduleDailySummary,
  checkOverdueBills,
} from '../services/notifications';

function NotificationManager() {
  const { user } = useSession();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!user) return;

    requestPermissions().then((granted) => {
      if (granted) {
        scheduleDailySummary(user.id);
        checkOverdueBills(user.id);
      }
    });

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (user) {
          scheduleDailySummary(user.id);
          checkOverdueBills(user.id);
        }
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [user]);

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
  return (
    <SessionProvider>
      <ThemeProvider>
        <OtaUpdater />
        <ThemedStatusBar />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </SessionProvider>
  );
}
