import { StyleSheet } from 'react-native';

export const colors = {
  bgBase: '#F8FAFC',
  bgElevated: '#FFFFFF',
  bgStrong: '#0B1220',
  surfaceBrand: '#0F4C81',
  surfaceSuccess: '#10B981',
  surfaceAccent: '#FF7A1A',
  surfaceSubtleGreen: '#ECFDF5',
  surfaceSubtleOrange: '#FFF7ED',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',
  borderDefault: '#E2E8F0',
  borderStrong: '#CBD5E1',
  pending: '#C2410C',
  completed: '#047857',
  info: '#1D4ED8',
  danger: '#B91C1C',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
  page: 20,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 28,
  full: 999,
} as const;

export const typography = StyleSheet.create({
  displayLg: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 44,
    lineHeight: 46,
    color: colors.textPrimary,
  },
  displayMd: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 34,
    lineHeight: 37,
    color: colors.textPrimary,
  },
  titleLg: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    lineHeight: 32,
    color: colors.textPrimary,
  },
  titleMd: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  titleSm: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  bodyLg: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 16,
    lineHeight: 23,
    color: colors.textPrimary,
  },
  bodyMd: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  labelLg: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  labelMd: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  caption: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 15,
    color: colors.textTertiary,
  },
});

export const shadows = StyleSheet.create({
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
});
