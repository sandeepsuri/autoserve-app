import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { listVehicles } from '@/lib/vehicles';
import { useAuthStore } from '@/store/useAuthStore';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';
import { Vehicle } from '@/types/domain';

export default function BookingVehicleScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useBookingDraftStore();
  const { session, guestMode, guestClientId } = useAuthStore();
  const vehicleOwnerKey = session?.userId ?? guestClientId ?? 'anonymous';

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['client-vehicles', vehicleOwnerKey],
    queryFn: listVehicles,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (draft.vehicleId && vehicles.some((vehicle) => vehicle.id === draft.vehicleId)) {
      setSelectedId(draft.vehicleId);
    } else {
      const def = vehicles.find((v) => v.isDefault);
      setSelectedId(def?.id ?? null);
    }
  }, [draft.vehicleId, isLoading, vehicles, vehicleOwnerKey]);

  if (!session && !guestMode) {
    return (
      <Screen>
        <AppHeader title="Select vehicle" fallbackHref="/(client)" />
        <EmptyState
          title="Sign in to continue"
          body="You need to be signed in to select a vehicle and complete a booking."
        />
        <AppButton label="Sign In" variant="primary" onPress={() => router.push('/(auth)')} />
      </Screen>
    );
  }

  if (!draft.vendorId) {
    return (
      <Screen>
        <AppHeader fallbackHref="/(client)" />
        <EmptyState
          title="Select a vendor first"
          body="Start from a vendor page so we can carry their services into your booking."
        />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <AppHeader title="Select vehicle" fallbackHref="/(client)" />
        <ActivityIndicator size="large" color={colors.surfaceAccent} style={styles.loader} />
      </Screen>
    );
  }

  const handleContinue = () => {
    if (!selectedId) return;
    updateDraft({ vehicleId: selectedId });
    router.push('/(client)/booking/service');
  };

  if (vehicles.length === 0) {
    return (
      <Screen>
        <AppHeader
          title="Select vehicle"
          subtitle="You need a saved vehicle before booking."
          fallbackHref="/(client)"
        />
        <EmptyState
          title="No vehicles saved yet"
          body="Add your first vehicle and we'll bring you right back to complete the booking."
        />
        <AppButton
          label="Add a vehicle"
          variant="accent"
          onPress={() =>
            router.push({
              pathname: '/(client)/vehicle/garage-add',
              params: { returnTo: '/(client)/booking/vehicle' },
            })
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Select vehicle"
        subtitle="Choose the vehicle for this booking."
        fallbackHref="/(client)"
      />

      {vehicles.map((vehicle) => (
        <VehiclePickerRow
          key={vehicle.id}
          vehicle={vehicle}
          selected={selectedId === vehicle.id}
          onSelect={() => setSelectedId(vehicle.id)}
        />
      ))}

      <Pressable
        style={styles.addLink}
        onPress={() =>
          router.push({
            pathname: '/(client)/vehicle/garage-add',
            params: { returnTo: '/(client)/booking/vehicle' },
          })
        }
      >
        <Text style={styles.addLinkText}>+ Add new vehicle</Text>
      </Pressable>

      <AppButton
        label="Continue"
        variant="accent"
        disabled={!selectedId}
        onPress={handleContinue}
      />
    </Screen>
  );
}

interface PickerRowProps {
  vehicle: Vehicle;
  selected: boolean;
  onSelect: () => void;
}

function VehiclePickerRow({ vehicle, selected, onSelect }: PickerRowProps) {
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  return (
    <Pressable onPress={onSelect}>
      <AppCard style={selected ? styles.rowSelected : styles.row}>
        <View style={styles.rowInner}>
          <View style={styles.rowText}>
            <View style={styles.rowTitleRow}>
              <Text style={typography.titleSm} numberOfLines={1}>
                {vehicle.nickname ?? title}
              </Text>
              {vehicle.isDefault ? (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>Default</Text>
                </View>
              ) : null}
            </View>
            {vehicle.nickname ? <Text style={styles.sub}>{title}</Text> : null}
            {vehicle.color || vehicle.plate ? (
              <Text style={styles.meta}>
                {[vehicle.color, vehicle.plate].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
          <View style={[styles.radio, selected && styles.radioSelected]} />
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 80 },
  row: {},
  rowSelected: {
    borderColor: colors.surfaceBrand,
    borderWidth: 1.5,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowText: { flex: 1, gap: spacing.xs },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  sub: { ...typography.bodyMd, color: colors.textSecondary },
  meta: { ...typography.caption, color: colors.textTertiary },
  defaultBadge: {
    backgroundColor: colors.surfaceSubtleOrange,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  defaultBadgeText: {
    ...typography.caption,
    color: colors.surfaceAccent,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  radioSelected: {
    borderColor: colors.surfaceBrand,
    backgroundColor: colors.surfaceBrand,
  },
  addLink: {
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  addLinkText: {
    ...typography.labelMd,
    color: colors.surfaceBrand,
  },
});
