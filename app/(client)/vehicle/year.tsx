import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { Screen } from '@/components/Screen';
import { years } from '@/constants/mock-data';
import { colors, spacing, typography } from '@/constants/theme';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

export default function VehicleYearScreen() {
  const router = useRouter();
  const updateDraft = useBookingDraftStore((state) => state.updateDraft);

  return (
    <Screen>
      <AppHeader title="Step 03 of 03" subtitle="Pick the model year, then confirm your vehicle." fallbackHref="/(client)/vehicle/model" />

      {years.map((year) => (
        <AppCard key={year} style={styles.card}>
          <Text style={typography.titleSm}>{year}</Text>
          <AppButton
            label="Use this year"
            variant="secondary"
            onPress={() => {
              updateDraft({ vehicleYear: year });
              router.push('/(client)/vehicle/confirm');
            }}
          />
        </AppCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  card: {
    gap: spacing.md,
  },
});
