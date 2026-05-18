import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { listVehicleMakes } from '@/lib/vehicle-catalog';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

export default function VehicleMakeScreen() {
  const router = useRouter();
  const updateDraft = useBookingDraftStore((state) => state.updateDraft);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['vehicle-makes'],
    queryFn: listVehicleMakes,
  });

  return (
    <Screen>
      <AppHeader title="Step 01 of 03" subtitle="Select the vehicle make for this booking." fallbackHref="/(client)" />

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.surfaceAccent} />
      ) : isError ? (
        <EmptyState title="Couldn't load makes" body="Check your connection and try again." />
      ) : data && data.length === 0 ? (
        <EmptyState title="No makes available" body="No vehicle makes are available right now." />
      ) : (
        <View style={styles.grid}>
          {(data ?? []).map((make) => (
            <AppCard key={make.label} style={styles.gridCard}>
              <Text style={typography.titleSm}>{make.label}</Text>
              <AppButton
                label="Choose"
                variant="secondary"
                onPress={() => {
                  updateDraft({ vehicleMake: make.label, vehicleModel: undefined, vehicleYear: undefined });
                  router.push('/(client)/vehicle/model');
                }}
              />
            </AppCard>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridCard: {
    width: '47%',
    gap: spacing.md,
  },
});
