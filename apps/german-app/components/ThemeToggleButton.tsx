import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable } from 'react-native';

import Colors from '@/constants/Colors';
import { useThemePreference } from '@/contexts/ThemePreferenceContext';

export function ThemeToggleButton() {
  const { preference, toggle, colorScheme } = useThemePreference();
  const color = Colors[colorScheme].text;

  const icon =
    preference === 'dark' ? 'moon-o' : preference === 'light' ? 'sun-o' : 'adjust';

  return (
    <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel="Toggle theme">
      {({ pressed }) => (
        <FontAwesome name={icon} size={22} color={color} style={{ opacity: pressed ? 0.5 : 1 }} />
      )}
    </Pressable>
  );
}
