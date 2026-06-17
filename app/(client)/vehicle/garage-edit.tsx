import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SearchablePicker } from '@/components/SearchablePicker';
import { colors } from '@/constants/theme';
import { listVehicleMakes, listVehicleModels, listVehicleYears } from '@/lib/vehicle-catalog';
import { getVehicleById, updateVehicle } from '@/lib/vehicles';
import { clampLength } from '@/lib/validation';

interface FormErrors {
  make?: string;
  model?: string;
  year?: string;
}

function validate(make: string, model: string, year: string): FormErrors {
  const errors: FormErrors = {};
  if (!make.trim()) errors.make = 'Make is required';
  if (!model.trim()) errors.model = 'Model is required';
  if (!year.trim()) {
    errors.year = 'Year is required';
  } else if (!/^\d{4}$/.test(year.trim())) {
    errors.year = 'Year must be 4 digits (e.g. 2020)';
  } else {
    const y = parseInt(year, 10);
    const currentYear = new Date().getFullYear();
    if (y < 1900 || y > currentYear + 2) {
      errors.year = `Year must be between 1900 and ${currentYear + 2}`;
    }
  }
  return errors;
}

export default function GarageEditScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['client-vehicle', vehicleId],
    queryFn: () => getVehicleById(vehicleId!),
    enabled: Boolean(vehicleId),
  });

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [nickname, setNickname] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState({ make: false, model: false, year: false });
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (vehicle && !initialised) {
      setMake(vehicle.make);
      setModel(vehicle.model);
      setYear(vehicle.year);
      setNickname(vehicle.nickname ?? '');
      setColor(vehicle.color ?? '');
      setPlate(vehicle.plate ?? '');
      setInitialised(true);
    }
  }, [vehicle, initialised]);

  // ─── Catalog queries ────────────────────────────────────────────────────────

  const { data: makes = [], isLoading: makesLoading } = useQuery({
    queryKey: ['vehicle-makes'],
    queryFn: listVehicleMakes,
  });

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['vehicle-models', make],
    queryFn: () => listVehicleModels(make),
    enabled: make.trim().length > 0,
  });

  const { data: years = [], isLoading: yearsLoading } = useQuery({
    queryKey: ['vehicle-years', make, model],
    queryFn: () => listVehicleYears(make, model),
    enabled: make.trim().length > 0 && model.trim().length > 0,
  });

  // ─── Cascade ────────────────────────────────────────────────────────────────

  const updateValidation = (next: Partial<{ make: string; model: string; year: string }>) => {
    setErrors(validate(next.make ?? make, next.model ?? model, next.year ?? year));
  };

  const handleMakeChange = (val: string) => {
    setMake(val);
    setModel('');
    setYear('');
    updateValidation({ make: val, model: '', year: '' });
  };

  const handleModelChange = (val: string) => {
    setModel(val);
    setYear('');
    updateValidation({ model: val, year: '' });
  };

  const handleYearChange = (val: string) => {
    setYear(val);
    updateValidation({ year: val });
  };

  // ─── Save ────────────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: () =>
      updateVehicle(vehicleId!, {
        make: make.trim(),
        model: model.trim(),
        year: year.trim(),
        nickname: nickname.trim() || undefined,
        color: color.trim() || undefined,
        plate: plate.trim() || undefined,
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['client-vehicles'] }),
        qc.invalidateQueries({ queryKey: ['client-vehicle', vehicleId] }),
      ]);
      router.replace('/(client)/vehicles');
    },
    onError: (err) => {
      Alert.alert('Could not save changes', err instanceof Error ? err.message : String(err));
    },
  });

  const handleSave = () => {
    const allTouched = { make: true, model: true, year: true };
    setTouched(allTouched);
    const errs = validate(make, model, year);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    mutation.mutate();
  };

  if (isLoading || !initialised) {
    return (
      <Screen scroll={false}>
        <ActivityIndicator size="large" color={colors.surfaceAccent} style={styles.loader} />
      </Screen>
    );
  }

  if (!vehicle) {
    return (
      <Screen>
        <AppHeader fallbackHref="/(client)/vehicles" />
        <EmptyState
          title="Vehicle not found"
          body="This vehicle may have been removed. Go back to your garage to see saved vehicles."
        />
        <AppButton
          label="Back to Garage"
          variant="secondary"
          onPress={() => router.replace('/(client)/vehicles')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Edit vehicle"
        subtitle="Search for your vehicle or update details manually."
        fallbackHref="/(client)/vehicles"
      />

      <View style={styles.form}>
        <SearchablePicker
          label="Make"
          value={make}
          onChange={handleMakeChange}
          options={makes}
          isLoading={makesLoading}
          placeholder="Search makes…"
          required
          errorText={touched.make ? errors.make : undefined}
          onBlur={(nextValue) => {
            setTouched((t) => ({ ...t, make: true }));
            updateValidation({ make: nextValue });
          }}
        />

        <SearchablePicker
          label="Model"
          value={model}
          onChange={handleModelChange}
          options={models}
          isLoading={modelsLoading}
          placeholder="Search models…"
          required
          disabled={make.trim().length === 0}
          disabledHelperText="Pick a make first"
          errorText={touched.model ? errors.model : undefined}
          onBlur={(nextValue) => {
            setTouched((t) => ({ ...t, model: true }));
            updateValidation({ model: nextValue });
          }}
        />

        <SearchablePicker
          label="Year"
          value={year}
          onChange={handleYearChange}
          options={years}
          isLoading={yearsLoading}
          placeholder="Search years…"
          required
          disabled={make.trim().length === 0 || model.trim().length === 0}
          disabledHelperText="Pick a make and model first"
          errorText={touched.year ? errors.year : undefined}
          onBlur={(nextValue) => {
            setTouched((t) => ({ ...t, year: true }));
            updateValidation({ year: nextValue });
          }}
        />

        <AppTextField
          label="Nickname"
          value={nickname}
          onChangeText={(text) => setNickname(clampLength(text.replace(/[<>]/g, ''), 40))}
          placeholder="e.g. Daily driver (optional)"
          autoCapitalize="words"
          maxLength={40}
        />
        <AppTextField
          label="Color"
          value={color}
          onChangeText={(text) => setColor(clampLength(text.replace(/[<>]/g, ''), 30))}
          placeholder="e.g. Midnight Blue (optional)"
          autoCapitalize="words"
          maxLength={30}
        />
        <AppTextField
          label="License plate"
          value={plate}
          onChangeText={(text) => setPlate(clampLength(text.replace(/[<>]/g, ''), 12))}
          placeholder="e.g. ABC 1234 (optional)"
          autoCapitalize="characters"
          maxLength={12}
        />
      </View>

      <AppButton
        label={mutation.isPending ? 'Saving…' : 'Save Changes'}
        variant="accent"
        disabled={mutation.isPending}
        onPress={handleSave}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 80,
  },
  form: {
    gap: 16,
    zIndex: 1,
  },
});
