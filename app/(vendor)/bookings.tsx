import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AdjustAvailabilityModal } from '@/components/AdjustAvailabilityModal';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { Screen } from '@/components/Screen';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { STATUS_COLORS, STATUS_LABEL } from '@/lib/booking-status';
import { listBookingsForVendorOwner, updateBookingStatus } from '@/lib/bookings';
import { formatScheduledEST } from '@/lib/format';
import { getVendorForOwner } from '@/lib/vendor-admin';
import { loadVendorAvailability } from '@/lib/vendor-availability';
import { useAuthStore } from '@/store/useAuthStore';
import { useVendorAvailabilityStore } from '@/store/useVendorAvailabilityStore';
import { BookingRecord } from '@/types/domain';

type StatusTab = 'pending' | 'confirmed' | 'completed' | 'cancelled';

// Derive initials from a display name, fallback to 'CL'
function getInitials(name?: string): string {
  if (!name) return 'CL';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Relative time from an ISO createdAt string
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

const SECTION_LABELS: Record<StatusTab, string> = {
  pending: 'Pending review',
  confirmed: 'Confirmed bookings',
  completed: 'Completed bookings',
  cancelled: 'Cancelled bookings',
};

export default function VendorBookingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<StatusTab>('pending');
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const userId = useAuthStore((s) => s.session?.userId ?? 'anon');

  const { data: bookings = [], isLoading, error } = useQuery({
    queryKey: ['vendor-bookings', 'vendor', userId],
    queryFn: () => listBookingsForVendorOwner(userId),
    enabled: userId !== 'anon',
  });

  // Resolve the signed-in owner's vendor + load its saved availability so the
  // Adjust availability modal reflects what's persisted (not local defaults)
  // and saves against an explicit vendorId.
  const setAvailability = useVendorAvailabilityStore((s) => s.setAvailability);
  const { data: vendorAvailability } = useQuery({
    queryKey: ['vendor-availability', userId],
    queryFn: async () => {
      const vendor = await getVendorForOwner();
      if (!vendor) return null;
      const availability = await loadVendorAvailability(vendor.id);
      return { vendorId: vendor.id, availability };
    },
    enabled: userId !== 'anon',
  });

  useEffect(() => {
    if (vendorAvailability?.availability) {
      setAvailability(vendorAvailability.availability);
    }
  }, [vendorAvailability, setAvailability]);

  const filtered = bookings.filter((b) => b.status === tab);

  // Live counts per status
  const countOf = (s: StatusTab) => bookings.filter((b) => b.status === s).length;
  const pendingCount = countOf('pending');
  const confirmedCount = countOf('confirmed');

  // Expected earnings: sum of total across pending + confirmed bookings
  const expectedEarnings = bookings
    .filter((b) => b.status === 'pending' || b.status === 'confirmed')
    .reduce((sum, b) => sum + (b.total ?? 0), 0);

  const invalidateAll = (bookingId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] }),
      queryClient.invalidateQueries({ queryKey: ['client-bookings'] }),
      queryClient.invalidateQueries({ queryKey: ['booking-detail', bookingId] }),
    ]);

  const accept = async (booking: BookingRecord) => {
    try {
      await updateBookingStatus(booking.id, 'confirmed');
      await invalidateAll(booking.id);
    } catch (err) {
      Alert.alert('Could not accept booking', err instanceof Error ? err.message : String(err));
    }
  };

  const reject = async (booking: BookingRecord) => {
    try {
      await updateBookingStatus(booking.id, 'cancelled');
      await invalidateAll(booking.id);
    } catch (err) {
      Alert.alert('Could not reject booking', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Text style={typography.titleLg}>Bookings</Text>
        <Text style={styles.headerSub}>
          Review requests and keep today&apos;s schedule moving.
        </Text>
      </View>

      {/* Today's queue summary card */}
      <View style={[styles.queueCard, shadows.card]}>
        <View style={styles.queueTop}>
          <View style={styles.queueTextBlock}>
            <Text style={styles.queueTitle}>Today&apos;s queue</Text>
            <Text style={styles.queueSub}>
              {pendingCount > 0
                ? `${pendingCount} pending ${pendingCount === 1 ? 'request' : 'requests'} awaiting review.`
                : 'No pending requests right now.'}
            </Text>
          </View>
          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeText}>{pendingCount + confirmedCount}</Text>
          </View>
        </View>
        <View style={styles.metricStrip}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{pendingCount}</Text>
            <Text style={styles.metricLabel}>Pending</Text>
          </View>
          <View style={[styles.metric, styles.metricBorder]}>
            <Text style={styles.metricValue}>{confirmedCount}</Text>
            <Text style={styles.metricLabel}>Confirmed</Text>
          </View>
          <View style={[styles.metric, styles.metricBorder]}>
            <Text style={styles.metricValue}>{`$${Math.round(expectedEarnings)}`}</Text>
            <Text style={styles.metricLabel}>Expected</Text>
          </View>
        </View>
      </View>

      {/* Status filter chips — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        <FilterChip
          label="Pending"
          active={tab === 'pending'}
          onPress={() => setTab('pending')}
          count={countOf('pending')}
        />
        <FilterChip
          label="Confirmed"
          active={tab === 'confirmed'}
          onPress={() => setTab('confirmed')}
          count={countOf('confirmed')}
        />
        <FilterChip
          label="Completed"
          active={tab === 'completed'}
          onPress={() => setTab('completed')}
          count={countOf('completed')}
        />
        <FilterChip
          label="Cancelled"
          active={tab === 'cancelled'}
          onPress={() => setTab('cancelled')}
          count={countOf('cancelled')}
        />
      </ScrollView>

      {/* Section label row */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>{SECTION_LABELS[tab]}</Text>
        <Text style={styles.sectionCaption}>Sorted by earliest</Text>
      </View>

      {/* Loading state */}
      {isLoading && (
        <AppCard style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading bookings…</Text>
        </AppCard>
      )}

      {/* Error state */}
      {!isLoading && error ? (
        <EmptyState
          title="Could not load bookings"
          body={error instanceof Error ? error.message : 'Please try again after refreshing the screen.'}
        />
      ) : null}

      {/* Empty state for active tab */}
      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState
          title={`No ${tab} bookings`}
          body="As new requests arrive, they will appear in the correct status tab here."
        />
      )}

      {/* Booking cards */}
      {!isLoading && !error && filtered.length > 0 &&
        filtered.map((booking) => {
          const pill = STATUS_COLORS[booking.status];
          const initials = getInitials(booking.clientName);
          const schedule =
            booking.appointmentDate && booking.appointmentTime
              ? `${booking.appointmentDate} · ${booking.appointmentTime}`
              : formatScheduledEST(booking.scheduledAt);
          const isMobile = booking.bookingMode === 'mobile';

          return (
            <Pressable
              key={booking.id}
              onPress={() => router.push(`/(vendor)/booking-detail/${booking.id}`)}
            >
              <AppCard style={styles.bookingCard}>
                {/* Top accent bar: orange for pending, brand for others */}
                <View
                  style={[
                    styles.accentBar,
                    {
                      backgroundColor:
                        booking.status === 'pending'
                          ? colors.surfaceAccent
                          : booking.status === 'confirmed'
                          ? colors.surfaceBrand
                          : booking.status === 'completed'
                          ? colors.surfaceSuccess
                          : colors.textTertiary,
                    },
                  ]}
                />

                <View style={styles.cardInner}>
                  {/* Customer row */}
                  <View style={styles.customerRow}>
                    <View style={styles.customerLeft}>
                      {/* Avatar */}
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                      </View>
                      {/* Name / vehicle / requested */}
                      <View style={styles.customerInfo}>
                        <Text style={styles.clientName} numberOfLines={1}>
                          {booking.clientName ?? 'Client'}
                        </Text>
                        {booking.vehicleLabel ? (
                          <Text style={styles.vehicleLabel} numberOfLines={1}>
                            {booking.vehicleLabel}
                          </Text>
                        ) : null}
                        <Text style={styles.requestedAgo}>
                          Requested {relativeTime(booking.createdAt)}
                        </Text>
                      </View>
                    </View>
                    {/* Status pill */}
                    <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                      <Text style={[styles.statusPillText, { color: pill.fg }]}>
                        {STATUS_LABEL[booking.status]}
                      </Text>
                    </View>
                  </View>

                  {/* Service pills */}
                  <View style={styles.servicePillsRow}>
                    {booking.services.length > 0 ? (
                      booking.services.map((svc) => (
                        <View key={svc.serviceId} style={styles.servicePill}>
                          <Text style={styles.servicePillText} numberOfLines={1}>
                            {svc.title}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <View style={styles.servicePill}>
                        <Text style={styles.servicePillText}>—</Text>
                      </View>
                    )}
                  </View>

                  {/* Detail grid: up to 4 boxes */}
                  <View style={styles.detailGrid}>
                    <View style={styles.detailBox}>
                      <Text style={styles.detailLabel}>TIME</Text>
                      <Text style={styles.detailValue} numberOfLines={2}>
                        {schedule || '—'}
                      </Text>
                    </View>
                    <View style={styles.detailBox}>
                      <Text style={styles.detailLabel}>ESTIMATE</Text>
                      <Text style={styles.detailValue}>{`$${booking.total.toFixed(2)}`}</Text>
                    </View>
                    <View style={styles.detailBox}>
                      <Text style={styles.detailLabel}>MODE</Text>
                      <Text style={styles.detailValue}>
                        {isMobile ? 'Mobile service' : 'At the shop'}
                      </Text>
                    </View>
                    {isMobile && booking.mobileAddress ? (
                      <View style={styles.detailBox}>
                        <Text style={styles.detailLabel}>AREA</Text>
                        <Text style={styles.detailValue} numberOfLines={2}>
                          {booking.mobileAddress}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Notes box — only when truthy */}
                  {booking.notes ? (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesText}>{booking.notes}</Text>
                    </View>
                  ) : null}

                  {/* Actions */}
                  {booking.status === 'pending' ? (
                    <View style={styles.actionsRow}>
                      <AppButton
                        label="Accept"
                        variant="accent"
                        style={styles.actionButton}
                        onPress={() => accept(booking)}
                      />
                      <AppButton
                        label="Reject"
                        variant="destructive"
                        style={styles.actionButton}
                        onPress={() => reject(booking)}
                      />
                    </View>
                  ) : (
                    <AppButton
                      label="Details"
                      variant="secondary"
                      onPress={() => router.push(`/(vendor)/booking-detail/${booking.id}`)}
                    />
                  )}
                </View>
              </AppCard>
            </Pressable>
          );
        })}

      {/* Bottom action area */}
      <View style={styles.bottomActions}>
        <AppButton
          label="Filter"
          variant="secondary"
          style={styles.filterButton}
          onPress={() => {/* non-critical filter affordance */}}
        />
        <AppButton
          label="Adjust availability"
          variant="primary"
          style={styles.availabilityButton}
          onPress={() => setAvailabilityOpen(true)}
        />
      </View>

      {/* Adjust Availability modal — Ticket 2 */}
      <AdjustAvailabilityModal
        visible={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
        vendorId={vendorAvailability?.vendorId}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  headerSub: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },

  // Today's queue card
  queueCard: {
    backgroundColor: colors.bgStrong,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  queueTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  queueTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  queueTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    lineHeight: 24,
    color: colors.textInverse,
  },
  queueSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: '#CBD5E1',
  },
  queueBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.11)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    lineHeight: 28,
    color: colors.textInverse,
  },
  metricStrip: {
    flexDirection: 'row',
  },
  metric: {
    flex: 1,
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'flex-start',
  },
  metricBorder: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.12)',
    paddingLeft: spacing.md,
  },
  metricValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    lineHeight: 24,
    color: colors.textInverse,
  },
  metricLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    lineHeight: 14,
    color: '#CBD5E1',
  },

  // Filters
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
  },

  // Section label
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  sectionCaption: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 15,
    color: colors.textTertiary,
  },

  // Loading
  loadingCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },

  // Booking card
  bookingCard: {
    padding: 0,
    overflow: 'hidden',
    gap: 0,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  cardInner: {
    padding: spacing.lg,
    gap: spacing.md,
  },

  // Customer row
  customerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  customerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceBrand,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    lineHeight: 18,
    color: colors.textInverse,
  },
  customerInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  clientName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  vehicleLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  requestedAgo: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textTertiary,
  },
  statusPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  statusPillText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    lineHeight: 14,
  },

  // Service pills
  servicePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  servicePill: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  servicePillText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textPrimary,
  },

  // Detail grid
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailBox: {
    // Each box takes roughly half the available width accounting for gap
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radius.sm,
    backgroundColor: colors.bgBase,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 60,
  },
  detailLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.6,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    lineHeight: 17,
    color: colors.textPrimary,
  },

  // Notes box
  notesBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.surfaceBrand,
    borderRadius: radius.sm,
    backgroundColor: '#F6FBFF',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  notesText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },

  // Bottom actions
  bottomActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterButton: {
    flex: 0,
    minWidth: 80,
  },
  availabilityButton: {
    flex: 1,
  },
});
