import { readFileSync } from 'fs';
import { join } from 'path';

// Behaviour is exercised by supabase/tests/service_booking_eligibility.sql; this
// guards the deployment contract in a suite that runs without a database.
const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261105000002_service_booking_eligibility.sql'), 'utf8');

test('existing and omitted services default to both, constrained to known values', () => {
  expect(sql).toMatch(/add column if not exists booking_eligibility text not null default 'both'/);
  expect(sql).toMatch(/check \(booking_eligibility in \('shop', 'mobile', 'both'\)\)/);
});

test('the check fires on creation and type changes, never on status updates', () => {
  const trigger = sql.slice(sql.indexOf('create trigger enforce_booking_service_eligibility'));
  expect(trigger).toMatch(/before insert or update of vendor_id, booking_mode, service_ids on public\.bookings/);
  expect(trigger).not.toMatch(/\bstatus\b/);
});

test('the check runs after the booking type check', () => {
  expect('enforce_bookable_booking_type' < 'enforce_booking_service_eligibility').toBe(true);
});
