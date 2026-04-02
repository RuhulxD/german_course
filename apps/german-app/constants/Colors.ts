const tint = '#2f95dc';
const tintDark = '#7ec8ff';

/**
 * Shared palette — use `Colors[useColorScheme()]` in screens.
 */
const Colors = {
  light: {
    text: '#111827',
    textSecondary: '#4b5563',
    background: '#f2f4f8',
    backgroundElevated: '#ffffff',
    tint,
    tabIconDefault: '#9ca3af',
    tabIconSelected: tint,
    border: '#e5e7eb',
    borderStrong: '#d1d5db',
    muted: '#6b7280',
    error: '#b91c1c',
    accent: tint,
    accentMuted: 'rgba(47, 149, 220, 0.12)',
    markHighlight: 'rgba(253, 224, 71, 0.55)',
    tableHeaderBg: 'rgba(0, 0, 0, 0.04)',
    linkOnAccent: '#ffffff',
    secondaryBtn: '#64748b',
    contrastBtn: '#1e293b',
  },
  dark: {
    text: '#f4f4f5',
    textSecondary: '#a1a1aa',
    background: '#09090b',
    backgroundElevated: '#18181b',
    tint: tintDark,
    tabIconDefault: '#71717a',
    tabIconSelected: tintDark,
    border: '#3f3f46',
    borderStrong: '#52525b',
    muted: '#a1a1aa',
    error: '#f87171',
    accent: tintDark,
    accentMuted: 'rgba(126, 200, 255, 0.12)',
    markHighlight: 'rgba(250, 204, 21, 0.35)',
    tableHeaderBg: 'rgba(255, 255, 255, 0.06)',
    linkOnAccent: '#ffffff',
    secondaryBtn: '#64748b',
    contrastBtn: '#e4e4e7',
  },
};

export default Colors;
