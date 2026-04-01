import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName, useColorScheme as useSystemColorScheme } from 'react-native';

const STORAGE_KEY = 'themePreference';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  /** Resolved scheme used for UI. */
  colorScheme: NonNullable<ColorSchemeName>;
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

function resolveScheme(preference: ThemePreference, system: ColorSchemeName): NonNullable<ColorSchemeName> {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return system === 'dark' ? 'dark' : 'light';
}

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const system = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw === 'light' || raw === 'dark' || raw === 'system') {
          setPreferenceState(raw);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
    try {
      if (p === 'light') Appearance.setColorScheme?.('light');
      else if (p === 'dark') Appearance.setColorScheme?.('dark');
      else Appearance.setColorScheme?.(null);
    } catch {
      /* setColorScheme not available on all platforms */
    }
  }, []);

  const toggle = useCallback(() => {
    const next: ThemePreference =
      preference === 'system' ? 'dark' : preference === 'dark' ? 'light' : 'system';
    setPreference(next);
  }, [preference, setPreference]);

  const colorScheme = resolveScheme(preference, system);

  const value = useMemo(
    () => ({ preference, colorScheme, setPreference, toggle }),
    [preference, colorScheme, setPreference, toggle],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  return ctx;
}
