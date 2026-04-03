import { Platform, type TextStyle } from 'react-native';

import Colors from '@/constants/Colors';

/**
 * Picker / `<select>` styling: explicit surface + label color so selected value and
 * `<option>` rows stay readable (especially on web, where system defaults fight theme).
 */
export function pickerChrome(colorScheme: 'light' | 'dark') {
  const c = Colors[colorScheme];
  const base = {
    color: c.pickerForeground,
    backgroundColor: c.pickerSurface,
  };
  const web =
    Platform.OS === 'web'
      ? ({ colorScheme: 'light' } as Record<string, string>)
      : {};
  return {
    style: [base, web],
    itemColor: c.pickerForeground,
    itemStyle: { color: c.pickerForeground } satisfies TextStyle,
    dropdownIconColor: c.pickerForeground,
  };
}
