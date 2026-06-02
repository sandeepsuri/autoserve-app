import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { Screen } from '@/components/Screen';
import { SearchablePicker } from '@/components/SearchablePicker';
import { typography } from '@/constants/theme';
import { listVehicleMakes, listVehicleModels, listVehicleYears } from '@/lib/vehicle-catalog';
import { createVehicle, listVehicles } from '@/lib/vehicles';
import { useAuthStore } from '@/store/useAuthStore';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';

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

export default function GarageAddScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session, guestClientId } = useAuthStore();
  const { updateDraft } = useBookingDraftStore();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const vehicleOwnerKey = session?.userId ?? guestClientId ?? 'anonymous';

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [nickname, setNickname] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState({ make: false, model: false, year: false });

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

  // ─── Determine if first vehicle (auto-default) ──────────────────────────────

  const { data: existingVehicles = [] } = useQuery({
    queryKey: ['client-vehicles', vehicleOwnerKey],
    queryFn: listVehicles,
  });

  // ─── Cascade: changing make resets model + year ─────────────────────────────

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
    mutationFn: async () => {
      const ownerId = session?.userId ?? guestClientId ?? '';
      if (!ownerId) throw new Error('You must be signed in to save a vehicle');

      return createVehicle({
        ownerId,
        make: make.trim(),
        model: model.trim(),
        year: year.trim(),
        nickname: nickname.trim() || undefined,
        color: color.trim() || undefined,
        plate: plate.trim() || undefined,
        isDefault: existingVehicles.length === 0,
      });
    },
    onSuccess: async (newVehicle) => {
      await qc.invalidateQueries({ queryKey: ['client-vehicles'] });
      if (returnTo) {
        updateDraft({ vehicleId: newVehicle.id });
        router.replace(returnTo as never);
      } else {
        router.replace('/(client)/vehicles');
      }
    },
    onError: (err) => {
      Alert.alert('Could not save vehicle', err instanceof Error ? err.message : String(err));
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

  const backHref = returnTo ?? '/(client)/vehicles';

  return (
    <Screen>
      <AppHeader
        title="Add vehicle"
        subtitle="Search for your vehicle or enter it manually if it's not in the list."
        fallbackHref={backHref as never}
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
          onChangeText={setNickname}
          placeholder="e.g. Daily driver (optional)"
          autoCapitalize="words"
        />
        <AppTextField
          label="Color"
          value={color}
          onChangeText={setColor}
          placeholder="e.g. Midnight Blue (optional)"
          autoCapitalize="words"
        />
        <AppTextField
          label="License plate"
          value={plate}
          onChangeText={setPlate}
          placeholder="e.g. ABC 1234 (optional)"
          autoCapitalize="characters"
        />
      </View>

      {existingVehicles.length === 0 ? (
        <Text style={styles.defaultNote}>This will be set as your default vehicle.</Text>
      ) : null}

      <AppButton
        label={mutation.isPending ? 'Saving…' : 'Save Vehicle'}
        variant="accent"
        disabled={mutation.isPending}
        onPress={handleSave}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
    zIndex: 1,
  },
  defaultNote: {
    ...typography.caption,
    color: '#475569',
  },
});
