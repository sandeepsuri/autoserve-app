import {
  calculateBookingPrice,
  formatDuration,
  formatPrice,
  formatVehicleLabel,
  totalDurationMinutes,
} from '@/lib/booking-summary';

describe('calculateBookingPrice', () => {
  it('adds the service fee and rounds to cents', () => {
    expect(calculateBookingPrice([{ price: 70 }, { price: 40 }])).toEqual({ subtotal: 110, serviceFee: 13.2, total: 123.2 });
    expect(calculateBookingPrice([{ price: 19.99 }])).toEqual({ subtotal: 19.99, serviceFee: 2.4, total: 22.39 });
  });

  it('is zero with nothing selected', () => {
    expect(calculateBookingPrice([])).toEqual({ subtotal: 0, serviceFee: 0, total: 0 });
  });
});

describe('formatting', () => {
  it('totals and formats durations', () => {
    expect(totalDurationMinutes([{ durationMinutes: 30 }, { durationMinutes: 20 }])).toBe(50);
    expect(formatDuration(50)).toBe('50 min');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(95)).toBe('1 hr 35 min');
  });

  it('formats prices with cents', () => {
    expect(formatPrice(123.2)).toBe('$123.20');
  });

  it('names the vehicle, with its nickname when it has one', () => {
    const vehicle = { year: '2020', make: 'Honda', model: 'Civic' };
    expect(formatVehicleLabel(vehicle)).toBe('2020 Honda Civic');
    expect(formatVehicleLabel({ ...vehicle, nickname: 'Daily' })).toBe('Daily (2020 Honda Civic)');
  });
});
