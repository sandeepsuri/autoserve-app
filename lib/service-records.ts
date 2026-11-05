import { Service } from '@/types/domain';

export function mapServiceRow(item: Record<string, unknown>): Service {
  return {
    id: item.id as string,
    vendorId: item.vendor_id as string,
    title: item.title as string,
    category: item.category as Service['category'],
    durationMinutes: item.duration_minutes as number,
    price: item.price as number,
    active: (item.active as boolean | null) ?? true,
    bookingEligibility: (item.booking_eligibility as Service['bookingEligibility'] | null) ?? 'both',
    description: (item.description as string | null) ?? undefined,
    image: (item.image as string | null) ?? undefined,
  };
}
