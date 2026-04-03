/** Teal-leaning accent — reads slightly greenish vs pure blue, still readable on white. */
const tint = '#0d9488';
const tintDark = '#5eead4';

/**
 * Shared palette — use `Colors[useColorScheme()]` in screens.
 * Light: near-white surfaces. Dark: soft gray (not OLED black).
 *
 * Hero gradients, flashcard faces, and status chips are defined here so every tab matches.
 */
const Colors = {
  light: {
    text: '#0f172a',
    textSecondary: '#475569',
    background: '#ffffff',
    backgroundElevated: '#f4faf9',
    tint,
    tabIconDefault: '#94a3b8',
    tabIconSelected: tint,
    border: '#e2e8f0',
    borderStrong: '#cbd5e1',
    muted: '#64748b',
    error: '#dc2626',
    accent: tint,
    accentMuted: 'rgba(13, 148, 136, 0.12)',
    markHighlight: 'rgba(254, 240, 138, 0.85)',
    tableHeaderBg: '#ecfdf8',
    linkOnAccent: '#ffffff',
    secondaryBtn: '#64748b',
    contrastBtn: '#1e293b',
    /** Hero headers / primary gradient CTAs (e.g. Flashcards) */
    heroGradient: ['#14b8a6', '#0f766e'] as const,
    heroOnGradient: '#ffffff',
    heroMutedOnGradient: 'rgba(255, 255, 255, 0.85)',
    /** Flashcard front / back faces */
    flashcardFrontBg: '#ccfbf1',
    flashcardFrontFg: '#115e59',
    flashcardBackBg: '#0f766e',
    flashcardBackFg: '#ffffff',
    /** Stat labels / accent text on normal surfaces */
    statusKnown: '#15803d',
    statusUnknown: '#b91c1c',
    statusReview: '#ca8a04',
    /** Filled chips (badges, mark buttons) — white label text */
    statusChipKnown: '#15803d',
    statusChipUnknown: '#b91c1c',
    statusChipReview: '#ca8a04',
    statusChipNeutral: '#64748b',
    /** Third-tier action chip (e.g. external links) */
    tertiaryBtn: '#334155',
    onTertiary: '#ffffff',
    /** Native `<select>` / Picker: explicit bg + fg so value/options stay readable */
    pickerSurface: '#ffffff',
    pickerForeground: '#0f172a',
  },
  dark: {
    text: '#f8fafc',
    textSecondary: '#c5cad3',
    background: '#363d3c',
    backgroundElevated: '#434a49',
    tint: tintDark,
    tabIconDefault: '#9ca3af',
    tabIconSelected: tintDark,
    border: '#5a6462',
    borderStrong: '#6b7674',
    muted: '#b8c5c2',
    error: '#fca5a5',
    accent: tintDark,
    accentMuted: 'rgba(45, 212, 191, 0.16)',
    markHighlight: 'rgba(253, 224, 71, 0.45)',
    tableHeaderBg: 'rgba(20, 184, 166, 0.12)',
    linkOnAccent: '#0f172a',
    secondaryBtn: '#64748b',
    contrastBtn: '#f1f5f9',
    heroGradient: ['#35554f', '#204038'] as const,
    heroOnGradient: '#f0fdfa',
    heroMutedOnGradient: 'rgba(240, 253, 250, 0.8)',
    flashcardFrontBg: '#1a3d37',
    flashcardFrontFg: '#99f6e4',
    flashcardBackBg: '#0f766e',
    flashcardBackFg: '#ffffff',
    statusKnown: '#4ade80',
    statusUnknown: '#f87171',
    statusReview: '#fbbf24',
    statusChipKnown: '#15803d',
    statusChipUnknown: '#b91c1c',
    statusChipReview: '#ca8a04',
    statusChipNeutral: '#64748b',
    tertiaryBtn: '#52525b',
    onTertiary: '#f8fafc',
    /** Light control on dark UI — avoids white text on system-white `<select>` (web) */
    pickerSurface: '#eef2f7',
    pickerForeground: '#0f172a',
  },
};

/** Keys safe for `useThemeColor` / Themed (string colors only — not gradients). */
export type ThemePaletteKey = Exclude<keyof (typeof Colors)['light'], 'heroGradient'>;

export default Colors;
