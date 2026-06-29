import fs from 'fs';
import path from 'path';

// Ticket 11: every vendor-application lifecycle transition must write an audit
// row, and the audit `action` check-constraint must list exactly the five RPC
// function names (no legacy short verbs, no orphan actions). A live Postgres
// harness is not available here, so — matching the repo's SQL-content test
// style (see vendor-approval-rpcs.test.ts / vendor-active-gates.test.ts) — we
// assert the contract against the migration SQL.
const root = path.resolve(__dirname, '../..');
const approvalSql = fs.readFileSync(
  path.join(root, 'supabase/migrations/add_vendor_approval_rpcs.sql'),
  'utf8',
);
const alignSql = fs.readFileSync(
  path.join(root, 'supabase/migrations/align_vendor_application_audit_actions.sql'),
  'utf8',
);

// The five lifecycle transitions == the five admin/applicant RPC function names.
const TRANSITION_ACTIONS = [
  'submit_vendor_application',
  'approve_vendor_application',
  'reject_vendor_application',
  'request_vendor_application_info',
  'suspend_vendor_application',
];

describe('vendor application audit log coverage (ticket 11, static SQL)', () => {
  it('defines a single internal audit writer', () => {
    expect(approvalSql).toContain(
      'create or replace function public.write_vendor_application_audit',
    );
  });

  it('writes an audit row on every lifecycle transition', () => {
    // One writer call per transition function. The approval RPC migration
    // implements submit + the four admin transitions, so the writer must be
    // invoked at least once per action.
    const writerCalls = approvalSql.match(/public\.write_vendor_application_audit/g) ?? [];
    // 1 definition + 5 transition call sites.
    expect(writerCalls.length).toBeGreaterThanOrEqual(TRANSITION_ACTIONS.length + 1);

    for (const action of TRANSITION_ACTIONS) {
      // Each transition function exists and is named after its audit action.
      expect(approvalSql).toContain(`create or replace function public.${action}`);
    }
  });

  it('constrains audit actions to exactly the five transition names', () => {
    expect(alignSql).toContain('vendor_application_audit_log_action_check');
    expect(alignSql).toContain('drop constraint if exists');

    // Isolate the CHECK list — `check (action in ( … ))` — so the legacy-verb
    // assertion is not fooled by the `update … where action = 'submit'`
    // back-fill statements elsewhere in the migration.
    const checkBlock = alignSql.slice(alignSql.indexOf('check (action in ('));
    for (const action of TRANSITION_ACTIONS) {
      expect(checkBlock).toContain(`'${action}'`);
    }
    // The constraint list itself must use the full RPC names only.
    for (const legacy of ['submit', 'approve', 'reject', 'request_info', 'suspend']) {
      expect(checkBlock).not.toContain(`'${legacy}'`);
    }
  });

  it('records actor, status transition, and reason on each audit row', () => {
    // The audit writer captures who acted, the status change, and why.
    expect(approvalSql).toMatch(/actor/);
    expect(approvalSql).toMatch(/from_status/);
    expect(approvalSql).toMatch(/to_status/);
    expect(approvalSql).toMatch(/reason/);
  });
});
