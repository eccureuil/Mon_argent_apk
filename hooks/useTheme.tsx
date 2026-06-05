import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors, lightColors, type ColorPalette } from '../constants/colors';
import type { ThemePreference } from '../types';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  colors: ColorPalette;
  themePreference: ThemePreference;
  toggleTheme: () => void;
  setTheme: (t: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_KEY = 'theme_preference';

function resolveTheme(pref: ThemePreference, systemScheme: 'dark' | 'light'): Theme {
  if (pref === 'system') return systemScheme;
  return pref;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('dark');

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(THEME_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemePreferenceState(saved);
        }
      } catch {}
    })();
  }, []);

  const theme = resolveTheme(themePreference, systemScheme ?? 'dark');

  const setTheme = useCallback(async (t: ThemePreference) => {
    setThemePreferenceState(t);
    try {
      await SecureStore.setItemAsync(THEME_KEY, t);
    } catch {}
  }, []);

  const toggleTheme = useCallback(async () => {
    const order: ThemePreference[] = ['system', 'dark', 'light'];
    const idx = order.indexOf(themePreference);
    const next = order[(idx + 1) % order.length];
    setThemePreferenceState(next);
    try {
      await SecureStore.setItemAsync(THEME_KEY, next);
    } catch {}
  }, [themePreference]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors: theme === 'dark' ? colors : lightColors,
        themePreference,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
