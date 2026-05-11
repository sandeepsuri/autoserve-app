import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { MapPreview } from '@/components/MapPreview';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { updateVendorLocation } from '@/lib/vendor-admin';
import { useDemoDataStore } from '@/store/useDemoDataStore';

export default function VendorLocationScreen() {
  const vendor = useDemoDataStore((state) => state.vendors[0]);
  const [radius, setRadius] = useState(vendor?.serviceRadiusMiles ?? 25);
  const [mobileEnabled, setMobileEnabled] = useState(vendor?.mobileServiceEnabled ?? true);

  if (!vendor) return null;

  return (
    <Screen>
      <Text style={typography.titleLg}>Location setup</Text>
      <Text style={styles.subtitle}>Set your primary shop location and define how far your mobile service should travel.</Text>

      <MapPreview vendors={[vendor]} height={220} />

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Shop address</Text>
        <Text style={styles.subtitle}>{vendor.address}</Text>
        <AppButton label={mobileEnabled ? 'Disable mobile service' : 'Enable mobile service'} variant="secondary" onPress={() => setMobileEnabled((value) => !value)} />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Service radius</Text>
        <Text style={styles.radius}>{radius} miles</Text>
        <View style={styles.actions}>
          <AppButton label="- 5" variant="secondary" style={styles.actionButton} onPress={() => setRadius((value) => Math.max(5, value - 5))} />
          <AppButton label="+ 5" variant="secondary" style={styles.actionButton} onPress={() => setRadius((value) => value + 5)} />
        </View>
      </AppCard>

      <AppButton
        label="Save Location"
        variant="accent"
        onPress={async () => {
          await updateVendorLocation(vendor.id, {
            mobileServiceEnabled: mobileEnabled,
            serviceRadiusMiles: radius,
          });
        }}
      />
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
  radius: {
    ...typography.titleLg,
    color: colors.surfaceBrand,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
