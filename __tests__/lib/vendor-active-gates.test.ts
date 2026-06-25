import fs from 'fs';
import path from 'path';

// Ticket 06: marketplace RPCs must reject inactive vendors so that knowing an
// inactive vendor id is not enough to slot or book. True end-to-end coverage
// needs a live Postgres harness (not available here); these static-SQL checks
// assert the gates exist in the migration, matching the repo's existing
// SQL-content test style (see vendor-approval-rpcs.test.ts).
const gatesSql = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/add_vendor_active_marketplace_gates.sql'),
  'utf8',
);

describe('active-vendor marketplace gates (ticket 06, static SQL)', () => {
  it('defines the booking and slot RPCs', () => {
    expect(gatesSql).toContain('create or replace function public.create_booking');
    expect(gatesSql).toContain('create or replace function public.vendor_bookable_slots');
  });

  it('gates booking creation on an active vendor', () => {
    expect(gatesSql).toContain('is_active = true');
  });

  it('only exposes services belonging to an active vendor', () => {
    expect(gatesSql).toContain('v.is_active = true');
  });
});
