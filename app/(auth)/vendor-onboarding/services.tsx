import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppTextField } from '@/components/AppTextField';
import { FilterChip } from '@/components/FilterChip';
import { OnboardingStepShell } from '@/components/onboarding/OnboardingStepShell';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { saveVendorOnboardingDraft } from '@/lib/vendor-onboarding';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';
import { ServiceCategory, VendorOnboardingServiceDraft } from '@/types/domain';

type ServiceEditorState = {
  id?: string;
  title: string;
  category?: ServiceCategory;
  durationMinutes: string;
  price: string;
  description: string;
  active: boolean;
};

type StarterService = {
  title: string;
  category: ServiceCategory;
  durationMinutes: string;
  price: string;
  description: string;
};

const CATEGORY_OPTIONS: Array<{
  value: ServiceCategory;
  label: string;
  helper: string;
}> = [
  { value: 'diagnostics', label: 'Diagnostics', helper: 'Inspections, troubleshooting, scan tools' },
  { value: 'oil', label: 'Oil', helper: 'Oil changes, filters, fluids' },
  { value: 'brakes', label: 'Brakes', helper: 'Pads, rotors, brake checks' },
  { value: 'tire', label: 'Tire', helper: 'Rotation, repair, mounting, balancing' },
  { value: 'repairs', label: 'Repair', helper: 'General mechanical fixes and installs' },
  { value: 'bodywork', label: 'Bodywork', helper: 'Collision, paint, dent, scratch work' },
  { value: 'detailing', label: 'Detailing', helper: 'Interior, exterior, wash, ceramic care' },
  { value: 'tint', label: 'Tint', helper: 'Window tint and film packages' },
];

const STARTER_SERVICES: StarterService[] = [
  {
    title: 'Oil Change',
    category: 'oil',
    durationMinutes: '30',
    price: '80',
    description: 'Quick oil and filter service for everyday maintenance.',
  },
  {
    title: 'Brake Inspection',
    category: 'brakes',
    durationMinutes: '40',
    price: '55',
    description: 'Brake check with wear review and next-step recommendations.',
  },
  {
    title: 'Tire Rotation & Balance',
    category: 'tire',
    durationMinutes: '45',
    price: '85',
    description: 'Rotation and balance service for smoother driving and longer tire life.',
  },
  {
    title: 'Diagnostic Scan',
    category: 'diagnostics',
    durationMinutes: '60',
    price: '120',
    description: 'Electronic scan and troubleshooting for warning lights and drivability issues.',
  },
  {
    title: 'Scratch Repair',
    category: 'bodywork',
    durationMinutes: '120',
    price: '275',
    description: 'Paint correction and minor cosmetic repair for common surface damage.',
  },
  {
    title: 'Full Detail',
    category: 'detailing',
    durationMinutes: '150',
    price: '220',
    description: 'Interior and exterior detailing package for full vehicle refresh.',
  },
  {
    title: 'Front Window Tint',
    category: 'tint',
    durationMinutes: '90',
    price: '180',
    description: 'Window tint installation with film and finish inspection.',
  },
];

function createEmptyEditor(): ServiceEditorState {
  return {
    title: '',
    durationMinutes: '',
    price: '',
    description: '',
    active: true,
  };
}

function toEditorState(service: VendorOnboardingServiceDraft): ServiceEditorState {
  return {
    id: service.id,
    title: service.title ?? '',
    category: service.category,
    durationMinutes: service.durationMinutes?.toString() ?? '',
    price: service.price?.toString() ?? '',
    description: service.description ?? '',
    active: service.active ?? true,
  };
}

function parseService(editor: ServiceEditorState): VendorOnboardingServiceDraft {
  return {
    id: editor.id,
    title: editor.title.trim(),
    category: editor.category,
    durationMinutes: Number(editor.durationMinutes),
    price: Number(editor.price),
    description: editor.description.trim() || undefined,
    active: editor.active,
  };
}

function getServiceErrors(editor: ServiceEditorState) {
  return {
    title: editor.title.trim().length < 2 ? 'Add a service name' : undefined,
    category: editor.category ? undefined : 'Choose a category',
    durationMinutes:
      Number.isFinite(Number(editor.durationMinutes)) && Number(editor.durationMinutes) > 0
        ? undefined
        : 'Enter a valid duration',
    price:
      Number.isFinite(Number(editor.price)) && Number(editor.price) >= 0
        ? undefined
        : 'Enter a valid price',
  };
}

function isEditorDirty(editor: ServiceEditorState) {
  return Boolean(
    editor.title.trim() ||
      editor.category ||
      editor.durationMinutes.trim() ||
      editor.price.trim() ||
      editor.description.trim() ||
      !editor.active ||
      editor.id,
  );
}

function isEditorValid(editor: ServiceEditorState) {
  const errors = getServiceErrors(editor);
  return !errors.title && !errors.category && !errors.durationMinutes && !errors.price;
}

function formatCategory(category?: ServiceCategory) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? 'Uncategorized';
}

export default function ServicesStep() {
  const { draft, patchDraft } = useVendorOnboardingStore();
  const services = draft?.services ?? [];

  const [editor, setEditor] = useState<ServiceEditorState>(createEmptyEditor);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const errors = getServiceErrors(editor);
  const editorDirty = isEditorDirty(editor);
  const editorValid = isEditorValid(editor);
  const validServices = services.filter(
    (service) =>
      Boolean(service.title?.trim()) &&
      Boolean(service.category) &&
      typeof service.durationMinutes === 'number' &&
      service.durationMinutes > 0 &&
      typeof service.price === 'number' &&
      service.price >= 0,
  );

  const categorySummary = useMemo(() => {
    return CATEGORY_OPTIONS.map((category) => ({
      ...category,
      count: services.filter((service) => service.category === category.value).length,
    })).filter((category) => category.count > 0);
  }, [services]);

  const activeCount = services.filter((service) => service.active ?? true).length;
  const canContinue = validServices.length > 0 && !editorDirty;

  const updateServices = (nextServices: VendorOnboardingServiceDraft[]) => {
    patchDraft({ services: nextServices });
  };

  const resetEditor = () => {
    setEditingIndex(null);
    setEditor(createEmptyEditor());
  };

  const saveEditor = () => {
    if (!editorValid) return;

    const nextService = parseService(editor);
    const nextServices = [...services];

    if (editingIndex !== null) {
      nextServices[editingIndex] = nextService;
    } else {
      nextServices.push(nextService);
    }

    updateServices(nextServices);
    resetEditor();
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditor(toEditorState(services[index]));
  };

  const applyStarter = (starter: StarterService) => {
    setEditingIndex(null);
    setEditor({
      ...starter,
      active: true,
    });
  };

  const toggleService = (index: number) => {
    updateServices(
      services.map((service, currentIndex) =>
        currentIndex === index ? { ...service, active: !(service.active ?? true) } : service,
      ),
    );
  };

  const handleContinue = async () => {
    await saveVendorOnboardingDraft({ services });
  };

  return (
    <OnboardingStepShell
      stepId="services"
      title="Build your service catalog"
      subtitle="Start with your core offers now. You can add depth later without cluttering setup."
      canContinue={canContinue}
      onContinue={handleContinue}
    >
      <AppCard style={styles.summaryCard}>
        <SectionHeader title="Catalog snapshot" actionLabel={`${services.length} services`} />
        <View style={styles.statsRow}>
          <StatPill label="Visible now" value={`${activeCount}`} accent="strong" />
          <StatPill label="Hidden for now" value={`${Math.max(services.length - activeCount, 0)}`} accent="muted" />
          <StatPill label="Categories" value={`${categorySummary.length}`} accent="accent" />
        </View>
        <Text style={styles.summaryBody}>
          Shops can add a broad catalog. Solo and hybrid vendors can keep this tight with a few high-conviction services.
        </Text>
        {categorySummary.length ? (
          <View style={styles.categoryWrap}>
            {categorySummary.map((category) => (
              <View key={category.value} style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{category.label}</Text>
                <Text style={styles.categoryBadgeCount}>{category.count}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </AppCard>

      <AppCard style={styles.card}>
        <SectionHeader title="Quick starters" actionLabel="Optional" />
        <Text style={styles.helper}>
          Use these as shortcuts for mechanic shops, body shops, tire shops, detailers, tint shops, and mixed-service teams.
        </Text>
        <View style={styles.starterWrap}>
          {STARTER_SERVICES.map((starter) => (
            <Pressable
              key={`${starter.category}-${starter.title}`}
              onPress={() => applyStarter(starter)}
              style={styles.starterTile}
            >
              <Text style={styles.starterTitle}>{starter.title}</Text>
              <Text style={styles.starterMeta}>
                {formatCategory(starter.category)} · ${starter.price}
              </Text>
            </Pressable>
          ))}
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <SectionHeader
          title={editingIndex !== null ? 'Edit service' : 'Add a service'}
          actionLabel={editingIndex !== null ? 'Updating existing entry' : 'Create your next offering'}
        />
        <AppTextField
          label="Service name"
          required
          value={editor.title}
          onChangeText={(title) => setEditor((current) => ({ ...current, title }))}
          placeholder="e.g. Full Detail, Wheel Alignment, Bumper Repair"
          errorText={errors.title}
        />

        <View style={styles.categorySection}>
          <Text style={styles.fieldLabel}>
            Category
            <Text style={styles.asterisk}> *</Text>
          </Text>
          <View style={styles.chipWrap}>
            {CATEGORY_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                active={editor.category === option.value}
                onPress={() => setEditor((current) => ({ ...current, category: option.value }))}
              />
            ))}
          </View>
          <Text style={[styles.inlineError, !errors.category && styles.inlineHint]}>
            {errors.category ?? CATEGORY_OPTIONS.find((option) => option.value === editor.category)?.helper ?? 'Choose the lane this service fits best.'}
          </Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowField}>
            <AppTextField
              label="Duration"
              required
              value={editor.durationMinutes}
              onChangeText={(durationMinutes) => setEditor((current) => ({ ...current, durationMinutes }))}
              placeholder="45"
              keyboardType="number-pad"
              helperText="Minutes"
              errorText={errors.durationMinutes}
            />
          </View>
          <View style={styles.rowField}>
            <AppTextField
              label="Starting price"
              required
              value={editor.price}
              onChangeText={(price) => setEditor((current) => ({ ...current, price }))}
              placeholder="95"
              keyboardType="decimal-pad"
              helperText="USD"
              errorText={errors.price}
            />
          </View>
        </View>

        <AppTextField
          label="What’s included"
          value={editor.description}
          onChangeText={(description) => setEditor((current) => ({ ...current, description }))}
          placeholder="Add a short scope so clients know what they’re booking."
          multiline
          helperText="Optional, but useful for multi-service businesses."
        />

        <View style={styles.visibilityRow}>
          <View style={styles.visibilityCopy}>
            <Text style={styles.visibilityTitle}>Visibility</Text>
            <Text style={styles.visibilityBody}>
              {editor.active
                ? 'This service will be live when onboarding finishes.'
                : 'Keep it hidden for now and enable it later.'}
            </Text>
          </View>
          <AppButton
            label={editor.active ? 'Enabled' : 'Disabled'}
            variant={editor.active ? 'secondary' : 'ghost'}
            onPress={() => setEditor((current) => ({ ...current, active: !current.active }))}
            style={styles.visibilityButton}
          />
        </View>

        <View style={styles.editorActions}>
          <AppButton
            label={editingIndex !== null ? 'Update service' : 'Add service'}
            variant="accent"
            onPress={saveEditor}
            disabled={!editorValid}
            style={styles.editorPrimary}
          />
          {editorDirty ? (
            <AppButton
              label={editingIndex !== null ? 'Cancel edit' : 'Discard draft'}
              variant="ghost"
              onPress={resetEditor}
              style={styles.editorSecondary}
            />
          ) : null}
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <SectionHeader title="Current services" actionLabel={services.length ? `${activeCount} enabled` : 'Start with one'} />
        {!services.length ? (
          <Text style={styles.emptyState}>
            Add at least one service to keep onboarding moving. Start narrow if you want and expand after launch.
          </Text>
        ) : (
          <View style={styles.catalogList}>
            {services.map((service, index) => {
              const active = service.active ?? true;
              return (
                <View key={`${service.id ?? 'draft'}-${index}`} style={styles.serviceCard}>
                  <View style={styles.serviceHeader}>
                    <View style={styles.serviceTitleBlock}>
                      <Text style={styles.serviceTitle}>{service.title || 'Untitled service'}</Text>
                      <Text style={styles.serviceMeta}>
                        {formatCategory(service.category)} · {service.durationMinutes ?? 0} min · ${service.price ?? 0}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, active ? styles.statusActive : styles.statusInactive]}>
                      <Text style={[styles.statusText, active ? styles.statusTextActive : styles.statusTextInactive]}>
                        {active ? 'Enabled' : 'Hidden'}
                      </Text>
                    </View>
                  </View>
                  {service.description ? <Text style={styles.serviceDescription}>{service.description}</Text> : null}
                  <View style={styles.serviceActions}>
                    <AppButton
                      label="Edit"
                      variant="secondary"
                      onPress={() => startEditing(index)}
                      style={styles.serviceAction}
                    />
                    <AppButton
                      label={active ? 'Disable' : 'Enable'}
                      variant="ghost"
                      onPress={() => toggleService(index)}
                      style={styles.serviceAction}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </AppCard>

      {editorDirty ? (
        <Text style={styles.unsavedNote}>
          Save or discard the service you’re editing before continuing so nothing gets lost.
        </Text>
      ) : null}
    </OnboardingStepShell>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'strong' | 'muted' | 'accent';
}) {
  return (
    <View
      style={[
        styles.statPill,
        accent === 'strong' && styles.statStrong,
        accent === 'muted' && styles.statMuted,
        accent === 'accent' && styles.statAccent,
      ]}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    gap: spacing.md,
  },
  card: {
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statPill: {
    flex: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  statStrong: {
    backgroundColor: colors.bgStrong,
  },
  statMuted: {
    backgroundColor: colors.surfaceSubtleOrange,
  },
  statAccent: {
    backgroundColor: colors.surfaceSubtleGreen,
  },
  statValue: {
    ...typography.titleSm,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryBody: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  categoryBadgeText: {
    ...typography.labelMd,
    color: colors.textPrimary,
  },
  categoryBadgeCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  helper: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  starterWrap: {
    gap: spacing.sm,
  },
  starterTile: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bgBase,
    gap: spacing.xs,
  },
  starterTitle: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  starterMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  categorySection: {
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.labelMd,
    color: colors.textPrimary,
  },
  asterisk: {
    color: colors.surfaceAccent,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inlineHint: {
    color: colors.textSecondary,
  },
  inlineError: {
    ...typography.caption,
    color: colors.danger,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowField: {
    flex: 1,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
    padding: spacing.md,
  },
  visibilityCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  visibilityTitle: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  visibilityBody: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  visibilityButton: {
    minWidth: 112,
  },
  editorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editorPrimary: {
    flex: 1,
  },
  editorSecondary: {
    minWidth: 120,
  },
  catalogList: {
    gap: spacing.md,
  },
  serviceCard: {
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
    padding: spacing.md,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  serviceTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  serviceTitle: {
    ...typography.titleSm,
    color: colors.textPrimary,
  },
  serviceMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusActive: {
    backgroundColor: colors.surfaceSubtleGreen,
  },
  statusInactive: {
    backgroundColor: colors.surfaceSubtleOrange,
  },
  statusText: {
    ...typography.caption,
  },
  statusTextActive: {
    color: colors.completed,
  },
  statusTextInactive: {
    color: colors.pending,
  },
  serviceDescription: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  serviceActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  serviceAction: {
    flex: 1,
  },
  emptyState: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  unsavedNote: {
    ...typography.caption,
    color: colors.pending,
    textAlign: 'center',
  },
});
