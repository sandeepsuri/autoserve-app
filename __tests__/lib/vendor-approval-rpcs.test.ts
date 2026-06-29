import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const approvalSql = fs.readFileSync(
  path.join(root, 'supabase/migrations/add_vendor_approval_rpcs.sql'),
  'utf8',
);
const protectedColumnsSql = fs.readFileSync(
  path.join(root, 'supabase/migrations/add_vendor_approval_protected_columns.sql'),
  'utf8',
);
const applicationsSql = fs.readFileSync(
  path.join(root, 'supabase/migrations/add_vendor_applications_and_admin.sql'),
  'utf8',
);
const supabaseClient = fs.readFileSync(path.join(root, 'lib/supabase.ts'), 'utf8');

describe('vendor approval backend contract', () => {
  it('gates privileged transitions to admin_users through is_admin checks', () => {
    expect(applicationsSql).toContain('create table if not exists public.admin_users');
    expect(applicationsSql).toContain('create or replace function public.is_admin');
    expect(approvalSql.match(/if not public\.is_admin\(v_admin_id\) then/g)).toHaveLength(4);
    expect(approvalSql).toContain("raise exception 'Admin access required'");
  });

  it('creates one active application-linked vendor and prevents repeated approval duplicates', () => {
    expect(applicationsSql).toContain('vendors_one_active_per_owner_idx');
    expect(applicationsSql).toContain('vendors_one_per_application_idx');
    expect(approvalSql).toContain('pg_advisory_xact_lock');
    expect(approvalSql).toContain('application_id = v_app.id');
    expect(approvalSql).toContain('update public.vendors');
    expect(approvalSql).toContain('set is_active = false');
    expect(approvalSql).toContain('return v_existing_vendor');
  });

  it('creates vendor services from the submitted application service catalog', () => {
    expect(approvalSql).not.toContain('delete from public.services');
    expect(approvalSql).toContain('set active = false');
    expect(approvalSql).toContain('jsonb_array_elements(v_app.service_catalog)');
    expect(approvalSql).toContain("trim(v_service->>'title')");
    expect(approvalSql).toContain("v_service->>'category'");
  });

  it('supports reject, needs_more_info, and suspend transitions with audit fields', () => {
    expect(approvalSql).toContain('reject_vendor_application');
    expect(approvalSql).toContain('request_vendor_application_info');
    expect(approvalSql).toContain('suspend_vendor_application');

    // Audit action values must equal the RPC function names (no legacy short verbs).
    const fullActions = [
      'submit_vendor_application',
      'approve_vendor_application',
      'reject_vendor_application',
      'request_vendor_application_info',
      'suspend_vendor_application',
    ];
    for (const action of fullActions) {
      expect(approvalSql).toContain(`'${action}'`);
      expect(applicationsSql).toContain(`'${action}'`);
    }
    for (const legacy of ['submit', 'approve', 'reject', 'request_info', 'suspend']) {
      expect(approvalSql).not.toContain(`'${legacy}'`);
      expect(applicationsSql).not.toContain(`'${legacy}'`);
    }
    expect(applicationsSql).toContain('actor_id uuid not null');
    expect(applicationsSql).toContain('from_status text');
    expect(applicationsSql).toContain('to_status text');
    expect(applicationsSql).toContain('reason text');
    expect(applicationsSql).toContain('created_at timestamptz not null default now()');
    expect(approvalSql).toContain('public.write_vendor_application_audit');
  });

  it('keeps protected profile/vendor capability columns server-owned', () => {
    expect(protectedColumnsSql).toContain('Cannot self-assign role');
    expect(protectedColumnsSql).toContain('profiles.business_type is server-managed');
    expect(protectedColumnsSql).toContain('Vendor rows are created by admin approval only');
    expect(approvalSql).toContain('Do not overwrite profiles.role');
    expect(approvalSql).toContain('set business_type = v_app.business_type');
  });

  it('does not expose service-role keys in the client Supabase module', () => {
    expect(supabaseClient).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    expect(supabaseClient).not.toMatch(/SERVICE_ROLE|service_role|SUPABASE_SERVICE/);
  });
});
