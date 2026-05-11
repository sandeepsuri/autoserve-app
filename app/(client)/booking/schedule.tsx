import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { FilterChip } from '@/components/FilterChip';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { getVendorDetail } from '@/lib/vendors';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

export default function BookingScheduleScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useBookingDraftStore();
  const { data } = useQuery({
    queryKey: ['booking-vendor-availability', draft.vendorId],
    queryFn: () => getVendorDetail(draft.vendorId!),
    enabled: Boolean(draft.vendorId),
  });

  return (
    <Screen>
      <AppHeader title="2. Pick time and fulfillment" subtitle="Stay in-shop or have a mobile mechanic come to you when available." fallbackHref="/(client)/booking/service" />

      <View style={styles.inline}>
        <FilterChip label="At the shop" active={(draft.bookingMode ?? 'shop') === 'shop'} onPress={() => updateDraft({ bookingMode: 'shop' })} />
        <FilterChip label="Mobile service" active={draft.bookingMode === 'mobile'} onPress={() => updateDraft({ bookingMode: 'mobile', mobileAddress: 'Current location' })} />
      </View>

      {data?.availability.map((slot) => (
        <AppCard key={slot.label} style={styles.card}>
          <Text style={typography.titleSm}>{slot.label}</Text>
          <View style={styles.inline}>
            {slot.times.map((time) => (
              <FilterChip
                key={time}
                label={time}
                active={draft.scheduledTime === time}
                onPress={() => updateDraft({ scheduledDate: slot.label, scheduledTime: time })}
              />
            ))}
          </View>
        </AppCard>
      ))}

      <AppButton label="Review Booking" variant="accent" onPress={() => router.push('/(client)/booking/review')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  inline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
});
