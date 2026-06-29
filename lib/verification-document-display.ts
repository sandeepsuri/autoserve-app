import { colors } from '@/constants/theme';
import { VerificationDocumentReviewStatus, VerificationDocumentType } from '@/types/domain';

// Shared presentation for vendor verification documents, used by both the
// onboarding Documents step and the application status screen so the labels and
// status colors stay in sync.

export const DOC_TYPE_LABEL: Record<VerificationDocumentType, string> = {
  license: 'Business license',
  insurance: 'Insurance',
  id: 'Government ID',
  proof_of_address: 'Proof of address',
  other: 'Other',
};

export const DOC_REVIEW_STATUS_LABEL: Record<VerificationDocumentReviewStatus, string> = {
  pending: 'Pending review',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export function documentTypeLabel(type: VerificationDocumentType): string {
  return DOC_TYPE_LABEL[type] ?? 'Document';
}

export function docReviewStatusColor(status: VerificationDocumentReviewStatus): string {
  if (status === 'accepted') return colors.surfaceBrand;
  if (status === 'rejected') return colors.danger;
  return colors.textSecondary;
}
