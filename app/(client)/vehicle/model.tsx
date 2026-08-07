import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { listVehicleModels } from '@/lib/vehicle-catalog';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

export default function VehicleModelScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useBookingDraftStore();
  const make = draft.vehicleMake;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vehicle-models', make],
    queryFn: () => listVehicleModels(make!),
    enabled: !!make,
  });

  if (!make) {
    return (
      <Screen>
        <AppHeader title="Step 02 of 03" subtitle="Choose a model." fallbackHref="/(client)/vehicle/make" />
        <EmptyState title="No make selected" body="Go back and choose a make first." />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Step 02 of 03" subtitle={`Choose the model for your ${make}.`} fallbackHref="/(client)/vehicle/make" />

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.surfaceAccent} />
      ) : isError ? (
        <EmptyState title="Couldn't load models" body="Check your connection and try again." />
      ) : data && data.length === 0 ? (
        <EmptyState title="No models available" body={`No models available for ${make}.`} />
      ) : (
        (data ?? []).map((model) => (
          <AppCard key={model.label} style={styles.card}>
            <Text style={typography.titleSm}>{model.label}</Text>
            <AppButton
              label="Select model"
              variant="secondary"
              onPress={() => {
                updateDraft({ vehicleModel: model.label, vehicleYear: undefined });
                router.push('/(client)/vehicle/year');
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
