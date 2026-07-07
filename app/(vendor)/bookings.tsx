import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { bookingPaymentLabel, listBookingsForVendorOwner } from '@/lib/bookings';
import { formatScheduledEST } from '@/lib/format';
import { captureBookingPayment, cancelBookingPayment } from '@/lib/payments';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getVendorForOwner } from '@/lib/vendor-admin';
import { loadVendorAvailability } from '@/lib/vendor-availability';
import { useAuthStore } from '@/store/useAuthStore';
import { useVendorAvailabilityStore } from '@/store/useVendorAvailabilityStore';
import { BookingRecord } from '@/types/domain';

type StatusTab = 'pending' | 'confirmed' | 'completed' | 'cancelled';
type PrimaryView = 'queue' | 'schedule';
type ScheduleRange = 'day' | 'week' | 'month';

type ScheduledBooking = {
  booking: BookingRecord;
  startsAt: Date;
  dateKey: string;
};

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months, 1);
  return next;
}

function parseAppointmentStart(booking: BookingRecord): Date | null {
  if (booking.appointmentDate && booking.appointmentTime) {
    const date = new Date(`${booking.appointmentDate}T${booking.appointmentTime}:00`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const fallback = new Date(booking.scheduledAt);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getScheduledBookings(bookings: BookingRecord[]): ScheduledBooking[] {
  return bookings
    .map((booking) => {
      const startsAt = parseAppointmentStart(booking);
      return startsAt ? { booking, startsAt, dateKey: toDateKey(startsAt) } : null;
    })
    .filter((entry): entry is ScheduledBooking => Boolean(entry))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function formatDayHeading(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatShortDay(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
  }).format(date);
}

function formatMonthHeading(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatAppointmentTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function serviceSummary(booking: BookingRecord) {
  return booking.services.length ? booking.services.map((service) => service.title).join(' · ') : 'Service request';
}

function statusAccent(status: BookingRecord['status']) {
  if (status === 'pending') return colors.surfaceAccent;
  if (status === 'confirmed') return colors.surfaceBrand;
  if (status === 'completed') return colors.surfaceSuccess;
  return colors.textTertiary;
}

function weekStartFor(date: Date) {
  const day = startOfDay(date);
  const mondayOffset = (day.getDay() + 6) % 7;
  return addDays(day, -mondayOffset);
}

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
  const [primaryView, setPrimaryView] = useState<PrimaryView>('queue');
  const [tab, setTab] = useState<StatusTab>('pending');
  const [scheduleRange, setScheduleRange] = useState<ScheduleRange>('day');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
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
      return { vendorId: vendor.id, vendor, availability };
    },
    enabled: userId !== 'anon',
  });

  useEffect(() => {
    if (vendorAvailability?.availability) {
      setAvailability(vendorAvailability.availability);
    }
  }, [vendorAvailability, setAvailability]);

  const filtered = useMemo(
    () =>
      bookings
        .filter((b) => b.status === tab)
        .sort((a, b) => {
          const left = parseAppointmentStart(a)?.getTime() ?? new Date(a.createdAt).getTime();
          const right = parseAppointmentStart(b)?.getTime() ?? new Date(b.createdAt).getTime();
          return left - right;
        }),
    [bookings, tab],
  );

  const scheduledBookings = useMemo(() => getScheduledBookings(bookings), [bookings]);
  const selectedDateKey = toDateKey(selectedDate);
  const dayAppointments = scheduledBookings.filter((entry) => entry.dateKey === selectedDateKey);
  const weekStart = weekStartFor(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthDays = Array.from(
    { length: new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate() },
    (_, index) => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), index + 1),
  );
  const visibleScheduleCount =
    scheduleRange === 'day'
      ? dayAppointments.length
      : scheduleRange === 'week'
      ? weekDays.reduce((sum, date) => sum + scheduledBookings.filter((entry) => entry.dateKey === toDateKey(date)).length, 0)
      : monthDays.reduce((sum, date) => sum + scheduledBookings.filter((entry) => entry.dateKey === toDateKey(date)).length, 0);

  // Live counts per status
  const countOf = (s: StatusTab) => bookings.filter((b) => b.status === s).length;
  const pendingCount = countOf('pending');
  const confirmedCount = countOf('confirmed');
  const payoutReady = !isSupabaseConfigured || vendorAvailability?.vendor?.stripeTransfersStatus === 'active';

  // Expected earnings: sum of total across pending + confirmed bookings
  const expectedEarnings = bookings
    .filter((b) => b.status === 'pending' || b.status === 'confirmed')
    .reduce((sum, b) => sum + (b.total ?? 0), 0);

  const moveScheduleWindow = (direction: -1 | 1) => {
    if (scheduleRange === 'day') {
      setSelectedDate((current) => addDays(current, direction));
      return;
    }
    if (scheduleRange === 'week') {
      setSelectedDate((current) => addDays(current, direction * 7));
      return;
    }
    setSelectedDate((current) => addMonths(current, direction));
  };

  const invalidateAll = (bookingId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] }),
      queryClient.invalidateQueries({ queryKey: ['client-bookings'] }),
      queryClient.invalidateQueries({ queryKey: ['booking-detail', bookingId] }),
    ]);

  const accept = async (booking: BookingRecord) => {
    try {
      await captureBookingPayment(booking.id);
      await invalidateAll(booking.id);
    } catch (err) {
      Alert.alert('Could not accept booking', err instanceof Error ? err.message : String(err));
    }
  };

  const reject = async (booking: BookingRecord) => {
    try {
      await cancelBookingPayment(booking.id);
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

      {!payoutReady && pendingCount > 0 ? (
        <AppCard style={styles.payoutGateCard}>
          <Text style={styles.payoutGateTitle}>Payouts not set up</Text>
          <Text style={styles.payoutGateBody}>
            You can still accept bookings — clients will pay at the shop. Set up payouts to accept in-app payments.
          </Text>
          <AppButton
            label="Set up payouts"
            variant="accent"
            style={styles.payoutGateButton}
            onPress={() => router.push('/(vendor)/profile')}
          />
        </AppCard>
      ) : null}

      <View style={styles.primaryToggle} accessibilityRole="tablist">
        {(['queue', 'schedule'] as PrimaryView[]).map((view) => {
          const active = primaryView === view;
          return (
            <Pressable
              key={view}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setPrimaryView(view)}
              style={[styles.primaryToggleItem, active && styles.primaryToggleItemActive]}
            >
              <Text style={[styles.primaryToggleText, active && styles.primaryToggleTextActive]}>
                {view === 'queue' ? 'Queue' : 'Schedule'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {primaryView === 'queue' ? (
        <>
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

                  {/* Detail grid: up to 5 boxes */}
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
                    <View style={styles.detailBox}>
                      <Text style={styles.detailLabel}>PAYMENT</Text>
                      <Text style={styles.detailValue}>{bookingPaymentLabel(booking)}</Text>
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
        </>
      ) : (
        <>
          <View style={[styles.scheduleSummary, shadows.floating]}>
            <View style={styles.scheduleSummaryTop}>
              <View style={styles.scheduleTitleBlock}>
                <Text style={styles.scheduleTitle}>
                  {scheduleRange === 'month' ? formatMonthHeading(selectedDate) : formatDayHeading(selectedDate)}
                </Text>
                <Text style={styles.scheduleSubtitle}>
                  {visibleScheduleCount} {visibleScheduleCount === 1 ? 'appointment' : 'appointments'} in view
                </Text>
              </View>
              <View style={styles.dateNav}>
                <Pressable
                  onPress={() => moveScheduleWindow(-1)}
                  accessibilityLabel={`Previous ${scheduleRange}`}
                  style={styles.dateNavButton}
                >
                  <Text style={styles.dateNavText}>‹</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSelectedDate(startOfDay(new Date()))}
                  accessibilityLabel="Go to today"
                  style={styles.todayButton}
                >
                  <Text style={styles.todayButtonText}>Today</Text>
                </Pressable>
                <Pressable
                  onPress={() => moveScheduleWindow(1)}
                  accessibilityLabel={`Next ${scheduleRange}`}
                  style={styles.dateNavButton}
                >
                  <Text style={styles.dateNavText}>›</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.rangeToggle} accessibilityRole="tablist">
              {(['day', 'week', 'month'] as ScheduleRange[]).map((range) => {
                const active = scheduleRange === range;
                return (
                  <Pressable
                    key={range}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setScheduleRange(range)}
                    style={[styles.rangeToggleItem, active && styles.rangeToggleItemActive]}
                  >
                    <Text style={[styles.rangeToggleText, active && styles.rangeToggleTextActive]}>
                      {range[0].toUpperCase() + range.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {isLoading && (
            <AppCard style={styles.loadingCard}>
              <Text style={styles.loadingText}>Loading schedule...</Text>
            </AppCard>
          )}

          {!isLoading && error ? (
            <EmptyState
              title="Could not load schedule"
              body={error instanceof Error ? error.message : 'Please try again after refreshing the screen.'}
            />
          ) : null}

          {!isLoading && !error && scheduleRange === 'day' ? (
            dayAppointments.length ? (
              <View style={styles.timeline}>
                {dayAppointments.map(({ booking, startsAt }) => {
                  const pill = STATUS_COLORS[booking.status];
                  const isMobile = booking.bookingMode === 'mobile';
                  return (
                    <Pressable
                      key={booking.id}
                      onPress={() => router.push(`/(vendor)/booking-detail/${booking.id}`)}
                      accessibilityLabel={`${formatAppointmentTime(startsAt)}, ${booking.clientName ?? 'Client'}, ${serviceSummary(booking)}, ${STATUS_LABEL[booking.status]}`}
                      style={styles.timelineRow}
                    >
                      <View style={styles.timelineTime}>
                        <Text style={styles.timelineTimeText}>{formatAppointmentTime(startsAt)}</Text>
                      </View>
                      <View style={[styles.appointmentBlock, { borderLeftColor: statusAccent(booking.status) }]}>
                        <View style={styles.appointmentTop}>
                          <View style={styles.appointmentCopy}>
                            <Text style={styles.appointmentCustomer} numberOfLines={1}>
                              {booking.clientName ?? 'Client'}
                            </Text>
                            <Text style={styles.appointmentService} numberOfLines={2}>
                              {serviceSummary(booking)}
                            </Text>
                          </View>
                          <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                            <Text style={[styles.statusPillText, { color: pill.fg }]}>
                              {STATUS_LABEL[booking.status]}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.appointmentMetaRow}>
                          <Text style={styles.appointmentMeta} numberOfLines={1}>
                            {booking.vehicleLabel ?? 'Vehicle pending'}
                          </Text>
                          <Text style={styles.appointmentMeta}>
                            {isMobile ? 'Mobile service' : 'At the shop'}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                title="No appointments this day"
                body="Confirmed and pending appointments for the selected day will appear here by time."
              />
            )
          ) : null}

          {!isLoading && !error && scheduleRange === 'week' ? (
            <View style={styles.weekGrid}>
              {weekDays.map((date) => {
                const key = toDateKey(date);
                const dayItems = scheduledBookings.filter((entry) => entry.dateKey === key);
                const pending = dayItems.filter((entry) => entry.booking.status === 'pending').length;
                const active = key === selectedDateKey;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setSelectedDate(date);
                      setScheduleRange('day');
                    }}
                    style={[styles.weekDay, active && styles.weekDayActive]}
                  >
                    <Text style={[styles.weekDayLabel, active && styles.weekDayLabelActive]}>
                      {formatShortDay(date)}
                    </Text>
                    <Text style={[styles.weekDayCount, active && styles.weekDayCountActive]}>
                      {dayItems.length}
                    </Text>
                    <Text style={[styles.weekDayMeta, active && styles.weekDayMetaActive]} numberOfLines={1}>
                      {dayItems.length === 1 ? 'job' : 'jobs'}
                    </Text>
                    {pending ? (
                      <Text style={[styles.weekDayPending, active && styles.weekDayPendingActive]} numberOfLines={1}>
                        {pending} pend.
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {!isLoading && !error && scheduleRange === 'month' ? (
            <View style={styles.monthGrid}>
              {monthDays.map((date) => {
                const key = toDateKey(date);
                const dayItems = scheduledBookings.filter((entry) => entry.dateKey === key);
                const pending = dayItems.filter((entry) => entry.booking.status === 'pending').length;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setSelectedDate(date);
                      setScheduleRange('day');
                    }}
                    style={styles.monthDay}
                  >
                    <Text style={styles.monthDayNumber}>{date.getDate()}</Text>
                    {dayItems.length ? (
                      <View style={styles.monthDensity}>
                        <Text style={styles.monthDensityText} numberOfLines={1}>
                          {dayItems.length} {dayItems.length === 1 ? 'job' : 'jobs'}
                        </Text>
                        {pending ? (
                          <Text style={styles.monthPendingText} numberOfLines={1}>
                            {pending} pending
                          </Text>
                        ) : null}
                      </View>
                    ) : (
                      <Text style={styles.monthEmpty}>-</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {!isLoading && !error && scheduleRange !== 'day' && visibleScheduleCount === 0 ? (
            <EmptyState
              title={`No appointments this ${scheduleRange}`}
              body="Schedule density will appear here as bookings are created or confirmed."
            />
          ) : null}
        </>
      )}

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
  payoutGateCard: {
    gap: spacing.xs,
    borderColor: colors.danger,
  },
  payoutGateTitle: {
    ...typography.labelLg,
    color: colors.danger,
  },
  payoutGateBody: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  payoutGateButton: {
    marginTop: spacing.sm,
  },
  primaryToggle: {
    minHeight: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    padding: 4,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  primaryToggleItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryToggleItemActive: {
    backgroundColor: colors.bgStrong,
  },
  primaryToggleText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  primaryToggleTextActive: {
    color: colors.textInverse,
  },
  scheduleSummary: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  scheduleSummaryTop: {
    gap: spacing.md,
  },
  scheduleTitleBlock: {
    gap: spacing.xs,
  },
  scheduleTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  scheduleSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateNavButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  todayButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  todayButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    lineHeight: 17,
    color: colors.textPrimary,
  },
  rangeToggle: {
    minHeight: 44,
    borderRadius: radius.full,
    backgroundColor: colors.bgBase,
    padding: 4,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  rangeToggleItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  rangeToggleItemActive: {
    backgroundColor: colors.bgStrong,
  },
  rangeToggleText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  rangeToggleTextActive: {
    color: colors.textInverse,
  },
  timeline: {
    gap: spacing.md,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timelineTime: {
    width: 70,
    paddingTop: spacing.md,
    flexShrink: 0,
  },
  timelineTimeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    lineHeight: 17,
    color: colors.textPrimary,
  },
  appointmentBlock: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    padding: spacing.md,
    gap: spacing.md,
  },
  appointmentTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  appointmentCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  appointmentCustomer: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  appointmentService: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  appointmentMetaRow: {
    gap: spacing.xs,
  },
  appointmentMeta: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weekDay: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 96,
    minHeight: 112,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    padding: spacing.md,
    gap: spacing.xs,
  },
  weekDayActive: {
    backgroundColor: colors.bgStrong,
    borderColor: colors.bgStrong,
  },
  weekDayLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  weekDayLabelActive: {
    color: colors.textInverse,
  },
  weekDayCount: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    lineHeight: 32,
    color: colors.textPrimary,
  },
  weekDayCountActive: {
    color: colors.textInverse,
  },
  weekDayMeta: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  weekDayMetaActive: {
    color: '#CBD5E1',
  },
  weekDayPending: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSubtleOrange,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    lineHeight: 13,
    color: colors.pending,
  },
  weekDayPendingActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    color: colors.textInverse,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  monthDay: {
    flexBasis: '21%',
    flexGrow: 1,
    minWidth: 72,
    minHeight: 92,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  monthDayNumber: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    lineHeight: 17,
    color: colors.textPrimary,
  },
  monthDensity: {
    gap: 2,
  },
  monthDensityText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    lineHeight: 14,
    color: colors.surfaceBrand,
  },
  monthPendingText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    lineHeight: 13,
    color: colors.pending,
  },
  monthEmpty: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 15,
    color: colors.textTertiary,
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
