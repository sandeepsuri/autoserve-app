import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppTextField } from '@/components/AppTextField';
import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { SectionHeader } from '@/components/SectionHeader';
import { StatCard } from '@/components/StatCard';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { listBookingsForVendorOwner } from '@/lib/bookings';
import { durationSchema, priceSchema, requiredText, sanitizeText } from '@/lib/validation';
import { getVendorForOwner, listVendorServices, removeVendorService, upsertVendorService } from '@/lib/vendor-admin';
import { useAuthStore } from '@/store/useAuthStore';
import { Service, ServiceCategory } from '@/types/domain';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function numericInputSchema(
  builder: (opts: { max: number }) => ReturnType<typeof durationSchema>,
  max: number,
  fallbackMessage: string,
) {
  return z.string().superRefine((value, ctx) => {
    const result = builder({ max }).safeParse(value);
    if (!result.success) {
      ctx.addIssue({
        code: 'custom',
        message: result.error.issues[0]?.message ?? fallbackMessage,
      });
    }
  });
}

const schema = z.object({
  title: requiredText('Title', { min: 2, max: 60 }),
  category: z.string().min(2, 'Category is required'),
  durationMinutes: numericInputSchema(durationSchema, 1440, 'Enter a valid duration'),
  price: numericInputSchema(priceSchema, 100000, 'Enter a valid price'),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  tire: 'Tires',
  oil: 'Oil',
  brakes: 'Brakes',
  diagnostics: 'Diagnostics',
  repairs: 'Repairs',
  bodywork: 'Bodywork',
  detailing: 'Detailing',
  tint: 'Tint',
};

const ALL_CATEGORIES: ServiceCategory[] = [
  'tire',
  'oil',
  'brakes',
  'diagnostics',
  'repairs',
  'bodywork',
  'detailing',
  'tint',
];

/** 3-char abbreviation for the badge */
function categoryAbbr(category: string): string {
  return category.slice(0, 3).toUpperCase();
}

/** Color scheme for the category badge derived from category name */
function categoryColors(category: string): { bg: string; fg: string } {
  const schemes: Record<string, { bg: string; fg: string }> = {
    oil: { bg: '#EFF6FF', fg: colors.surfaceBrand },
    tire: { bg: '#FFF7ED', fg: colors.pending },
    brakes: { bg: '#FFF7ED', fg: colors.pending },
    diagnostics: { bg: '#ECFDF5', fg: colors.completed },
    repairs: { bg: '#EFF6FF', fg: colors.surfaceBrand },
    bodywork: { bg: '#F5F3FF', fg: '#6D28D9' },
    detailing: { bg: '#ECFDF5', fg: colors.completed },
    tint: { bg: '#F0F9FF', fg: '#0369A1' },
  };
  return schemes[category] ?? { bg: '#EFF6FF', fg: colors.surfaceBrand };
}

// ---------------------------------------------------------------------------
// Per-service booking count helper
// ---------------------------------------------------------------------------

function currentMonthBookingCounts(
  bookings: { serviceIds: string[]; status: string; createdAt: string }[],
): Record<string, number> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const counts: Record<string, number> = {};
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    const d = new Date(b.createdAt);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    for (const sid of b.serviceIds) {
      counts[sid] = (counts[sid] ?? 0) + 1;
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Add/Edit Modal
// ---------------------------------------------------------------------------

interface ServiceModalProps {
  visible: boolean;
  editTarget: Service | null;
  vendorId: string;
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}

function ServiceModal({ visible, editTarget, vendorId, ownerId, onClose, onSaved }: ServiceModalProps) {
  const queryClient = useQueryClient();
  const isEdit = editTarget !== null;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      title: editTarget?.title ?? '',
      category: editTarget?.category ?? 'oil',
      durationMinutes: editTarget ? String(editTarget.durationMinutes) : '45',
      price: editTarget ? String(editTarget.price) : '95',
    },
    resolver: zodResolver(schema),
  });

  // Sync defaults when editTarget changes (modal is reused)
  useEffect(() => {
    reset({
      title: editTarget?.title ?? '',
      category: editTarget?.category ?? 'oil',
      durationMinutes: editTarget ? String(editTarget.durationMinutes) : '45',
      price: editTarget ? String(editTarget.price) : '95',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget?.id]);

  const submit = handleSubmit(async (values) => {
    await upsertVendorService({
      id: editTarget?.id ?? `service-${Date.now()}`,
      vendorId,
      title: values.title,
      category: values.category as ServiceCategory,
      durationMinutes: Number(values.durationMinutes),
      price: Number(values.price),
      active: editTarget?.active ?? true,
    });
    await queryClient.invalidateQueries({ queryKey: ['vendor-services', ownerId] });
    onSaved();
  });

  function handleDelete() {
    if (!editTarget) return;
    Alert.alert(
      'Delete service',
      `Remove "${editTarget.title}" from your catalogue? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeVendorService(editTarget.id);
            await queryClient.invalidateQueries({ queryKey: ['vendor-services', ownerId] });
            onClose();
          },
        },
      ],
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={modalStyles.safeArea}>
        <View style={modalStyles.header}>
          <Pressable onPress={onClose} style={modalStyles.cancelButton}>
            <Text style={modalStyles.cancelLabel}>Cancel</Text>
          </Pressable>
          <Text style={modalStyles.title}>{isEdit ? 'Edit service' : 'Add service'}</Text>
          <View style={modalStyles.cancelButton} />
        </View>

        <ScrollView style={modalStyles.scroll} contentContainerStyle={modalStyles.scrollContent}>
          <Controller
            control={control}
            name="title"
            render={({ field: f }) => (
              <AppTextField
                label="Service name"
                required
                value={f.value}
                onChangeText={(text) => f.onChange(sanitizeText(text, 60))}
                placeholder="e.g. Full Synthetic Oil Change"
                maxLength={60}
                errorText={errors.title?.message}
              />
            )}
          />

          <View style={modalStyles.row}>
            <Text style={modalStyles.fieldLabel}>Category</Text>
            {errors.category ? <Text style={modalStyles.errorText}>{errors.category.message}</Text> : null}
          </View>
          <Controller
            control={control}
            name="category"
            render={({ field: f }) => (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={modalStyles.chips}>
                {ALL_CATEGORIES.map((cat) => (
                  <FilterChip
                    key={cat}
                    label={CATEGORY_LABELS[cat]}
                    active={f.value === cat}
                    onPress={() => f.onChange(cat)}
                  />
                ))}
              </ScrollView>
            )}
          />

          <Controller
            control={control}
            name="durationMinutes"
            render={({ field: f }) => (
              <AppTextField
                label="Duration (minutes)"
                required
                value={f.value}
                onChangeText={f.onChange}
                placeholder="45"
                keyboardType="number-pad"
                maxLength={4}
                errorText={errors.durationMinutes?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="price"
            render={({ field: f }) => (
              <AppTextField
                label="Starting price ($)"
                required
                value={f.value}
                onChangeText={f.onChange}
                placeholder="95"
                keyboardType="decimal-pad"
                maxLength={8}
                errorText={errors.price?.message}
              />
            )}
          />

          <AppButton
            label={isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add service'}
            variant="accent"
            onPress={submit}
            disabled={isSubmitting}
          />

          {isEdit ? (
            <AppButton
              label="Delete service"
              variant="destructive"
              onPress={handleDelete}
              style={modalStyles.deleteButton}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
  },
  title: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  cancelButton: {
    minWidth: 60,
  },
  cancelLabel: {
    ...typography.labelMd,
    color: colors.surfaceBrand,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.labelMd,
    color: colors.textPrimary,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  chips: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  deleteButton: {
    marginTop: spacing.sm,
  },
});

// ---------------------------------------------------------------------------
// Filter Panel (lightweight, shown inline below toolbar when open)
// ---------------------------------------------------------------------------

type AvailabilityFilter = 'all' | 'active' | 'paused';

interface FilterPanelProps {
  selectedCategory: ServiceCategory | 'all';
  onCategoryChange: (cat: ServiceCategory | 'all') => void;
  availability: AvailabilityFilter;
  onAvailabilityChange: (v: AvailabilityFilter) => void;
  onClose: () => void;
}

function FilterPanel({
  selectedCategory,
  onCategoryChange,
  availability,
  onAvailabilityChange,
  onClose,
}: FilterPanelProps) {
  return (
    <AppCard style={filterPanelStyles.card}>
      <View style={filterPanelStyles.row}>
        <Text style={filterPanelStyles.heading}>Filters</Text>
        <Pressable onPress={onClose}>
          <Text style={filterPanelStyles.doneLabel}>Done</Text>
        </Pressable>
      </View>

      <Text style={filterPanelStyles.sectionLabel}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={filterPanelStyles.chips}>
        <FilterChip
          label="All"
          active={selectedCategory === 'all'}
          onPress={() => onCategoryChange('all')}
        />
        {ALL_CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            label={CATEGORY_LABELS[cat]}
            active={selectedCategory === cat}
            onPress={() => onCategoryChange(cat)}
          />
        ))}
      </ScrollView>

      <Text style={filterPanelStyles.sectionLabel}>Availability</Text>
      <View style={filterPanelStyles.chips}>
        {(['all', 'active', 'paused'] as const).map((v) => (
          <FilterChip
            key={v}
            label={v === 'all' ? 'All' : v === 'active' ? 'Active' : 'Paused'}
            active={availability === v}
            onPress={() => onAvailabilityChange(v)}
          />
        ))}
      </View>
    </AppCard>
  );
}

const filterPanelStyles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    ...typography.labelMd,
    color: colors.textPrimary,
  },
  doneLabel: {
    ...typography.labelMd,
    color: colors.surfaceBrand,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

// ---------------------------------------------------------------------------
// Vendor Service Card
// ---------------------------------------------------------------------------

interface VendorServiceCardProps {
  service: Service;
  modeLabel: string;
  monthlyCount: number;
  onToggle: (active: boolean) => void;
  onEdit: () => void;
}

function VendorServiceCard({ service, modeLabel, monthlyCount, onToggle, onEdit }: VendorServiceCardProps) {
  const { bg, fg } = categoryColors(service.category);
  const abbr = categoryAbbr(service.category);

  return (
    <AppCard style={[cardStyles.card, shadows.card]}>
      {/* Top row: badge, name+meta, toggle */}
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.badge, { backgroundColor: bg }]}>
          <Text style={[cardStyles.badgeText, { color: fg }]}>{abbr}</Text>
        </View>

        <View style={cardStyles.nameBlock}>
          <Text style={cardStyles.serviceTitle} numberOfLines={2}>{service.title}</Text>
          <Text style={cardStyles.metaLabel}>
            {CATEGORY_LABELS[service.category] ?? service.category} · {modeLabel}
          </Text>
        </View>

        <Switch
          value={service.active}
          onValueChange={onToggle}
          trackColor={{ false: colors.borderStrong, true: colors.surfaceSuccess }}
          thumbColor={colors.bgElevated}
        />
      </View>

      {/* Price + duration */}
      <View style={cardStyles.metaGrid}>
        <View style={cardStyles.metaCell}>
          <Text style={cardStyles.metaCellLabel}>Starting at</Text>
          <Text style={cardStyles.metaCellValue}>${service.price}</Text>
        </View>
        <View style={cardStyles.metaCell}>
          <Text style={cardStyles.metaCellLabel}>Duration</Text>
          <Text style={cardStyles.metaCellValue}>{service.durationMinutes} min</Text>
        </View>
      </View>

      {/* Performance + edit action */}
      <View style={cardStyles.actionsRow}>
        {service.active ? (
          <Text style={cardStyles.performance}>
            <Text style={cardStyles.performanceCount}>{monthlyCount} booking{monthlyCount !== 1 ? 's' : ''}</Text>
            {' '}this month
          </Text>
        ) : (
          <Text style={cardStyles.paused}>Paused · hidden from customers</Text>
        )}
        <Pressable onPress={onEdit} style={cardStyles.editButton}>
          <Text style={cardStyles.editLabel}>Edit service</Text>
        </Pressable>
      </View>
    </AppCard>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderRadius: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  nameBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  serviceTitle: {
    ...typography.labelMd,
    color: colors.textPrimary,
    lineHeight: 19,
  },
  metaLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  metaGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metaCell: {
    flex: 1,
    backgroundColor: colors.bgBase,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    gap: 2,
  },
  metaCellLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.textTertiary,
  },
  metaCellValue: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  performance: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  performanceCount: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.completed,
  },
  paused: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  editButton: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.bgElevated,
  },
  editLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: colors.surfaceBrand,
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function VendorServicesScreen() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((state) => state.session?.userId);

  const { data: vendor } = useQuery({
    queryKey: ['vendor-self', ownerId],
    queryFn: getVendorForOwner,
    enabled: Boolean(ownerId),
  });

  const {
    data: services = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['vendor-services', ownerId],
    queryFn: listVendorServices,
    enabled: Boolean(ownerId),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['vendor-bookings', ownerId],
    queryFn: () => listBookingsForVendorOwner(ownerId),
    enabled: Boolean(ownerId),
  });

  // Stats
  const activeCount = services.filter((s) => s.active).length;
  const pausedCount = services.filter((s) => !s.active).length;

  const monthlyCountPerService = useMemo(
    () => currentMonthBookingCounts(bookings),
    [bookings],
  );
  const totalMonthlyBookings = useMemo(
    () => Object.values(monthlyCountPerService).reduce((a, b) => a + b, 0),
    [monthlyCountPerService],
  );

  // Service mode label derived from vendor record
  const modeLabel = vendor?.mobileServiceEnabled ? 'Mobile available' : 'In-shop';

  // Toolbar state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);

  const vendorId = vendor?.id ?? '';

  // Filtered list
  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return services.filter((s) => {
      if (q && !s.title.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q)) return false;
      if (selectedCategory !== 'all' && s.category !== selectedCategory) return false;
      if (availabilityFilter === 'active' && !s.active) return false;
      if (availabilityFilter === 'paused' && s.active) return false;
      return true;
    });
  }, [services, searchQuery, selectedCategory, availabilityFilter]);

  // Availability toggle with optimistic update
  async function handleToggle(service: Service, newActive: boolean) {
    const previous = services.find((s) => s.id === service.id);
    // Optimistic update in cache
    queryClient.setQueryData<Service[]>(['vendor-services', ownerId], (old = []) =>
      old.map((s) => (s.id === service.id ? { ...s, active: newActive } : s)),
    );
    try {
      await upsertVendorService({ ...service, active: newActive });
      await queryClient.invalidateQueries({ queryKey: ['vendor-services', ownerId] });
    } catch {
      // Roll back
      queryClient.setQueryData<Service[]>(['vendor-services', ownerId], (old = []) =>
        old.map((s) => (s.id === service.id ? { ...s, active: previous?.active ?? service.active } : s)),
      );
    }
  }

  function openAdd() {
    setEditTarget(null);
    setModalVisible(true);
  }

  function openEdit(service: Service) {
    setEditTarget(service);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setEditTarget(null);
  }

  function onSaved() {
    closeModal();
    // Clear filters so the new/edited service is visible
    setSearchQuery('');
    setSelectedCategory('all');
    setAvailabilityFilter('all');
  }

  return (
    <SafeAreaView style={screenStyles.safeArea}>
      <ScrollView
        style={screenStyles.scroll}
        contentContainerStyle={screenStyles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Page header */}
        <View style={screenStyles.pageHeader}>
          <View style={screenStyles.headerText}>
            <Text style={screenStyles.pageTitle}>My services</Text>
            <Text style={screenStyles.pageSubtitle}>Manage what customers can book.</Text>
          </View>
          <Pressable style={screenStyles.moreButton} accessibilityLabel="Catalogue settings">
            <Text style={screenStyles.moreButtonDots}>•••</Text>
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={screenStyles.statsRow}>
          <StatCard label="Active" value={String(activeCount)} />
          <StatCard label="Paused" value={String(pausedCount)} />
          <StatCard label="Bookings" value={String(totalMonthlyBookings)} helper="This month" />
        </View>

        {/* Toolbar */}
        <View style={screenStyles.toolbar}>
          <View style={screenStyles.searchContainer}>
            <Text style={screenStyles.searchIcon}>⌕</Text>
            <TextInput
              style={screenStyles.searchInput}
              placeholder="Search services"
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={(text) => setSearchQuery(sanitizeText(text, 80))}
              returnKeyType="search"
              autoCorrect={false}
              maxLength={80}
            />
          </View>
          <Pressable
            style={[screenStyles.filterButton, filterOpen && screenStyles.filterButtonActive]}
            onPress={() => setFilterOpen((v) => !v)}
            accessibilityLabel="Filter services"
          >
            <Text style={[screenStyles.filterIcon, filterOpen && screenStyles.filterIconActive]}>≡</Text>
          </Pressable>
        </View>

        {/* Filter panel */}
        {filterOpen ? (
          <FilterPanel
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            availability={availabilityFilter}
            onAvailabilityChange={setAvailabilityFilter}
            onClose={() => setFilterOpen(false)}
          />
        ) : null}

        {/* Add banner */}
        <Pressable style={screenStyles.addBanner} onPress={openAdd} accessibilityRole="button">
          <View style={screenStyles.addBannerText}>
            <Text style={screenStyles.addBannerTitle}>Add a new service</Text>
            <Text style={screenStyles.addBannerBody}>
              Create pricing, duration, and availability in one focused step.
            </Text>
          </View>
          <View style={screenStyles.addCircle}>
            <Text style={screenStyles.addCirclePlus}>+</Text>
          </View>
        </Pressable>

        {/* Section header */}
        <SectionHeader
          title="Your catalogue"
          actionLabel={`${filteredServices.length} service${filteredServices.length !== 1 ? 's' : ''}`}
        />

        {/* Loading */}
        {isLoading ? (
          <AppCard>
            <Text style={screenStyles.loadingText}>Loading services…</Text>
          </AppCard>
        ) : isError ? (
          <AppCard>
            <Text style={screenStyles.errorText}>Failed to load services. Pull to refresh.</Text>
          </AppCard>
        ) : filteredServices.length === 0 ? (
          services.length === 0 ? (
            <EmptyState
              title="No services yet"
              body="Add your first service above to start appearing in discovery results."
            />
          ) : (
            <EmptyState
              title="No results"
              body="No services match your search or filters. Try adjusting them."
            />
          )
        ) : (
          <View style={screenStyles.serviceList}>
            {filteredServices.map((service) => (
              <VendorServiceCard
                key={service.id}
                service={service}
                modeLabel={modeLabel}
                monthlyCount={monthlyCountPerService[service.id] ?? 0}
                onToggle={(active) => handleToggle(service, active)}
                onEdit={() => openEdit(service)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit modal */}
      {ownerId && vendorId ? (
        <ServiceModal
          visible={modalVisible}
          editTarget={editTarget}
          vendorId={vendorId}
          ownerId={ownerId}
          onClose={closeModal}
          onSaved={onSaved}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Screen styles
// ---------------------------------------------------------------------------

const screenStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.page,
    gap: spacing.xl,
    paddingBottom: 40,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  pageTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  pageSubtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  moreButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  moreButtonDots: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: colors.surfaceBrand,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    fontSize: 16,
    color: colors.textTertiary,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    borderColor: colors.surfaceBrand,
    backgroundColor: '#EFF6FF',
  },
  filterIcon: {
    fontSize: 20,
    color: colors.surfaceBrand,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  filterIconActive: {
    color: colors.surfaceBrand,
  },
  addBanner: {
    borderRadius: 20,
    padding: spacing.lg,
    backgroundColor: colors.bgStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Approximate the dark-navy-to-orange gradient with a layered overlay effect
    // (no expo-linear-gradient dependency needed)
    overflow: 'hidden',
  },
  addBannerText: {
    flex: 1,
    gap: spacing.xs,
  },
  addBannerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: colors.textInverse,
  },
  addBannerBody: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 17,
  },
  addCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAccent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addCirclePlus: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    color: colors.textInverse,
    lineHeight: 30,
  },
  serviceList: {
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.bodyMd,
    color: colors.danger,
  },
});
