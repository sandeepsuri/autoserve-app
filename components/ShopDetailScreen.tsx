import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AllServicesSheet } from '@/components/AllServicesSheet';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { MapPreview } from '@/components/MapPreview';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { ServiceCard } from '@/components/ServiceCard';
import { colors, spacing, typography } from '@/constants/theme';
import { getVendorDetail } from '@/lib/vendors';
import { useAuthStore } from '@/store/useAuthStore';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

interface Props {
  fallbackHref?: string;
}

export function ShopDetailScreen({ fallbackHref = '/(public)/discover' }: Props) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { clearDraft, setSubmittedGuestBooking, updateDraft } = useBookingDraftStore();
  const { session, setGuestMode } = useAuthStore();
  const [sheetOpen, setSheetOpen] = useState(false);

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
        <AppHeader fallbackHref={fallbackHref as never} />
      </Screen>
    );
  }

  if (!vendor) {
    return (
      <Screen>
        <AppHeader fallbackHref={fallbackHref as never} />
        <EmptyState
          title="Shop unavailable"
          body="This shop is no longer listed. Head back to discover other providers nearby."
        />
      </Screen>
    );
  }

  const handleBook = () => {
    clearDraft();
    setSubmittedGuestBooking(null);
    // Seed a default booking mode at entry so the draft always carries a valid
    // mode, even if the service step's effect hasn't run yet (the user can still
    // change it there).
    updateDraft({ vendorId: vendor.id, bookingMode: 'shop' });
    if (session) {
      router.push('/(client)/booking/vehicle');
      return;
    }
    setGuestMode(true);
    router.push(`/(public)/guest-booking/${vendor.id}/details`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.fill} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppHeader fallbackHref={fallbackHref as never} />
        <Image source={vendor.heroImage} style={styles.hero} contentFit="cover" />
        <View style={styles.header}>
          <Text style={typography.titleLg}>{vendor.name}</Text>
          <Text style={styles.meta}>Top rated · ⭐ {vendor.rating} ({vendor.reviewCount} reviews)</Text>
          <Text style={styles.description}>{vendor.description}</Text>
        </View>

        <SectionHeader title="Our Services" actionLabel="View all" onActionPress={() => setSheetOpen(true)} />
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
          onPress={handleBook}
        />
      </View>

      <AllServicesSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        vendorName={vendor.name}
        mobileServiceEnabled={vendor.mobileServiceEnabled}
        services={data?.services ?? []}
        onBook={() => {
          setSheetOpen(false);
          handleBook();
        }}
      />
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
