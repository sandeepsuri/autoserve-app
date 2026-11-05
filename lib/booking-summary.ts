import { Service, Vehicle } from '@/types/domain';

/** Matches the fee `create_booking` charges on the server. */
const SERVICE_FEE_RATE = 0.12;

export function calculateBookingPrice(services: readonly Pick<Service, 'price'>[]) {
  const subtotal = services.reduce((sum, service) => sum + service.price, 0);
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100;
  const total = Math.round((subtotal + serviceFee) * 100) / 100;
  return { subtotal, serviceFee, total };
}

export function totalDurationMinutes(services: readonly Pick<Service, 'durationMinutes'>[]) {
  return services.reduce((sum, service) => sum + service.durationMinutes, 0);
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function formatPrice(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export function formatVehicleLabel(vehicle: Pick<Vehicle, 'year' | 'make' | 'model'> & Pick<Partial<Vehicle>, 'nickname'>) {
  const base = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  return vehicle.nickname ? `${vehicle.nickname} (${base})` : base;
}
