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
    <Pressable onPress={onPress} style={styles.wrapper}>
      <AppCard style={[styles.card, active && styles.active]}>
        <Text style={typography.titleSm} numberOfLines={2}>{service.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{service.durationMinutes} mins</Text>
        <View style={styles.footer}>
          <Text style={styles.price} numberOfLines={1}>${service.price}</Text>
          <Text style={styles.category} numberOfLines={1}>{service.category}</Text>
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexBasis: '30%',
    flexGrow: 0,
    minWidth: 0,
  },
  card: {
    flex: 1,
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
    gap: spacing.xs,
  },
  price: {
    ...typography.labelLg,
    color: colors.surfaceAccent,
    flexShrink: 0,
  },
  category: {
    ...typography.caption,
    textTransform: 'capitalize',
    color: colors.textTertiary,
    flexShrink: 1,
    textAlign: 'right',
  },
});
