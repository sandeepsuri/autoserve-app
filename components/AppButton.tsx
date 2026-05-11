import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'destructive';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function AppButton({ label, onPress, variant = 'primary', style, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[typography.labelLg, textStyles[variant]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.45 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.surfaceBrand },
  accent: { backgroundColor: colors.surfaceAccent },
  secondary: { backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.borderStrong },
  ghost: { backgroundColor: 'transparent' },
  destructive: { backgroundColor: '#FEF2F2' },
});

const textStyles = StyleSheet.create({
  primary: { color: colors.textInverse },
  accent: { color: colors.textInverse },
  secondary: { color: colors.surfaceBrand },
  ghost: { color: colors.textSecondary },
  destructive: { color: colors.danger },
});
