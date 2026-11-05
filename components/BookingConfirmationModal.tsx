import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { calculateBookingPrice, formatDuration, formatPrice } from '@/lib/booking-summary';
import { Service } from '@/types/domain';

import { AppButton } from './AppButton';

interface Props {
  visible: boolean;
  submitting: boolean;
  vendorName: string;
  vehicleLabel: string;
  bookingTypeLabel: string;
  services: readonly Pick<Service, 'id' | 'title' | 'price' | 'durationMinutes'>[];
  dateLabel: string;
  timeLabel: string;
  location: string;
  paymentLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * The last check before a booking or payment exists. Cancel only closes this
 * modal. While submitting, every way out is disabled so the result stays visible.
 */
export function BookingConfirmationModal({
  visible,
  submitting,
  vendorName,
  vehicleLabel,
  bookingTypeLabel,
  services,
  dateLabel,
  timeLabel,
  location,
  paymentLabel,
  onCancel,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const { subtotal, serviceFee, total } = calculateBookingPrice(services);
  const cancel = () => {
    if (!submitting) onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancel}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View
        style={[
          styles.overlay,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={cancel}
          disabled={submitting}
          accessibilityLabel="Close confirmation"
        />
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={typography.titleMd}>Confirm your booking</Text>
          <ScrollView style={styles.details} contentContainerStyle={styles.detailsContent}>
            <DetailRow label="Vendor" value={vendorName} />
            <DetailRow label="Vehicle" value={vehicleLabel} />
            <DetailRow label="Booking type" value={bookingTypeLabel} />
            <DetailRow label="Date" value={dateLabel} />
            <DetailRow label="Time" value={timeLabel} />
            <DetailRow label="Location" value={location} />
            <DetailRow label="Payment" value={paymentLabel} />

            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>
              {services.length === 1 ? '1 service' : `${services.length} services`}
            </Text>
            {services.map((service) => (
              <DetailRow
                key={service.id}
                label={`${service.title} · ${formatDuration(service.durationMinutes)}`}
                value={formatPrice(service.price)}
              />
            ))}

            <View style={styles.divider} />
            <DetailRow label="Subtotal" value={formatPrice(subtotal)} />
            <DetailRow label="Service fee" value={formatPrice(serviceFee)} />
            <DetailRow label="Total" value={formatPrice(total)} emphasized />
          </ScrollView>

          {submitting ? (
            <View style={styles.progress} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.surfaceAccent} />
              <Text style={styles.progressText}>Submitting your booking…</Text>
            </View>
          ) : null}

          <AppButton
            label={submitting ? 'Confirming…' : 'Confirm'}
            variant="accent"
            disabled={submitting}
            onPress={onConfirm}
          />
          <AppButton label="Cancel" variant="secondary" disabled={submitting} onPress={cancel} />
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, emphasized && styles.emphasized]}>{label}</Text>
      <Text style={[styles.value, emphasized && styles.emphasized]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  card: {
    maxHeight: '100%',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
  },
  details: {
    flexShrink: 1,
  },
  detailsContent: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  label: {
    ...typography.bodyMd,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  value: {
    ...typography.labelMd,
    flexShrink: 1,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  emphasized: {
    ...typography.labelLg,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
    backgroundColor: colors.borderDefault,
  },
  sectionLabel: {
    ...typography.labelMd,
    color: colors.textPrimary,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  progressText: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
});
