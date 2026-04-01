import { Platform } from 'react-native';

/** Published site for this repo (fallback when no env / non-web). */
export const DEFAULT_CONTENT_ORIGIN = 'https://RuhulxD.github.io/german_course';

/**
 * Resolve a repo-relative path (e.g. `lws/csv/book-1/1.csv`) to a fetchable URL.
 * - Web: relative paths resolve against the current origin + pathname (GitHub Pages subpath).
 * - Native: uses EXPO_PUBLIC_CONTENT_BASE_URL or DEFAULT_CONTENT_ORIGIN.
 */
export function contentUrl(relPath: string): string {
  const path = relPath.replace(/^\/+/, '');
  const envBase = process.env.EXPO_PUBLIC_CONTENT_BASE_URL?.replace(/\/$/, '');

  if (Platform.OS === 'web') {
    if (envBase) return `${envBase}/${path}`;
    if (typeof window !== 'undefined') {
      return path;
    }
    return `${DEFAULT_CONTENT_ORIGIN}/${path}`;
  }

  return `${envBase ?? DEFAULT_CONTENT_ORIGIN}/${path}`;
}

export function encodeRelPathForFetch(relPath: string): string {
  return relPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/** Like contentUrl but path segments are encoded (needed for filenames with spaces). */
export function contentUrlEncoded(relPath: string): string {
  const path = encodeRelPathForFetch(relPath.replace(/^\/+/, ''));
  const envBase = process.env.EXPO_PUBLIC_CONTENT_BASE_URL?.replace(/\/$/, '');

  if (Platform.OS === 'web') {
    if (envBase) return `${envBase}/${path}`;
    if (typeof window !== 'undefined') return path;
    return `${DEFAULT_CONTENT_ORIGIN}/${path}`;
  }

  return `${envBase ?? DEFAULT_CONTENT_ORIGIN}/${path}`;
}
