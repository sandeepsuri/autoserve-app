import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

interface Props {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function FilterChip({ label, active, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.active : styles.inactive]}>
      <Text style={[typography.labelMd, active ? styles.activeText : styles.inactiveText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  active: {
    backgroundColor: colors.bgStrong,
    borderColor: colors.bgStrong,
  },
  inactive: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderDefault,
  },
  activeText: { color: colors.textInverse },
  inactiveText: { color: colors.textSecondary },
});
