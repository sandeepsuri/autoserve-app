import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const vendorStripeSql = fs.readFileSync(
  path.join(root, 'supabase/migrations/add_vendor_stripe_connect.sql'),
  'utf8',
);
const bookingPaymentSql = fs.readFileSync(
  path.join(root, 'supabase/migrations/add_booking_payment_fields.sql'),
  'utf8',
);

describe('payment schema contracts (ticket 12, static SQL)', () => {
  it('adds protected Stripe Connect fields to vendors', () => {
    expect(vendorStripeSql).toContain('stripe_account_id text');
    expect(vendorStripeSql).toContain('stripe_transfers_status text not null default');
    expect(vendorStripeSql).toContain("check (stripe_transfers_status in ('inactive', 'pending', 'active'))");
    expect(vendorStripeSql).toContain('enforce_vendor_stripe_protected_columns');
    expect(vendorStripeSql).toContain('vendor_stripe_protected_columns_guard');
  });

  it('adds protected booking payment fields', () => {
    expect(bookingPaymentSql).toContain('stripe_payment_intent_id text');
    expect(bookingPaymentSql).toContain('payment_status text not null default');
    expect(bookingPaymentSql).toContain("check (payment_status in ('unpaid', 'requires_capture', 'captured', 'canceled', 'failed'))");
    expect(bookingPaymentSql).toContain('enforce_booking_payment_protected_columns');
    expect(bookingPaymentSql).toContain('booking_payment_protected_columns_guard');
  });

  it('adds idempotent payment event storage', () => {
    expect(bookingPaymentSql).toContain('create table if not exists public.payment_events');
    expect(bookingPaymentSql).toContain('stripe_event_id text not null unique');
    expect(bookingPaymentSql).toContain('payload jsonb not null');
  });

  it('defines narrow server-side state update RPCs', () => {
    expect(vendorStripeSql).toContain('set_vendor_stripe_connect_state');
    expect(bookingPaymentSql).toContain('set_booking_payment_state');
    expect(vendorStripeSql).toContain("set_config('app.bypass_protected_columns', 'true', true)");
    expect(bookingPaymentSql).toContain("set_config('app.bypass_protected_columns', 'true', true)");
  });
});
