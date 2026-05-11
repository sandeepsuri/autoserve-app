import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { Screen } from '@/components/Screen';
import { vehicleCatalog } from '@/constants/mock-data';
import { colors, spacing, typography } from '@/constants/theme';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

export default function VehicleMakeScreen() {
  const router = useRouter();
  const updateDraft = useBookingDraftStore((state) => state.updateDraft);

  return (
    <Screen>
      <AppHeader title="Step 01 of 03" subtitle="Select the vehicle make for this booking." fallbackHref="/(public)/discover" />

      <View style={styles.grid}>
        {Object.keys(vehicleCatalog).map((make) => (
          <AppCard key={make} style={styles.gridCard}>
            <Text style={typography.titleSm}>{make}</Text>
            <AppButton
              label="Choose"
              variant="secondary"
              onPress={() => {
                updateDraft({ vehicleMake: make, vehicleModel: undefined, vehicleYear: undefined });
                router.push('/(client)/vehicle/model');
              }}
            />
          </AppCard>
        ))}
      </View>
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
  gridCard: {
    width: '47%',
    gap: spacing.md,
  },
});
