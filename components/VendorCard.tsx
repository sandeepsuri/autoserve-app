import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VendorSummary } from '@/types/domain';
import { colors, radius, spacing, typography } from '@/constants/theme';

import { AppButton } from './AppButton';
import { AppCard } from './AppCard';

interface Props {
  vendor: VendorSummary;
  onPress?: () => void;
  onBook?: () => void;
}

export function VendorCard({ vendor, onPress, onBook }: Props) {
  return (
    <Pressable onPress={onPress}>
      <AppCard style={styles.card}>
        <Image source={vendor.heroImage} style={styles.image} contentFit="cover" />
        <View style={styles.content}>
          {vendor.mobileServiceEnabled ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Mobile Service Available</Text>
            </View>
          ) : null}
          <Text style={typography.titleSm}>{vendor.name}</Text>
          <Text style={styles.meta}>⭐ {vendor.rating.toFixed(1)} · {vendor.distanceMiles.toFixed(1)} mi away</Text>
          <Text style={styles.description}>{vendor.description}</Text>
          <AppButton label="Book Service" variant="primary" onPress={onBook} />
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    padding: 0,
  },
  image: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceSubtleOrange,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  badgeText: {
    ...typography.caption,
    color: colors.surfaceAccent,
  },
  meta: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  description: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
});
