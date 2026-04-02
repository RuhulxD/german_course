import { Alert, Platform } from 'react-native';

/** `Alert.alert` is easy to miss on web; use a visible dialog everywhere. */
export function uiAlert(title: string, message?: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
