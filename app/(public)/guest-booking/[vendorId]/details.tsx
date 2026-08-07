import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SearchablePicker } from '@/components/SearchablePicker';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { addDays, startOfDay, toDateKey } from '@/lib/format';
import { guestBookingContactSchema, guestVehicleSchema, sanitizeText } from '@/lib/validation';
import { listVehicleMakes, listVehicleModels, listVehicleYears } from '@/lib/vehicle-catalog';
import { getVendorDetail } from '@/lib/vendors';
import { useBookingDraftStore } from '@/store/useBookingDraftStore';
import { deriveAvailableSlots, formatTimeDisplay } from '@/store/useVendorAvailabilityStore';

const DATE_WINDOW = 60;

function formatDate(dateIso: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .format(new Date(`${dateIso}T00:00:00`));
}

export default function GuestBookingDetailsScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const router = useRouter();
  const { draft, updateDraft } = useBookingDraftStore();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['guest-booking-vendor', vendorId],
    queryFn: () => getVendorDetail(vendorId),
    enabled: Boolean(vendorId),
  });
  const { data: makes = [], isLoading: makesLoading } = useQuery({ queryKey: ['vehicle-makes'], queryFn: listVehicleMakes });
  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['vehicle-models', draft.vehicleMake],
    queryFn: () => listVehicleModels(draft.vehicleMake!),
    enabled: Boolean(draft.vehicleMake),
  });
  const { data: years = [], isLoading: yearsLoading } = useQuery({
    queryKey: ['vehicle-years', draft.vehicleMake, draft.vehicleModel],
    queryFn: () => listVehicleYears(draft.vehicleMake!, draft.vehicleModel!),
    enabled: Boolean(draft.vehicleMake && draft.vehicleModel),
  });

  const vendor = data?.vendor;
  const services = data?.services ?? [];
  const selectedServiceIds = draft.serviceIds ?? [];
  const mode = draft.bookingMode ?? 'shop';
  const dateOptions = useMemo(() => {
    if (!data?.availability) return [];
    return Array.from({ length: DATE_WINDOW }, (_, index) => toDateKey(addDays(startOfDay(new Date()), index + 1)))
      .filter((date) => deriveAvailableSlots(date, data.availability).length > 0);
  }, [data?.availability]);
  const timeOptions = useMemo(
    () => draft.scheduledDate && data?.availability ? deriveAvailableSlots(draft.scheduledDate, data.availability) : [],
    [data?.availability, draft.scheduledDate],
  );

  useEffect(() => {
    if (dateOptions.length && (!draft.scheduledDate || !dateOptions.includes(draft.scheduledDate))) {
      updateDraft({ scheduledDate: dateOptions[0], scheduledTime: undefined });
    }
  }, [dateOptions, draft.scheduledDate, updateDraft]);

  useEffect(() => {
    if (timeOptions.length && (!draft.scheduledTime || !timeOptions.includes(draft.scheduledTime))) {
      updateDraft({ scheduledTime: timeOptions[0] });
    }
  }, [draft.scheduledTime, timeOptions, updateDraft]);

  if (isLoading) return <Screen><AppHeader title="Guest booking" fallbackHref={`/(public)/shop/${vendorId}` as never} /></Screen>;
  if (!vendor) return <Screen><AppHeader fallbackHref="/(public)/discover" /><EmptyState title="Vendor unavailable" body="Return to discovery and choose another provider." /></Screen>;

  const toggleService = (serviceId: string) => {
    const next = selectedServiceIds.includes(serviceId)
      ? selectedServiceIds.filter((id) => id !== serviceId)
      : [...selectedServiceIds, serviceId];
    updateDraft({ serviceIds: next, serviceId: next[0] });
  };

  const validateAndContinue = () => {
    const nextErrors: Record<string, string> = {};
    const contact = guestBookingContactSchema.safeParse({ name: draft.guestName, email: draft.guestEmail, phone: draft.guestPhone });
    if (!contact.success) contact.error.issues.forEach((issue) => { nextErrors[String(issue.path[0])] = issue.message; });
    const vehicle = guestVehicleSchema.safeParse({
      make: draft.vehicleMake, model: draft.vehicleModel, year: draft.vehicleYear,
      trim: draft.vehicleTrim || undefined, color: draft.vehicleColor || undefined, plate: draft.vehiclePlate || undefined,
    });
    if (!vehicle.success) vehicle.error.issues.forEach((issue) => { nextErrors[String(issue.path[0])] = issue.message; });
    if (!selectedServiceIds.length) nextErrors.services = 'Choose at least one service.';
    if (!draft.scheduledDate || !draft.scheduledTime) nextErrors.schedule = 'Choose an available date and time.';
    if (mode === 'mobile' && !draft.mobileAddress?.trim()) nextErrors.mobileAddress = 'Enter the mobile service address.';
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) router.push(`/(public)/guest-booking/${vendorId}/review`);
  };

  const subtotal = services.filter((service) => selectedServiceIds.includes(service.id)).reduce((sum, service) => sum + service.price, 0);
  const total = subtotal * 1.12;

  return (
    <Screen>
      <AppHeader title="Guest booking · Step 1 of 2" subtitle="No account or saved garage required. These details are used for this request only." fallbackHref={`/(public)/shop/${vendor.id}` as never} />
      <View style={styles.progress}><View style={styles.progressActive} /><View style={styles.progressIdle} /></View>
      <AppCard style={styles.vendorCard}><Text style={typography.titleSm}>{vendor.name}</Text><Text style={styles.secondary}>{vendor.address}</Text></AppCard>

      <AppCard style={styles.section}>
        <Text style={typography.titleSm}>Your contact details</Text><Text style={styles.secondary}>The vendor will use these details to respond to the request.</Text>
        <AppTextField label="Full name" required value={draft.guestName ?? ''} errorText={errors.name} autoCapitalize="words" onChangeText={(text) => updateDraft({ guestName: sanitizeText(text, 60) })} />
        <AppTextField label="Email" required value={draft.guestEmail ?? ''} errorText={errors.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(text) => updateDraft({ guestEmail: text.trim().slice(0, 254) })} />
        <AppTextField label="Phone" required value={draft.guestPhone ?? ''} errorText={errors.phone} keyboardType="phone-pad" onChangeText={(text) => updateDraft({ guestPhone: text.slice(0, 20) })} />
      </AppCard>

      <AppCard style={styles.section}>
        <Text style={typography.titleSm}>Vehicle details</Text><Text style={styles.secondary}>This vehicle will not be saved to a profile or garage.</Text>
        <SearchablePicker label="Make" required value={draft.vehicleMake ?? ''} options={makes} isLoading={makesLoading} errorText={errors.make} placeholder="Search or enter make" onChange={(value) => updateDraft({ vehicleMake: value, vehicleModel: undefined, vehicleYear: undefined })} />
        <SearchablePicker label="Model" required value={draft.vehicleModel ?? ''} options={models} isLoading={modelsLoading} errorText={errors.model} placeholder="Search or enter model" disabled={!draft.vehicleMake} disabledHelperText="Choose a make first" onChange={(value) => updateDraft({ vehicleModel: value, vehicleYear: undefined })} />
        <SearchablePicker label="Year" required value={draft.vehicleYear ?? ''} options={years} isLoading={yearsLoading} errorText={errors.year} placeholder="Search or enter year" disabled={!draft.vehicleModel} disabledHelperText="Choose a model first" onChange={(value) => updateDraft({ vehicleYear: value })} />
        <AppTextField label="Trim" value={draft.vehicleTrim ?? ''} onChangeText={(text) => updateDraft({ vehicleTrim: sanitizeText(text, 60) })} placeholder="Optional" />
        <View style={styles.twoColumn}><View style={styles.flex}><AppTextField label="Colour" value={draft.vehicleColor ?? ''} onChangeText={(text) => updateDraft({ vehicleColor: sanitizeText(text, 30) })} placeholder="Optional" /></View><View style={styles.flex}><AppTextField label="License plate" value={draft.vehiclePlate ?? ''} onChangeText={(text) => updateDraft({ vehiclePlate: text.replace(/[<>]/g, '').slice(0, 12).toUpperCase() })} placeholder="Optional" autoCapitalize="characters" /></View></View>
      </AppCard>

      <AppCard style={styles.section}>
        <Text style={typography.titleSm}>Service and visit type</Text>
        {services.map((service) => {
          const active = selectedServiceIds.includes(service.id);
          return <Pressable key={service.id} onPress={() => toggleService(service.id)} style={[styles.option, active && styles.optionActive]}><View style={styles.flex}><Text style={typography.labelLg}>{service.title}</Text><Text style={styles.secondary}>{service.durationMinutes} min</Text></View><Text style={styles.price}>${service.price.toFixed(2)}</Text></Pressable>;
        })}
        {errors.services ? <Text style={styles.error}>{errors.services}</Text> : null}
        <View style={styles.twoColumn}>
          <ModeOption label="Shop visit" active={mode === 'shop'} onPress={() => updateDraft({ bookingMode: 'shop', mobileAddress: undefined })} />
          {vendor.mobileServiceEnabled ? <ModeOption label="Mobile service" active={mode === 'mobile'} onPress={() => updateDraft({ bookingMode: 'mobile' })} /> : null}
        </View>
        {mode === 'mobile' ? <AppTextField label="Service address" required value={draft.mobileAddress ?? ''} errorText={errors.mobileAddress} onChangeText={(text) => updateDraft({ mobileAddress: sanitizeText(text, 160) })} /> : null}
      </AppCard>

      <AppCard style={styles.section}>
        <Text style={typography.titleSm}>Date and time</Text>
        {!dateOptions.length ? <Text style={styles.error}>This vendor has no available appointments in the next 60 days.</Text> : <>
          <Text style={styles.fieldLabel}>Date</Text><View style={styles.chips}>{dateOptions.slice(0, 8).map((date) => <Pressable key={date} style={[styles.chip, draft.scheduledDate === date && styles.chipActive]} onPress={() => updateDraft({ scheduledDate: date, scheduledTime: undefined })}><Text style={[styles.chipText, draft.scheduledDate === date && styles.chipTextActive]}>{formatDate(date)}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>Time</Text><View style={styles.chips}>{timeOptions.map((time) => <Pressable key={time} style={[styles.chip, draft.scheduledTime === time && styles.chipActive]} onPress={() => updateDraft({ scheduledTime: time })}><Text style={[styles.chipText, draft.scheduledTime === time && styles.chipTextActive]}>{formatTimeDisplay(time)}</Text></Pressable>)}</View>
        </>}
        {errors.schedule ? <Text style={styles.error}>{errors.schedule}</Text> : null}
        <AppTextField label="Describe the problem" value={draft.notes ?? ''} onChangeText={(text) => updateDraft({ notes: text.replace(/[<>]/g, '').slice(0, 500) })} multiline placeholder="Optional details for the mechanic" maxLength={500} />
      </AppCard>

      <View style={styles.totalRow}><Text style={styles.secondary}>Estimated total · Pay vendor later</Text><Text style={typography.titleSm}>${total.toFixed(2)}</Text></View>
      <AppButton label="Review request" variant="accent" disabled={!dateOptions.length} onPress={validateAndContinue} />
    </Screen>
  );
}

function ModeOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.mode, active && styles.optionActive]}><Text style={typography.labelMd}>{label}</Text><View style={[styles.radio, active && styles.radioActive]} /></Pressable>;
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: spacing.sm }, progressActive: { flex: 1, height: 5, borderRadius: radius.full, backgroundColor: colors.surfaceAccent }, progressIdle: { flex: 1, height: 5, borderRadius: radius.full, backgroundColor: colors.borderDefault },
  vendorCard: { backgroundColor: '#EEF6FC', gap: spacing.xs }, section: { gap: spacing.md }, secondary: { ...typography.bodyMd, color: colors.textSecondary },
  twoColumn: { flexDirection: 'row', gap: spacing.md }, flex: { flex: 1 }, option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.sm, padding: spacing.lg }, optionActive: { borderColor: colors.surfaceBrand, backgroundColor: '#F3F8FC' }, price: { ...typography.labelLg, color: colors.surfaceBrand },
  mode: { flex: 1, minHeight: 58, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.sm, padding: spacing.md }, radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.borderStrong }, radioActive: { borderColor: colors.surfaceBrand, backgroundColor: colors.surfaceBrand },
  fieldLabel: { ...typography.labelMd }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.bgElevated }, chipActive: { backgroundColor: colors.surfaceBrand, borderColor: colors.surfaceBrand }, chipText: { ...typography.caption, color: colors.textSecondary }, chipTextActive: { color: colors.textInverse }, error: { ...typography.caption, color: colors.danger }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
});
