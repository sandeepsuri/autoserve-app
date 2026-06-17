import * as Location from 'expo-location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppTextField } from '@/components/AppTextField';
import { LocationPinMap } from '@/components/LocationPinMap';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { clampLength } from '@/lib/validation';
import { getVendorForOwner, updateVendorLocation } from '@/lib/vendor-admin';
import { useAuthStore } from '@/store/useAuthStore';

export default function VendorLocationScreen() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((state) => state.session?.userId);
  const { data: vendor } = useQuery({
    queryKey: ['vendor-self', ownerId],
    queryFn: getVendorForOwner,
    enabled: Boolean(ownerId),
  });

  const [radius, setRadius] = useState(vendor?.serviceRadiusMiles ?? 25);
  const [mobileEnabled, setMobileEnabled] = useState(vendor?.mobileServiceEnabled ?? false);
  const [address, setAddress] = useState(vendor?.address ?? '');
  const [coords, setCoords] = useState(vendor?.coordinates ?? null as { latitude: number; longitude: number } | null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (vendor) {
      setRadius(vendor.serviceRadiusMiles ?? 25);
      setMobileEnabled(vendor.mobileServiceEnabled ?? false);
      setAddress(vendor.address ?? '');
      setCoords(vendor.coordinates);
    }
  }, [vendor]);

  const handleAddressBlur = async () => {
    if (!address.trim()) return;
    try {
      const results = await Location.geocodeAsync(address);
      if (results.length) {
        setCoords({ latitude: results[0].latitude, longitude: results[0].longitude });
        setGeocodeError(null);
      } else {
        setGeocodeError("Couldn't locate this address. Drag the pin to your exact location.");
      }
    } catch {
      setGeocodeError("Couldn't locate this address. Drag the pin to your exact location.");
    }
  };

  if (!vendor) return null;

  return (
    <Screen>
      <Text style={typography.titleLg}>Location setup</Text>
      <Text style={styles.subtitle}>Set your primary shop location and define how far your mobile service should travel.</Text>

      <AppCard style={styles.card}>
        <SectionHeader title="Shop address" />
        <AppTextField
          label="Address"
          required
          value={address}
          onChangeText={(text) => {
            setAddress(clampLength(text.replace(/[<>]/g, ''), 120));
            setGeocodeError(null);
          }}
          onBlur={handleAddressBlur}
          placeholder="e.g. 1234 Main St, Los Angeles, CA 90001"
          helperText="Type an address and the pin will update automatically."
          maxLength={120}
          errorText={geocodeError ?? undefined}
        />
      </AppCard>

      {coords ? (
        <AppCard style={styles.card}>
          <SectionHeader title="Confirm your pin" />
          <LocationPinMap
            coords={coords}
            onDragEnd={(c) => setCoords(c)}
          />
          <Text style={styles.pinLabel}>
            {`Pin: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`}
          </Text>
        </AppCard>
      ) : null}

      <AppCard style={styles.card}>
        <Text style={typography.titleSm}>Mobile service</Text>
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
          <AppButton label="+ 5" variant="secondary" style={styles.actionButton} onPress={() => setRadius((v) => Math.min(100, v + 5))} />
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
              address,
              coordinates: coords ?? vendor.coordinates,
              mobileServiceEnabled: mobileEnabled,
              serviceRadiusMiles: radius,
            });
            await queryClient.invalidateQueries({ queryKey: ['vendor-self', ownerId] });
            await queryClient.invalidateQueries({ queryKey: ['vendor-detail', vendor.id] });
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
  pinLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  saveError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
});
