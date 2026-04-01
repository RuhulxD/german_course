import { useThemePreference } from '@/contexts/ThemePreferenceContext';

/** Effective color scheme (respects user light/dark/system preference). */
export function useColorScheme() {
  return useThemePreference().colorScheme;
}
