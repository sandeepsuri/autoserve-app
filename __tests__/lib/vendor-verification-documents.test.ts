import fs from 'fs';
import path from 'path';

// ── Part 1: backend migration contract (static SQL) ───────────────────────────
// Matches the repo's SQL-content test style (see vendor-active-gates.test.ts):
// a live Postgres harness is unavailable, so assert the gates exist in the SQL.
const migrationSql = fs.readFileSync(
  path.resolve(__dirname, '../../supabase/migrations/add_vendor_verification_documents.sql'),
  'utf8',
);

describe('vendor verification documents migration (ticket 08, static SQL)', () => {
  it('creates a PRIVATE storage bucket', () => {
    expect(migrationSql).toContain("insert into storage.buckets");
    expect(migrationSql).toContain("'vendor-verification-documents'");
    expect(migrationSql).toMatch(/public\)\s*\n?\s*values\s*\('vendor-verification-documents'[^)]*false\)/);
    expect(migrationSql).toContain('set public = false');
  });

  it('defines the metadata table and enables RLS', () => {
    expect(migrationSql).toContain('create table if not exists public.vendor_verification_documents');
    expect(migrationSql).toContain('enable row level security');
  });

  it('row RLS limits applicants to their own rows and lets admins read all', () => {
    expect(migrationSql).toContain('owner_id = auth.uid()');
    expect(migrationSql).toContain('public.is_admin(auth.uid())');
  });

  it('storage RLS scopes owner objects to their own id prefix and gates admin reads', () => {
    expect(migrationSql).toContain("(storage.foldername(name))[1] = auth.uid()::text");
    expect(migrationSql).toContain('admins read all verification objects');
  });

  it('freezes review columns from applicant mutation', () => {
    expect(migrationSql).toContain('enforce_verification_document_protected_columns');
    expect(migrationSql).toContain('Document review fields are server-managed');
  });

  it('exposes an admin-only review RPC that bypasses the protected-column guard', () => {
    expect(migrationSql).toContain('create or replace function public.review_vendor_document');
    expect(migrationSql).toContain("raise exception 'Admin access required'");
    expect(migrationSql).toContain('public.set_bypass_protected_columns(true)');
    expect(migrationSql).toContain('A note is required when rejecting a document');
  });
});

// ── Part 2: service logic (mocked supabase + stores) ──────────────────────────
let mockIsSupabaseConfigured = false;
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockIsSupabaseConfigured;
  },
  get supabase() {
    return mockIsSupabaseConfigured ? { from: mockFrom } : null;
  },
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: { getState: jest.fn() },
}));

jest.mock('@/store/useDemoDataStore', () => ({
  useDemoDataStore: { getState: jest.fn() },
}));

import {
  deleteVerificationDocument,
  listMyVerificationDocuments,
  uploadVerificationDocument,
} from '@/lib/vendor-verification-documents';
import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import type { VerificationDocument } from '@/types/domain';

const mockAuthGetState = useAuthStore.getState as jest.Mock;
const mockDemoGetState = useDemoDataStore.getState as jest.Mock;

// Minimal stateful demo store stub.
function makeDemoState(ownerId: string) {
  const documents: VerificationDocument[] = [];
  return {
    verificationDocuments: documents,
    vendorApplications: [{ id: 'app-1', ownerId } as any],
    addVerificationDocument: (doc: VerificationDocument) => documents.unshift(doc),
    removeVerificationDocument: (id: string) => {
      const idx = documents.findIndex((d) => d.id === id);
      if (idx >= 0) documents.splice(idx, 1);
    },
  };
}

describe('vendor verification documents service (demo mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupabaseConfigured = false;
  });

  it('returns no documents when there is no session', async () => {
    mockAuthGetState.mockReturnValue({ session: null });
    mockDemoGetState.mockReturnValue(makeDemoState('owner-1'));

    await expect(listMyVerificationDocuments()).resolves.toEqual([]);
  });

  it('uploads, lists, and removes the applicant own documents in demo mode', async () => {
    const demo = makeDemoState('owner-1');
    mockAuthGetState.mockReturnValue({ session: { userId: 'owner-1', email: 'o@a.app' } });
    mockDemoGetState.mockReturnValue(demo);

    const created = await uploadVerificationDocument({
      documentType: 'license',
      uri: 'file:///tmp/license.pdf',
      name: 'license.pdf',
      mimeType: 'application/pdf',
    });

    expect(created.ownerId).toBe('owner-1');
    expect(created.applicationId).toBe('app-1');
    expect(created.reviewStatus).toBe('pending');
    expect(created.storagePath).toContain('owner-1/app-1/');

    await expect(listMyVerificationDocuments()).resolves.toHaveLength(1);

    await deleteVerificationDocument(created);
    await expect(listMyVerificationDocuments()).resolves.toHaveLength(0);
  });

  it('refuses upload when the applicant has no application yet', async () => {
    const demo = makeDemoState('owner-1');
    demo.vendorApplications = [];
    mockAuthGetState.mockReturnValue({ session: { userId: 'owner-1', email: 'o@a.app' } });
    mockDemoGetState.mockReturnValue(demo);

    await expect(
      uploadVerificationDocument({ documentType: 'id', uri: 'file:///id.jpg', name: 'id.jpg' }),
    ).rejects.toThrow(/Start your vendor application/);
  });
});

describe('vendor verification documents service (live mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupabaseConfigured = true;
    mockAuthGetState.mockReturnValue({ session: { userId: 'owner-1', email: 'o@a.app' } });
  });

  it('lists only the owner rows and maps them to domain shape', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'd1',
          application_id: 'app-1',
          owner_id: 'owner-1',
          document_type: 'insurance',
          storage_path: 'owner-1/app-1/x.pdf',
          review_status: 'accepted',
          reviewer_notes: 'looks good',
          created_at: '2026-06-26T00:00:00Z',
          updated_at: '2026-06-26T00:00:00Z',
        },
      ],
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const docs = await listMyVerificationDocuments();

    expect(mockFrom).toHaveBeenCalledWith('vendor_verification_documents');
    expect(eq).toHaveBeenCalledWith('owner_id', 'owner-1');
    expect(docs).toEqual([
      {
        id: 'd1',
        applicationId: 'app-1',
        ownerId: 'owner-1',
        documentType: 'insurance',
        storagePath: 'owner-1/app-1/x.pdf',
        reviewStatus: 'accepted',
        reviewerNotes: 'looks good',
        createdAt: '2026-06-26T00:00:00Z',
        updatedAt: '2026-06-26T00:00:00Z',
      },
    ]);
  });
});
