import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { MapPreview } from '@/components/MapPreview';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { getVendorForOwner, updateVendorLocation } from '@/lib/vendor-admin';

export default function VendorLocationScreen() {
  const queryClient = useQueryClient();
  const { data: vendor } = useQuery({
    queryKey: ['vendor-self'],
    queryFn: getVendorForOwner,
  });

  const [radius, setRadius] = useState(vendor?.serviceRadiusMiles ?? 25);
  const [mobileEnabled, setMobileEnabled] = useState(vendor?.mobileServiceEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (vendor) {
      setRadius(vendor.serviceRadiusMiles ?? 25);
      setMobileEnabled(vendor.mobileServiceEnabled ?? false);
    }
  }, [vendor]);

  if (!vendor) return null;

  return (
    <Screen>
      <Text style={typography.titleLg}>Location setup</Text>
      <Text style={styles.subtitle}>Set your primary shop location and define how far your mobile service should travel.</Text>

      <MapPreview vendors={[vendor]} height={220} />

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Shop address</Text>
        <Text style={styles.subtitle}>{vendor.address}</Text>
        <AppButton
          label={mobileEnabled ? 'Disable mobile service' : 'Enable mobile service'}
          variant="secondary"
          onPress={() => setMobileEnabled((v) => !v)}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Service radius</Text>
        <Text style={styles.radius}>{radius} miles</Text>
        <View style={styles.actions}>
          <AppButton label="- 5" variant="secondary" style={styles.actionButton} onPress={() => setRadius((v) => Math.max(5, v - 5))} />
          <AppButton label="+ 5" variant="secondary" style={styles.actionButton} onPress={() => setRadius((v) => v + 5)} />
        </View>
      </AppCard>

      <AppButton
        label={saving ? 'Saving…' : 'Save Location'}
        variant="accent"
        disabled={saving}
        onPress={async () => {
          setSaving(true);
          setSaveError(null);
          try {
            await updateVendorLocation(vendor.id, {
              mobileServiceEnabled: mobileEnabled,
              serviceRadiusMiles: radius,
            });
            await queryClient.invalidateQueries({ queryKey: ['vendor-self'] });
          } catch {
            setSaveError('Save failed — check your connection and try again.');
          } finally {
            setSaving(false);
          }
        }}
      />
      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
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
  saveError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
});
