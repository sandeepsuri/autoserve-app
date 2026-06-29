import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import {
  VerificationDocument,
  VerificationDocumentReviewStatus,
  VerificationDocumentType,
} from '@/types/domain';

import { isSupabaseConfigured, supabase } from './supabase';

export const VERIFICATION_BUCKET = 'vendor-verification-documents';

export interface VerificationDocumentUpload {
  documentType: VerificationDocumentType;
  /** Local file URI from the document picker. */
  uri: string;
  /** Original file name (used to derive the stored object name). */
  name: string;
  mimeType?: string;
  /** Optional explicit application id; resolved from the owner's application otherwise. */
  applicationId?: string;
}

type DocumentRow = {
  id: string;
  application_id: string;
  owner_id: string;
  document_type: VerificationDocumentType;
  storage_path: string;
  review_status: VerificationDocumentReviewStatus;
  reviewer_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function rowToDocument(row: DocumentRow): VerificationDocument {
  return {
    id: row.id,
    applicationId: row.application_id,
    ownerId: row.owner_id,
    documentType: row.document_type,
    storagePath: row.storage_path,
    reviewStatus: row.review_status,
    reviewerNotes: row.reviewer_notes ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function currentOwnerId(): string | null {
  return useAuthStore.getState().session?.userId ?? null;
}

// Object names live under an owner-scoped prefix so storage RLS
// (`(storage.foldername(name))[1] = auth.uid()`) authorizes the upload.
function buildStoragePath(ownerId: string, applicationId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  return `${ownerId}/${applicationId}/${Date.now()}-${safeName}`;
}

async function resolveApplicationId(ownerId: string): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    const application = useDemoDataStore
      .getState()
      .vendorApplications.find((a) => a.ownerId === ownerId);
    if (!application) {
      throw new Error('Start your vendor application before uploading documents.');
    }
    return application.id;
  }

  const { data, error } = await supabase
    .from('vendor_applications')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    throw new Error('Start your vendor application before uploading documents.');
  }
  return data.id as string;
}

export async function listMyVerificationDocuments(): Promise<VerificationDocument[]> {
  const ownerId = currentOwnerId();
  if (!ownerId) return [];

  if (!isSupabaseConfigured || !supabase) {
    return useDemoDataStore
      .getState()
      .verificationDocuments.filter((doc) => doc.ownerId === ownerId);
  }

  const { data, error } = await supabase
    .from('vendor_verification_documents')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => rowToDocument(row as DocumentRow));
}

export async function uploadVerificationDocument(
  input: VerificationDocumentUpload,
): Promise<VerificationDocument> {
  const ownerId = currentOwnerId();
  if (!ownerId) {
    throw new Error('You must be signed in to upload documents.');
  }

  const applicationId = input.applicationId ?? (await resolveApplicationId(ownerId));

  if (!isSupabaseConfigured || !supabase) {
    // Demo mode: persist metadata only — no real file is stored.
    const doc: VerificationDocument = {
      id: `demo-doc-${Date.now()}`,
      applicationId,
      ownerId,
      documentType: input.documentType,
      storagePath: buildStoragePath(ownerId, applicationId, input.name),
      reviewStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useDemoDataStore.getState().addVerificationDocument(doc);
    return doc;
  }

  const storagePath = buildStoragePath(ownerId, applicationId, input.name);

  const fileResponse = await fetch(input.uri);
  const bytes = await fileResponse.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(VERIFICATION_BUCKET)
    .upload(storagePath, bytes, {
      contentType: input.mimeType || 'application/octet-stream',
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('vendor_verification_documents')
    .insert({
      application_id: applicationId,
      owner_id: ownerId,
      document_type: input.documentType,
      storage_path: storagePath,
    })
    .select('*')
    .single();

  if (error) {
    // Best-effort cleanup so a failed metadata insert doesn't orphan the object.
    await supabase.storage.from(VERIFICATION_BUCKET).remove([storagePath]);
    throw error;
  }

  return rowToDocument(data as DocumentRow);
}

export async function deleteVerificationDocument(doc: VerificationDocument): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().removeVerificationDocument(doc.id);
    return;
  }

  // Remove the row first (RLS owner-scoped); then the storage object.
  const { error } = await supabase
    .from('vendor_verification_documents')
    .delete()
    .eq('id', doc.id);
  if (error) throw error;

  await supabase.storage.from(VERIFICATION_BUCKET).remove([doc.storagePath]);
}
