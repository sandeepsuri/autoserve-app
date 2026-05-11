import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from './AppCard';
import { colors, spacing, typography } from '@/constants/theme';

interface Props {
  title: string;
  body: string;
}

export function EmptyState({ title, body }: Props) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.dot} />
      <Text style={typography.titleSm}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
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
  body: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
});
