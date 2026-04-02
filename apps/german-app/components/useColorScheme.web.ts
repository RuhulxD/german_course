import { useThemePreference } from '@/contexts/ThemePreferenceContext';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';

/**
 * Match native theme behavior. Default to `light` for the first paint so static/SSR HTML
 * matches the client before hydration (see Expo template notes in useClientOnlyValue.web).
 */
export function useColorScheme(): 'light' | 'dark' {
  const { colorScheme } = useThemePreference();
  return useClientOnlyValue<'light' | 'dark', 'light' | 'dark'>('light', colorScheme);
}
