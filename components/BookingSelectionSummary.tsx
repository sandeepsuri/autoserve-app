import { calculateBookingPrice, formatDuration, formatPrice, totalDurationMinutes } from '@/lib/booking-summary';
import { Service } from '@/types/domain';

import { BookingSummaryCard } from './BookingSummaryCard';

interface Props {
  title: string;
  vendorName: string;
  vehicleLabel: string;
  services: readonly Pick<Service, 'title' | 'price' | 'durationMinutes'>[];
  extraRows?: { label: string; value: string }[];
}

/** The vehicle and selected work, shown on every booking step. */
export function BookingSelectionSummary({ title, vendorName, vehicleLabel, services, extraRows = [] }: Props) {
  const names = services.map((service) => service.title).join(', ');
  const selectionRows = services.length
    ? [
        { label: 'Services', value: `${services.length} selected: ${names}` },
        { label: 'Total duration', value: formatDuration(totalDurationMinutes(services)) },
        { label: 'Estimate incl. fee', value: formatPrice(calculateBookingPrice(services).total) },
      ]
    : [{ label: 'Services', value: 'None selected yet' }];

  return (
    <BookingSummaryCard
      title={title}
      rows={[
        { label: 'Vendor', value: vendorName },
        { label: 'Vehicle', value: vehicleLabel },
        ...selectionRows,
        ...extraRows,
      ]}
    />
  );
}
