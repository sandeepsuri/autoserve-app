import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { ServiceCard } from '@/components/ServiceCard';
import { colors, spacing, typography } from '@/constants/theme';
import { getVendorDetail } from '@/lib/vendors';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

export default function BookingServiceScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useBookingDraftStore();
  const { data } = useQuery({
    queryKey: ['booking-vendor-services', draft.vendorId],
    queryFn: () => getVendorDetail(draft.vendorId!),
    enabled: Boolean(draft.vendorId),
  });

  return (
    <Screen>
      <AppHeader title="1. Pick a service" subtitle="Choose the service you want before selecting a time slot." fallbackHref="/(client)/vehicle/confirm" />
      <SectionHeader title={data?.vendor?.name ?? 'Selected vendor'} />
      <View style={styles.grid}>
        {data?.services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            active={draft.serviceId === service.id}
            onPress={() => updateDraft({ serviceId: service.id })}
          />
        ))}
      </View>

      <AppButton label="Continue to Schedule" variant="accent" onPress={() => router.push('/(client)/booking/schedule')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
