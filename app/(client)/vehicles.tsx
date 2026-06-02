import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { listVehicles, removeVehicle, setDefaultVehicle } from '@/lib/vehicles';
import { useAuthStore } from '@/store/useAuthStore';
import { Vehicle } from '@/types/domain';

export default function ClientVehiclesScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session, guestMode, guestClientId } = useAuthStore();
  const vehicleOwnerKey = session?.userId ?? guestClientId ?? 'anonymous';

  const {
    data: vehicles = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['client-vehicles', vehicleOwnerKey],
    queryFn: listVehicles,
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => setDefaultVehicle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-vehicles'] }),
    onError: (err) => Alert.alert('Error', err instanceof Error ? err.message : 'Failed to set default vehicle'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeVehicle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-vehicles'] }),
    onError: (err) => Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove vehicle'),
  });

  const handleDelete = (vehicle: Vehicle) => {
    Alert.alert(
      'Remove vehicle',
      `Remove ${vehicle.year} ${vehicle.make} ${vehicle.model} from your garage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMutation.mutate(vehicle.id),
        },
      ],
    );
  };

  if (!session && !guestMode) {
    return (
      <Screen>
        <Text style={typography.titleLg}>My Garage</Text>
        <EmptyState
          title="Sign in to manage your vehicles"
          body="Create an account or sign in to save your vehicles and streamline future bookings."
        />
        <AppButton
          label="Sign In"
          variant="primary"
          onPress={() => router.push('/(auth)')}
        />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <ActivityIndicator size="large" color={colors.surfaceAccent} style={styles.loader} />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.surfaceAccent} />
      }
    >
      <View style={styles.heading}>
        <Text style={typography.titleLg}>My Garage</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/(client)/vehicle/garage-add')}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </Pressable>
      </View>

      <Text style={styles.subtitle}>Saved vehicles for faster booking.</Text>

      {vehicles.length === 0 ? (
        <EmptyState
          title="No vehicles saved"
          body="Add your first vehicle so AutoServe can match you to the right services and speeds up checkout."
        />
      ) : (
        vehicles.map((vehicle) => (
          <VehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            onEdit={() =>
              router.push({
                pathname: '/(client)/vehicle/garage-edit',
                params: { vehicleId: vehicle.id },
              })
            }
            onDelete={() => handleDelete(vehicle)}
            onSetDefault={() => setDefaultMutation.mutate(vehicle.id)}
            isSettingDefault={setDefaultMutation.isPending && setDefaultMutation.variables === vehicle.id}
          />
        ))
      )}

      {vehicles.length === 0 ? (
        <AppButton
          label="Add your first vehicle"
          variant="accent"
          onPress={() => router.push('/(client)/vehicle/garage-add')}
        />
      ) : null}
    </Screen>
  );
}

interface VehicleCardProps {
  vehicle: Vehicle;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  isSettingDefault: boolean;
}

function VehicleCard({ vehicle, onEdit, onDelete, onSetDefault, isSettingDefault }: VehicleCardProps) {
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  return (
    <AppCard style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleRow}>
          <Text style={typography.titleSm} numberOfLines={1}>
            {vehicle.nickname ? vehicle.nickname : title}
          </Text>
          {vehicle.isDefault ? (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          ) : null}
        </View>

        {vehicle.nickname ? (
          <Text style={styles.vehicleSubtitle}>{title}</Text>
        ) : null}

        {vehicle.color || vehicle.plate ? (
          <View style={styles.metaRow}>
            {vehicle.color ? <Text style={styles.meta}>{vehicle.color}</Text> : null}
            {vehicle.color && vehicle.plate ? <Text style={styles.metaDot}> · </Text> : null}
            {vehicle.plate ? <Text style={styles.meta}>{vehicle.plate}</Text> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {!vehicle.isDefault ? (
          <Pressable
            style={[styles.actionChip, styles.actionChipDefault]}
            onPress={onSetDefault}
            disabled={isSettingDefault}
          >
            <Text style={styles.actionChipDefaultText}>
              {isSettingDefault ? 'Setting…' : 'Set as default'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable style={[styles.actionChip, styles.actionChipEdit]} onPress={onEdit}>
          <Text style={styles.actionChipEditText}>Edit</Text>
        </Pressable>

        <Pressable style={[styles.actionChip, styles.actionChipDelete]} onPress={onDelete}>
          <Text style={styles.actionChipDeleteText}>Remove</Text>
        </Pressable>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 80,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addButton: {
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
  },
  addButtonText: {
    ...typography.labelMd,
    color: colors.surfaceBrand,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  card: {
    gap: spacing.md,
  },
  cardTop: {
    gap: spacing.xs,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  vehicleSubtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaDot: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  meta: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  actionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  actionChipDefault: {
    borderColor: colors.surfaceBrand,
    backgroundColor: colors.bgElevated,
  },
  actionChipDefaultText: {
    ...typography.caption,
    color: colors.surfaceBrand,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  actionChipEdit: {
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
  },
  actionChipEditText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  actionChipDelete: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  actionChipDeleteText: {
    ...typography.caption,
    color: colors.danger,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
