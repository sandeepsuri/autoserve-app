import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppTextField } from '@/components/AppTextField';
import { LocationPinMap } from '@/components/LocationPinMap';
import { OnboardingStepShell } from '@/components/onboarding/OnboardingStepShell';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { saveVendorOnboardingDraft } from '@/lib/vendor-onboarding';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';
import { VendorLocationMode } from '@/types/domain';

const DEFAULT_COORDS = { latitude: 34.0522, longitude: -118.2437 };

const MODES: { id: VendorLocationMode; label: string; description: string }[] = [
  {
    id: 'fixed',
    label: 'Fixed location',
    description: 'Customers come to your shop at one address.',
  },
  {
    id: 'mobile',
    label: 'Mobile service',
    description: 'You travel to customers. Set how far you go.',
  },
  {
    id: 'hybrid',
    label: 'Hybrid (shop + mobile)',
    description: 'Customers choose: visit your shop or have you come to them.',
  },
];

const isMobile = (m?: VendorLocationMode) => m === 'mobile' || m === 'hybrid';

export default function LocationStep() {
  const { draft, patchDraft } = useVendorOnboardingStore();
  const [locating, setLocating] = useState(false);

  const loc = draft?.location ?? {};
  const mode = loc.mode;
  const address = loc.address ?? '';
  const coords = loc.coordinates as { latitude: number; longitude: number } | undefined;
  const serviceRadius = loc.serviceRadiusMiles ?? 25;

  const hasCoords = typeof coords?.latitude === 'number' && typeof coords?.longitude === 'number';
  const hasAddress = Boolean(address.trim());
  const hasMode = Boolean(mode);
  const needsRadius = isMobile(mode);
  const canContinue = hasMode && hasAddress && hasCoords && (!needsRadius || serviceRadius > 0);

  // Seed map to a visible starting position when no coords exist yet.
  useEffect(() => {
    if (!hasCoords) {
      patchDraft({ location: { coordinates: DEFAULT_COORDS } });
    }
  }, []);

  const selectMode = (id: VendorLocationMode) => {
    patchDraft({
      location: {
        mode: id,
        serviceRadiusMiles: isMobile(id)
          ? (loc.serviceRadiusMiles ?? 25)
          : loc.serviceRadiusMiles,
      },
    });
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location access denied',
          "Couldn't access your location. Enter your address manually.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const newCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      const geocoded = await Location.reverseGeocodeAsync(newCoords);
      const geo = geocoded[0];
      const newAddress = geo
        ? [geo.streetNumber, geo.street, geo.city, geo.region, geo.postalCode]
            .filter(Boolean)
            .join(' ')
        : undefined;
      patchDraft({
        location: { coordinates: newCoords, ...(newAddress ? { address: newAddress } : {}) },
      });
    } catch {
      Alert.alert(
        'Location unavailable',
        "Couldn't fetch your location. Enter your address manually.",
      );
    } finally {
      setLocating(false);
    }
  };

  const handleAddressBlur = async () => {
    if (!address.trim()) return;
    try {
      const results = await Location.geocodeAsync(address);
      if (results.length) {
        patchDraft({
          location: {
            coordinates: { latitude: results[0].latitude, longitude: results[0].longitude },
          },
        });
      }
    } catch {
      // silent — user can drag the pin to correct position
    }
  };

  const handleContinue = async () => {
    await saveVendorOnboardingDraft({ location: loc });
  };

  const displayCoords = hasCoords ? coords! : DEFAULT_COORDS;

  return (
    <OnboardingStepShell
      stepId="location"
      title="Location & service area"
      subtitle="Tell clients where to find you and how far you'll travel for a job."
      canContinue={canContinue}
      onContinue={handleContinue}
    >
      {/* Mode picker */}
      <AppCard style={styles.card}>
        <SectionHeader title="How do you serve customers?" />
        {MODES.map(({ id, label, description }) => (
          <ModeOption
            key={id}
            label={label}
            description={description}
            selected={mode === id}
            onPress={() => selectMode(id)}
          />
        ))}
      </AppCard>

      {/* Address */}
      <AppCard style={styles.card}>
        <SectionHeader title={mode === 'mobile' ? 'Service base address' : 'Shop address'} />
        <AppTextField
          label="Address"
          required
          value={address}
          onChangeText={(text) => patchDraft({ location: { address: text } })}
          onBlur={handleAddressBlur}
          placeholder="e.g. 1234 Main St, Los Angeles, CA 90001"
          helperText="Customers will see this on your shop page."
        />
        <AppButton
          label={locating ? 'Locating…' : 'Use my current location'}
          variant="secondary"
          disabled={locating}
          onPress={handleUseCurrentLocation}
        />
      </AppCard>

      {/* Map pin */}
      <AppCard style={styles.card}>
        <SectionHeader title="Confirm your pin" />
        <LocationPinMap
          coords={displayCoords}
          radiusMiles={needsRadius && hasCoords ? serviceRadius : undefined}
          onDragEnd={(c) => patchDraft({ location: { coordinates: c } })}
        />
        <Text style={styles.pinLabel}>
          {hasCoords
            ? `Pin: ${coords!.latitude.toFixed(4)}, ${coords!.longitude.toFixed(4)}`
            : 'Move the pin to your location'}
        </Text>
        {Platform.OS !== 'web' ? (
          <Text style={styles.mapHelper}>Drag the pin to fine-tune your exact location.</Text>
        ) : null}
      </AppCard>

      {/* Radius — mobile/hybrid only */}
      {needsRadius ? (
        <AppCard style={styles.card}>
          <SectionHeader title="How far do you travel?" />
          <Text style={styles.radiusDisplay}>{serviceRadius} miles</Text>
          <View style={styles.stepperRow}>
            <AppButton
              label="− 5"
              variant="secondary"
              style={styles.stepperBtn}
              onPress={() =>
                patchDraft({ location: { serviceRadiusMiles: Math.max(5, serviceRadius - 5) } })
              }
            />
            <AppButton
              label="+ 5"
              variant="secondary"
              style={styles.stepperBtn}
              onPress={() =>
                patchDraft({ location: { serviceRadiusMiles: Math.min(100, serviceRadius + 5) } })
              }
            />
          </View>
          <Text style={styles.mapHelper}>
            We'll show your service area to nearby customers.
          </Text>
        </AppCard>
      ) : null}
    </OnboardingStepShell>
  );
}

function ModeOption({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.modeRow, selected && styles.modeRowSelected]}
      onPress={onPress}
    >
      <View style={styles.modeText}>
        <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>{label}</Text>
        <Text style={styles.modeDesc}>{description}</Text>
      </View>
      <View style={[styles.modeIndicator, selected && styles.modeIndicatorFilled]}>
        {selected ? <View style={styles.modeIndicatorDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  // Mode picker
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  modeRowSelected: {
    borderColor: colors.surfaceBrand,
    backgroundColor: '#EBF3FC',
  },
  modeText: {
    flex: 1,
    gap: spacing.xs,
  },
  modeLabel: {
    ...typography.labelMd,
    color: colors.textPrimary,
  },
  modeLabelSelected: {
    color: colors.surfaceBrand,
  },
  modeDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  modeIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIndicatorFilled: {
    borderColor: colors.surfaceBrand,
    backgroundColor: colors.surfaceBrand,
  },
  modeIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textInverse,
  },
  // Map
  pinLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  mapHelper: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  // Radius
  radiusDisplay: {
    ...typography.titleLg,
    color: colors.surfaceBrand,
    textAlign: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepperBtn: {
    flex: 1,
  },
});
