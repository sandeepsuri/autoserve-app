import { StyleSheet, Text } from 'react-native';

import { AppCard } from './AppCard';
import { colors, typography } from '@/constants/theme';

interface Props {
  label: string;
  value: string;
  helper?: string;
}

export function StatCard({ label, value, helper }: Props) {
  return (
    <AppCard style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={typography.titleLg}>{value}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  helper: {
    ...typography.caption,
    color: colors.surfaceSuccess,
    marginTop: 6,
  },
});
