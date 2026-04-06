// ─── Colors ─────────────────────────────────────────────────────────────────
export const Colors = {
  // Core palette
  background: '#F6F4EF',
  surface: '#FFFFFF',
  surfaceInner: '#FAFAF7',

  // Text
  textPrimary: '#1C1B18',
  textSecondary: '#5C5A54',
  textTertiary: '#9C9A94',

  // Borders
  border: 'rgba(0,0,0,0.05)',

  // Accent (teal)
  primary: '#3A7C7C',
  primaryLight: '#E4F0F0',

  // AQI status
  aqiGood: '#3D8B5E',
  aqiGoodSoft: '#E6F2EB',
  aqiModerate: '#D4903A',
  aqiModerateSoft: '#FDF3E4',
  aqiSensitive: '#D46A2A',
  aqiSensitiveSoft: '#FDE9DB',
  aqiUnhealthy: '#C0453A',
  aqiUnhealthySoft: '#FDECEA',
  aqiVeryUnhealthy: '#9333EA',
  aqiVeryUnhealthySoft: '#F3E8FF',

  // WHO guideline line
  whoRed: '#C0453A',

  // Gradients
  gradientGood: ['#F6F4EF', '#EAF3EE'] as const,
  gradientModerate: ['#F6F4EF', '#FDF3E4'] as const,
  gradientSensitive: ['#F6F4EF', '#FDE9DB'] as const,
  gradientUnhealthy: ['#F6F4EF', '#FDECEA'] as const,
  gradientVeryUnhealthy: ['#F6F4EF', '#F3E8FF'] as const,
  gradientDefault: ['#F6F4EF', '#E4F0F0'] as const,

  // Legacy aliases (for other pages that haven't been redesigned yet)
  aiAccent: '#3A7C7C',
  aiAccentLight: '#E4F0F0',
  error: '#C0453A',
  success: '#3D8B5E',
  inputBorder: 'rgba(0,0,0,0.12)',
  inputBackground: '#FAFAF7',
} as const

// ─── Typography ──────────────────────────────────────────────────────────────
export const FontFamily = {
  // Fraunces — used for all numbers, headings, display
  serif: 'Fraunces_300Light',
  serifMedium: 'Fraunces_400Regular',
  serifSemiBold: 'Fraunces_500Medium',

  // DM Sans — used for labels, badges, UI
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
} as const

export const FontSize = {
  hero: 52,
  section: 26,
  title: 20,
  body: 18,
  bodySmall: 15,
  caption: 13,
  micro: 11,
  tiny: 9,
} as const

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

// ─── Border Radius ───────────────────────────────────────────────────────────
export const Radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 50,
  chip: 20,
} as const

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const Shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pill: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  subtle: {
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const

// ─── Gradients ───────────────────────────────────────────────────────────────
export const Gradients = {
  primaryButton: ['#3A7C7C', '#2E6363'] as const,
  aiButton: ['#3A7C7C', '#2E6363'] as const,
  heroExposure: ['#E4F0F0', '#F6F4EF'] as const,
} as const
