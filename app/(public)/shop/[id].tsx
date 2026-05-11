import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { MapPreview } from '@/components/MapPreview';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { ServiceCard } from '@/components/ServiceCard';
import { colors, spacing, typography } from '@/constants/theme';
import { getVendorDetail } from '@/lib/vendors';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const updateDraft = useBookingDraftStore((state) => state.updateDraft);

  const { data } = useQuery({
    queryKey: ['vendor-detail', id],
    queryFn: () => getVendorDetail(id),
  });

  const vendor = data?.vendor;
  if (!vendor) return null;

  return (
    <Screen>
      <AppHeader fallbackHref="/(public)/discover" />
      <Image source={vendor.heroImage} style={styles.hero} contentFit="cover" />
      <View style={styles.header}>
        <Text style={typography.titleLg}>{vendor.name}</Text>
        <Text style={styles.meta}>Top rated · ⭐ {vendor.rating} ({vendor.reviewCount} reviews)</Text>
        <Text style={styles.description}>{vendor.description}</Text>
      </View>

      <SectionHeader title="Our Services" actionLabel="View all" />
      <View style={styles.grid}>
        {data?.services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </View>

      <SectionHeader title="Location" />
      <MapPreview vendors={[vendor]} height={180} />
      <Text style={styles.address}>{vendor.address}</Text>

      <SectionHeader title="Availability" />
      <AppCard>
        {data?.availability.map((slot) => (
          <View key={slot.label} style={styles.availabilityRow}>
            <View>
              <Text style={typography.labelLg}>{slot.label}</Text>
              <Text style={styles.dateLabel}>{slot.date}</Text>
            </View>
            <Text style={styles.dateLabel}>{slot.times.join(' · ')}</Text>
          </View>
        ))}
      </AppCard>

      <SectionHeader title="Reviews" actionLabel="Read all" />
      {data?.reviews.map((review) => (
        <AppCard key={review.id}>
          <Text style={typography.labelLg}>{review.author}</Text>
          <Text style={styles.meta}>⭐ {review.rating}</Text>
          <Text style={styles.description}>{review.text}</Text>
        </AppCard>
      ))}

      <AppButton
        label="Book Appointment"
        variant="accent"
        onPress={() => {
          updateDraft({ vendorId: vendor.id });
          router.push('/(client)/vehicle/make');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    height: 240,
    borderRadius: 28,
  },
  header: {
    gap: spacing.sm,
  },
  meta: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  description: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  address: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dateLabel: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    maxWidth: '55%',
    textAlign: 'right',
  },
});
