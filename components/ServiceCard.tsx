import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Service } from '@/types/domain';
import { colors, spacing, typography } from '@/constants/theme';

import { AppCard } from './AppCard';

interface Props {
  service: Service;
  active?: boolean;
  onPress?: () => void;
}

export function ServiceCard({ service, active, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <AppCard style={[styles.card, active && styles.active]}>
        <Text style={typography.titleSm}>{service.title}</Text>
        <Text style={styles.meta}>{service.durationMinutes} mins</Text>
        <View style={styles.footer}>
          <Text style={styles.price}>${service.price}</Text>
          <Text style={styles.category}>{service.category}</Text>
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    minHeight: 132,
  },
  active: {
    borderColor: colors.surfaceBrand,
    backgroundColor: '#F6FBFF',
  },
  meta: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    ...typography.labelLg,
    color: colors.surfaceAccent,
  },
  category: {
    ...typography.caption,
    textTransform: 'capitalize',
    color: colors.textTertiary,
  },
});
