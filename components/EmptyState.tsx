import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from './AppButton';
import { AppCard } from './AppCard';
import { colors, spacing, typography } from '@/constants/theme';

interface Props {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, body, actionLabel, onAction }: Props) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.dot} />
      <Text style={typography.titleSm}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} variant="secondary" onPress={onAction} style={styles.action} />
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  dot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSubtleOrange,
  },
  action: {
    alignSelf: 'stretch',
  },
  body: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
});
