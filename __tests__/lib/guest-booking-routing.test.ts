import fs from 'fs';
import path from 'path';

const shopDetail = fs.readFileSync(path.join(process.cwd(), 'components/ShopDetailScreen.tsx'), 'utf8');
const guestDetails = fs.readFileSync(path.join(process.cwd(), 'app/(public)/guest-booking/[vendorId]/details.tsx'), 'utf8');
const guestReview = fs.readFileSync(path.join(process.cwd(), 'app/(public)/guest-booking/[vendorId]/review.tsx'), 'utf8');
const guestConfirmation = fs.readFileSync(path.join(process.cwd(), 'app/(public)/guest-booking/[vendorId]/confirmation.tsx'), 'utf8');

describe('guest-only booking routing', () => {
  it('preserves the authenticated client booking entry route', () => {
    expect(shopDetail).toContain("if (session)");
    expect(shopDetail).toContain("router.push('/(client)/booking/vehicle')");
  });

  it('sends unauthenticated bookings to the public guest stack', () => {
    expect(shopDetail).toContain("/(public)/guest-booking/${vendor.id}/details");
  });

  it('keeps every guest step out of the client route group', () => {
    expect(guestDetails).not.toContain('/(client)');
    expect(guestReview).not.toContain('/(client)');
    expect(guestConfirmation).not.toContain('/(client)');
  });
});
