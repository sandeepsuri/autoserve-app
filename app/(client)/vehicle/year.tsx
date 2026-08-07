import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { listVehicleYears } from '@/lib/vehicle-catalog';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

export default function VehicleYearScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useBookingDraftStore();
  const make = draft.vehicleMake;
  const model = draft.vehicleModel;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vehicle-years', make, model],
    queryFn: () => listVehicleYears(make!, model!),
    enabled: !!make && !!model,
  });

  if (!make || !model) {
    return (
      <Screen>
        <AppHeader title="Step 03 of 03" subtitle="Pick the model year, then confirm your vehicle." fallbackHref="/(client)/vehicle/model" />
        <EmptyState title="Missing vehicle info" body="Go back and choose a make and model first." />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Step 03 of 03" subtitle="Pick the model year, then confirm your vehicle." fallbackHref="/(client)/vehicle/model" />

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.surfaceAccent} />
      ) : isError ? (
        <EmptyState title="Couldn't load years" body="Check your connection and try again." />
      ) : data && data.length === 0 ? (
        <EmptyState title="No years available" body={`No years available for ${make} ${model}.`} />
      ) : (
        (data ?? []).map((year) => (
          <AppCard key={year.label} style={styles.card}>
            <Text style={typography.titleSm}>{year.label}</Text>
            <AppButton
              label="Use this year"
              variant="secondary"
              onPress={() => {
                updateDraft({ vehicleYear: year.label });
                router.push('/(client)/vehicle/confirm');
              }}
            />
          </AppCard>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: spacing.xl,
  },
  card: {
    gap: spacing.md,
  },
});
