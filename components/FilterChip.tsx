import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

interface Props {
  label: string;
  active?: boolean;
  onPress?: () => void;
  count?: number;
}

export function FilterChip({ label, active, onPress, count }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.active : styles.inactive]}>
      <Text style={[typography.labelMd, active ? styles.activeText : styles.inactiveText]}>{label}</Text>
      {count !== undefined && (
        <View style={[styles.badge, active ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={[styles.badgeText, active ? styles.badgeTextActive : styles.badgeTextInactive]}>
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  badgeInactive: {
    backgroundColor: 'rgba(15,23,42,0.07)',
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
  },
  badgeTextActive: {
    color: colors.textInverse,
  },
  badgeTextInactive: {
    color: colors.textSecondary,
  },
});
