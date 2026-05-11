import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { Screen } from '@/components/Screen';
import { vehicleCatalog } from '@/constants/mock-data';
import { colors, spacing, typography } from '@/constants/theme';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

export default function VehicleModelScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useBookingDraftStore();
  const make = draft.vehicleMake ?? 'Tesla';
  const models = vehicleCatalog[make as keyof typeof vehicleCatalog] ?? [];

  return (
    <Screen>
      <AppHeader title="Step 02 of 03" subtitle={`Choose the model for your ${make}.`} fallbackHref="/(client)/vehicle/make" />

      {models.map((model) => (
        <AppCard key={model} style={styles.card}>
          <Text style={typography.titleSm}>{model}</Text>
          <AppButton
            label="Select model"
            variant="secondary"
            onPress={() => {
              updateDraft({ vehicleModel: model });
              router.push('/(client)/vehicle/year');
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
