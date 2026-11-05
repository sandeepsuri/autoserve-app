import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { LocationStatusBanner } from '@/components/LocationStatusBanner';
import { MapPreview } from '@/components/MapPreview';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { VendorCard } from '@/components/VendorCard';
import { colors, spacing, typography } from '@/constants/theme';
import { DEFAULT_NEARBY_RADIUS_MILES, rankVendorsForClient } from '@/lib/discovery-location';
import { sanitizeText } from '@/lib/validation';
import { listVendors } from '@/lib/vendors';
import { useAuthStore } from '@/store/useAuthStore';
import { startClientLocationTracking, useClientLocationStore } from '@/store/useClientLocationStore';

interface Props {
  shopRoute?: string;
}

export function DiscoverScreen({ shopRoute = '/(public)/shop' }: Props) {
  const router = useRouter();
  const { session, guestMode, setPostAuthPath } = useAuthStore();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [query, setQuery] = useState('');
  const [mobileOnly, setMobileOnly] = useState(false);
  const [minimumRating, setMinimumRating] = useState(0);
  const [withinRadius, setWithinRadius] = useState(true);
  const clientCoords = useClientLocationStore((state) => state.coordinates);

  useFocusEffect(startClientLocationTracking);

  const { data: matchingVendors = [], error, isLoading } = useQuery({
    queryKey: ['vendors', query, mobileOnly, minimumRating],
    queryFn: () =>
      listVendors({
        query,
        mobileOnly,
        minimumRating,
        category: 'all',
      }),
  });

  const { vendors, outsideRadiusCount } = useMemo(
    () => rankVendorsForClient(matchingVendors, clientCoords, withinRadius ? DEFAULT_NEARBY_RADIUS_MILES : null),
    [matchingVendors, clientCoords, withinRadius],
  );
  const featuredVendor = vendors[0];

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={typography.titleLg}>Nearby service providers</Text>
          {session ? (
            <Pressable onPress={() => router.push('/(client)/profile')} hitSlop={12}>
              <Ionicons name="person-circle-outline" size={28} color={colors.textPrimary} />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.subtitle}>Search tires, oil changes, diagnostics, and mobile mechanics around you.</Text>
        {guestMode && !session ? (
          <View style={styles.guestTabs}>
            <View style={[styles.guestTab, styles.guestTabActive]}>
              <Text style={[styles.guestTabText, styles.guestTabTextActive]}>Guest</Text>
            </View>
            <Pressable
              onPress={() => {
                setPostAuthPath('/(client)');
                router.push('/(auth)');
              }}
              hitSlop={8}
              style={styles.guestTab}
            >
              <Text style={styles.guestTabText}>Log In</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <LocationStatusBanner />

      <TextInput
        value={query}
        onChangeText={(text) => setQuery(sanitizeText(text, 80))}
        placeholder="Search shops, services, or mobile mechanics"
        placeholderTextColor={colors.textTertiary}
        style={styles.search}
        maxLength={80}
      />

      <View style={styles.inline}>
        <FilterChip label="Map View" active={view === 'map'} onPress={() => setView('map')} />
        <FilterChip label="List View" active={view === 'list'} onPress={() => setView('list')} />
      </View>

      <View style={styles.inline}>
        <FilterChip label="Mobile Service" active={mobileOnly} onPress={() => setMobileOnly((value) => !value)} />
        <FilterChip label="Rating 4.5+" active={minimumRating === 4.5} onPress={() => setMinimumRating((value) => (value === 4.5 ? 0 : 4.5))} />
        {clientCoords ? (
          <FilterChip
            label={`Within ${DEFAULT_NEARBY_RADIUS_MILES} mi`}
            active={withinRadius}
            onPress={() => setWithinRadius((value) => !value)}
          />
        ) : null}
      </View>

      {view === 'map' ? <MapPreview vendors={vendors} clientCoords={clientCoords} /> : null}

      {featuredVendor && view === 'map' ? (
        <Pressable onPress={() => router.push(`${shopRoute}/${featuredVendor.id}` as never)}>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>{featuredVendor.name}</Text>
            <Text style={styles.previewMeta}>⭐ {featuredVendor.rating} · {featuredVendor.nextAvailable}</Text>
          </View>
        </Pressable>
      ) : null}

      <SectionHeader title="Available now" actionLabel={isLoading ? 'Loading...' : error ? 'Error' : `${vendors.length} results`} />

      {error ? (
        <EmptyState
          title="Could not load shops"
          body={error instanceof Error ? error.message : 'Supabase did not return vendor data for this build.'}
        />
      ) : vendors.length ? (
        vendors.map((vendor) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            distanceMiles={vendor.distanceFromClientMiles}
            onPress={() => router.push(`${shopRoute}/${vendor.id}` as never)}
            onBook={() => router.push(`${shopRoute}/${vendor.id}` as never)}
          />
        ))
      ) : outsideRadiusCount > 0 ? (
        <EmptyState
          title={`No shops within ${DEFAULT_NEARBY_RADIUS_MILES} mi`}
          body="There are shops further away. Show them all, sorted by distance."
          actionLabel="Show all shops"
          onAction={() => setWithinRadius(false)}
        />
      ) : (
        <EmptyState
          title="No shops match these filters"
          body="Try changing your search or turning off a filter to see more options."
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  guestTabs: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    padding: 3,
  },
  guestTab: {
    minHeight: 32,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  guestTabActive: {
    backgroundColor: colors.bgStrong,
  },
  guestTabText: {
    ...typography.labelMd,
    color: colors.surfaceBrand,
  },
  guestTabTextActive: {
    color: colors.textInverse,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  search: {
    backgroundColor: colors.bgElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textPrimary,
  },
  inline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  previewCard: {
    backgroundColor: colors.bgStrong,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  previewTitle: {
    ...typography.titleSm,
    color: colors.textInverse,
  },
  previewMeta: {
    ...typography.bodyMd,
    color: '#DBEAFE',
  },
});
