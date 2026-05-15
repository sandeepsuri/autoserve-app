import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
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
  const { clearDraft, updateDraft } = useBookingDraftStore();

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-detail', id],
    queryFn: () => getVendorDetail(id),
  });

  const vendor = data?.vendor ?? null;

  const { data: geocodedCoords } = useQuery({
    queryKey: ['vendor-address-geocode', vendor?.id, vendor?.address],
    queryFn: async () => {
      if (!vendor?.address) return null;
      try {
        const results = await Location.geocodeAsync(vendor.address);
        if (results.length) {
          return { latitude: results[0].latitude, longitude: results[0].longitude };
        }
      } catch {
        // Geocoding failed; return null so the map shows "unavailable".
      }
      return null;
    },
    enabled: Boolean(vendor?.address),
  });

  if (isLoading) {
    return (
      <Screen>
        <AppHeader fallbackHref="/(public)/discover" />
      </Screen>
    );
  }

  if (!vendor) {
    return (
      <Screen>
        <AppHeader fallbackHref="/(public)/discover" />
        <EmptyState
          title="Shop unavailable"
          body="This shop is no longer listed. Head back to discover other providers nearby."
        />
      </Screen>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.fill} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
        <MapPreview vendors={[vendor]} height={180} geocodedCoords={geocodedCoords ?? null} />
        <Text style={styles.address}>{vendor.address}</Text>

        {data?.businessHours && data.businessHours.length > 0 ? (
          <>
            <SectionHeader title="Business Hours" />
            <AppCard>
              {data.businessHours.map((row) => (
                <View key={row.day} style={styles.hoursRow}>
                  <Text style={typography.labelLg}>{row.day}</Text>
                  <Text style={styles.hoursValue}>{row.hours}</Text>
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        <SectionHeader title="Reviews" actionLabel="Read all" />
        {data?.reviews.map((review) => (
          <AppCard key={review.id}>
            <Text style={typography.labelLg}>{review.author}</Text>
            <Text style={styles.meta}>⭐ {review.rating}</Text>
            <Text style={styles.description}>{review.text}</Text>
          </AppCard>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          label="Book Appointment"
          variant="accent"
          onPress={() => {
            clearDraft();
            updateDraft({ vendorId: vendor.id });
            router.push('/(client)/vehicle/make');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  fill: {
    flex: 1,
  },
  scroll: {
    padding: spacing.page,
    gap: spacing.xl,
  },
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
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  hoursValue: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  footer: {
    backgroundColor: colors.bgBase,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    padding: spacing.lg,
  },
});
