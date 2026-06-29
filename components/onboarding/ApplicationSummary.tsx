import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { BUSINESS_TYPE_LABELS, LOCATION_MODE_LABELS } from '@/lib/vendor-onboarding-steps';
import type { ServiceCategory, VendorOnboardingDraft } from '@/types/domain';

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  diagnostics: 'Diagnostics',
  oil: 'Oil',
  brakes: 'Brakes',
  tire: 'Tire',
  repairs: 'Repairs',
  bodywork: 'Bodywork',
  detailing: 'Detailing',
  tint: 'Tint',
};

interface SectionProps {
  draft: VendorOnboardingDraft | null | undefined;
  /**
   * Optional header override for the card. Defaults to a plain title
   * (read-only view). review.tsx passes a header that includes an "Edit"
   * affordance so editing chrome stays in one place (review.tsx) while the
   * card body markup stays shared with this component.
   */
  header?: ReactNode;
}

export function row(label: string, value: string | undefined) {
  return value ? (
    <View style={styles.row} key={label}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  ) : null;
}

/** Read-only "Account" section card (business type / name / description / contact). */
export function AccountSummaryCard({ draft, header }: SectionProps) {
  return (
    <AppCard style={styles.card}>
      {header ?? <Text style={typography.titleSm}>Account</Text>}
      {row('Type', draft?.businessType ? BUSINESS_TYPE_LABELS[draft.businessType] : undefined)}
      {row('Business name', draft?.profile?.businessName)}
      {row('Description', draft?.profile?.description)}
      {row('Contact', draft?.profile?.contactName)}
      {row('Email', draft?.profile?.contactEmail)}
      {row('Phone', draft?.profile?.contactPhone)}
    </AppCard>
  );
}

/** Read-only "Location" section card (mode / address / service radius). */
export function LocationSummaryCard({ draft, header }: SectionProps) {
  return (
    <AppCard style={styles.card}>
      {header ?? <Text style={typography.titleSm}>Location</Text>}
      {row('Mode', draft?.location?.mode ? LOCATION_MODE_LABELS[draft.location.mode] : undefined)}
      {row('Address', draft?.location?.address)}
      {draft?.location?.serviceRadiusMiles
        ? row('Service radius', `${draft.location.serviceRadiusMiles} mi`)
        : null}
    </AppCard>
  );
}

/** Read-only "Services" section card (catalog summary + per-service rows). */
export function ServicesSummaryCard({ draft, header }: SectionProps) {
  const services = useMemo(() => draft?.services ?? [], [draft?.services]);
  const activeServices = useMemo(() => services.filter((s) => s.active ?? true), [services]);
  const hiddenServices = useMemo(() => services.filter((s) => !(s.active ?? true)), [services]);
  const categorySummary = useMemo(() => {
    return Array.from(
      new Set(
        services
          .map((service) => service.category)
          .filter((category): category is ServiceCategory => Boolean(category)),
      ),
    ).map((category) => CATEGORY_LABELS[category]);
  }, [services]);

  return (
    <AppCard style={styles.card}>
      {header ?? <Text style={typography.titleSm}>Services</Text>}
      {services.length ? (
        <>
          <View style={styles.serviceSummaryRow}>
            <SummaryBadge label={`${activeServices.length} enabled`} tone="active" />
            <SummaryBadge label={`${hiddenServices.length} hidden`} tone="muted" />
            <SummaryBadge label={`${categorySummary.length} categories`} tone="neutral" />
          </View>
          {categorySummary.length ? (
            <Text style={styles.categorySummary}>{categorySummary.join(' · ')}</Text>
          ) : null}
          {services.map((service, index) => (
            <View key={`${service.id ?? 'service'}-${index}`} style={styles.serviceRow}>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceTitle}>{service.title ?? 'Untitled service'}</Text>
                <Text style={styles.serviceMeta}>
                  {service.category ? CATEGORY_LABELS[service.category] : 'Uncategorized'} ·{' '}
                  {service.durationMinutes ?? 0} min · ${service.price ?? 0}
                </Text>
                {service.description ? (
                  <Text style={styles.serviceDescription}>{service.description}</Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.statusPill,
                  (service.active ?? true) ? styles.statusActive : styles.statusInactive,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    (service.active ?? true) ? styles.statusTextActive : styles.statusTextInactive,
                  ]}
                >
                  {(service.active ?? true) ? 'Enabled' : 'Hidden'}
                </Text>
              </View>
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.rowLabel}>No services added yet.</Text>
      )}
    </AppCard>
  );
}

function SummaryBadge({ label, tone }: { label: string; tone: 'active' | 'muted' | 'neutral' }) {
  return (
    <View
      style={[
        summaryStyles.badge,
        tone === 'active' && summaryStyles.active,
        tone === 'muted' && summaryStyles.muted,
        tone === 'neutral' && summaryStyles.neutral,
      ]}
    >
      <Text style={summaryStyles.label}>{label}</Text>
    </View>
  );
}

interface Props {
  draft: VendorOnboardingDraft | null | undefined;
}

/**
 * Read-only view of a vendor application's Account / Location / Services
 * sections (in that order). No edit affordances and no submit/finish
 * control. Availability is intentionally omitted — it's device-local state
 * in useVendorAvailabilityStore, not part of the submitted application
 * record, and isn't shown here (matching the prior pending-review screen).
 *
 * Used by ApplicationStatusScreen for submitted/under_review applicants.
 * app/(auth)/vendor-onboarding/review.tsx renders the same
 * Account/Location/Services cards directly (via the exported
 * AccountSummaryCard/LocationSummaryCard/ServicesSummaryCard) so it can
 * interleave its own Availability card and Edit affordances, keeping a
 * single source of truth for the card body markup.
 */
export function ApplicationSummary({ draft }: Props) {
  return (
    <>
      <AccountSummaryCard draft={draft} />
      <LocationSummaryCard draft={draft} />
      <ServicesSummaryCard draft={draft} />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabel: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.bodyMd,
    color: colors.textPrimary,
    textAlign: 'right',
    flex: 1,
  },
  serviceSummaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categorySummary: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  serviceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
    padding: spacing.md,
  },
  serviceInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  serviceTitle: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  serviceMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  serviceDescription: {
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
});

const summaryStyles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  active: {
    backgroundColor: colors.surfaceSubtleGreen,
  },
  muted: {
    backgroundColor: colors.surfaceSubtleOrange,
  },
  neutral: {
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
