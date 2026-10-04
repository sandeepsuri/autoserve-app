import fs from 'fs';
import path from 'path';

const vendorBookings = fs.readFileSync(path.join(process.cwd(), 'app/(vendor)/bookings.tsx'), 'utf8');
const vendorDashboard = fs.readFileSync(path.join(process.cwd(), 'app/(vendor)/index.tsx'), 'utf8');
const clientBookings = fs.readFileSync(path.join(process.cwd(), 'app/(client)/bookings.tsx'), 'utf8');

describe('vendor booking card references', () => {
  it('shows a booking public reference when one exists', () => {
    expect(vendorBookings).toContain("booking.publicReference ? (");
    expect(vendorBookings).toContain('Reference: {booking.publicReference}');
  });

  it('does not fall back to exposing the internal booking id on cards', () => {
    expect(vendorBookings).not.toContain('Reference: {booking.publicReference ?? booking.id}');
  });

  it('shows the public reference on vendor dashboard cards', () => {
    expect(vendorDashboard).toContain('Reference: {booking.publicReference}');
    expect(vendorDashboard).not.toContain('Reference: {booking.publicReference ?? booking.id}');
  });

  it('shows the public reference on client booking cards', () => {
    expect(clientBookings).toContain('Reference: {booking.publicReference}');
    expect(clientBookings).not.toContain('Reference: {booking.publicReference ?? booking.id}');
  });
});
