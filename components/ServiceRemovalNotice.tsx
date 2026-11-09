import { StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

export function ServiceRemovalNotice({ message }: { message?: string }) {
  if (!message) return null;
  return <Text accessibilityLiveRegion="polite" style={styles.notice}>{message}</Text>;
}

const styles = StyleSheet.create({
  notice: {
    ...typography.caption,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceSubtleOrange,
    borderRadius: radius.sm,
    padding: spacing.md,
    overflow: 'hidden',
  },
});
