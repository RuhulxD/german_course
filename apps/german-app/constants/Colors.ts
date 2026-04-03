const tint = '#2563eb';
const tintDark = '#93c5fd';

/**
 * Shared palette — use `Colors[useColorScheme()]` in screens.
 * Light: near-white surfaces. Dark: soft gray (not OLED black).
 */
const Colors = {
  light: {
    text: '#0f172a',
    textSecondary: '#475569',
    background: '#ffffff',
    backgroundElevated: '#f8fafc',
    tint,
    tabIconDefault: '#94a3b8',
    tabIconSelected: tint,
    border: '#e2e8f0',
    borderStrong: '#cbd5e1',
    muted: '#64748b',
    error: '#dc2626',
    accent: tint,
    accentMuted: 'rgba(37, 99, 235, 0.1)',
    markHighlight: 'rgba(254, 240, 138, 0.85)',
    tableHeaderBg: '#f1f5f9',
    linkOnAccent: '#ffffff',
    secondaryBtn: '#64748b',
    contrastBtn: '#1e293b',
    /** Native `<select>` / Picker: explicit bg + fg so value/options stay readable */
    pickerSurface: '#ffffff',
    pickerForeground: '#0f172a',
  },
  dark: {
    text: '#f8fafc',
    textSecondary: '#c5cad3',
    background: '#383c44',
    backgroundElevated: '#454a54',
    tint: tintDark,
    tabIconDefault: '#9ca3af',
    tabIconSelected: tintDark,
    border: '#5c626c',
    borderStrong: '#6b7280',
    muted: '#b8bec8',
    error: '#fca5a5',
    accent: tintDark,
    accentMuted: 'rgba(147, 197, 253, 0.18)',
    markHighlight: 'rgba(253, 224, 71, 0.45)',
    tableHeaderBg: 'rgba(255, 255, 255, 0.1)',
    linkOnAccent: '#0f172a',
    secondaryBtn: '#64748b',
    contrastBtn: '#f1f5f9',
    /** Light control on dark UI — avoids white text on system-white `<select>` (web) */
    pickerSurface: '#eef2f7',
    pickerForeground: '#0f172a',
  },
};

export default Colors;
