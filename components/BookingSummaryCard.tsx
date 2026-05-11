import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

import { AppCard } from './AppCard';

interface Props {
  title: string;
  rows: { label: string; value: string }[];
}

export function BookingSummaryCard({ title, rows }: Props) {
  return (
    <AppCard style={styles.card}>
      <Text style={typography.titleSm}>{title}</Text>
      {rows.map((row) => (
        <View style={styles.row} key={row.label}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  label: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  value: {
    ...typography.labelMd,
    color: colors.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },
});
