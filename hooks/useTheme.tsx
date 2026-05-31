import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors, lightColors, type ColorPalette } from '../constants/colors';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  colors: ColorPalette;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_KEY = 'theme_preference';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(THEME_KEY);
        if (saved === 'light' || saved === 'dark') {
          setThemeState(saved);
        } else {
          setThemeState(systemScheme === 'dark' ? 'dark' : 'light');
        }
      } catch {
        setThemeState(systemScheme === 'dark' ? 'dark' : 'light');
      }
    })();
  }, [systemScheme]);

  const setTheme = useCallback(async (t: Theme) => {
    setThemeState(t);
    try {
      await SecureStore.setItemAsync(THEME_KEY, t);
    } catch {}
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    try {
      await SecureStore.setItemAsync(THEME_KEY, next);
    } catch {}
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors: theme === 'dark' ? colors : lightColors,
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
