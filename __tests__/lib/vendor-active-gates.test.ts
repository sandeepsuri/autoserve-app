import fs from 'fs';
import path from 'path';

// Ticket 06 / Ticket 11: every public read+write path for a vendor must require
// vendors.is_active = true, so that knowing an inactive vendor id is not enough
// to discover it, inspect its services, slot it, or book it. True end-to-end
// coverage needs a live Postgres harness (not available here); these static-SQL
// checks assert each gate exists in its migration, matching the repo's existing
// SQL-content test style (see vendor-approval-rpcs.test.ts).
const root = path.resolve(__dirname, '../..');
const gatesSql = fs.readFileSync(
  path.join(root, 'supabase/migrations/add_vendor_active_marketplace_gates.sql'),
  'utf8',
);
// Discovery RLS for vendors + services lives in the protected-columns migration.
const discoverySql = fs.readFileSync(
  path.join(root, 'supabase/migrations/add_vendor_approval_protected_columns.sql'),
  'utf8',
);
// vendor_next_available is defined here and delegates to vendor_bookable_slots.
const slotsSql = fs.readFileSync(
  path.join(root, 'supabase/migrations/add_vendor_availability_slots_rpc.sql'),
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

// Ticket 11: assert the full bypass matrix — all four direct-by-id vectors are
// closed for inactive vendors.
describe('inactive-vendor bypass matrix (ticket 11, static SQL)', () => {
  it('discovery: vendors are only selectable when active (anon + authenticated)', () => {
    // Both the anon and authenticated SELECT policies require is_active.
    const vendorSelectPolicies = discoverySql.match(
      /create policy "vendors are [^"]+"\s+on public\.vendors for select[\s\S]*?using \([^)]*is_active = true[^)]*\);/g,
    );
    expect(vendorSelectPolicies).not.toBeNull();
    expect(vendorSelectPolicies!.length).toBeGreaterThanOrEqual(2);
  });

  it('discovery: services are only readable when their vendor is active', () => {
    // The public + authenticated services policies gate on the parent vendor.
    expect(discoverySql).toContain('services are publicly readable');
    expect(discoverySql).toContain('services are readable by all');
    const serviceGate = /v\.id = services\.vendor_id\s+and v\.is_active = true/g;
    expect(discoverySql.match(serviceGate)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('slots: vendor_bookable_slots returns nothing for an inactive vendor', () => {
    // The patched slots RPC short-circuits when the vendor is not active.
    expect(gatesSql).toMatch(
      /from vendors v\s+where v\.id = p_vendor_id\s+and v\.is_active = true/,
    );
  });

  it('next-available: vendor_next_available inherits the slot gate by delegation', () => {
    // vendor_next_available has no is_active check of its own — it must derive
    // its result from vendor_bookable_slots, which is gated. This guards against
    // someone giving it an independent (ungated) implementation later.
    expect(slotsSql).toContain('create or replace function public.vendor_next_available');
    expect(slotsSql).toMatch(
      /vendor_next_available[\s\S]*?from public\.vendor_bookable_slots\(/,
    );
  });

  it('booking: create_booking rejects an inactive vendor before doing work', () => {
    // The active check happens at vendor lookup, before service/slot validation.
    expect(gatesSql).toMatch(
      /from vendors\s+where id = p_vendor_id\s+and is_active = true;/,
    );
    expect(gatesSql).toContain("raise exception 'Vendor not found or not available for booking'");
  });
});
