import {
  DOC_REVIEW_STATUS_LABEL,
  DOC_TYPE_LABEL,
  docReviewStatusColor,
  documentTypeLabel,
} from '@/lib/verification-document-display';
import { colors } from '@/constants/theme';
import type { VerificationDocumentReviewStatus, VerificationDocumentType } from '@/types/domain';

describe('verification document display helpers', () => {
  it('labels every document type', () => {
    const types: VerificationDocumentType[] = ['license', 'insurance', 'id', 'proof_of_address', 'other'];
    for (const type of types) {
      expect(DOC_TYPE_LABEL[type]).toBeTruthy();
      expect(documentTypeLabel(type)).toBe(DOC_TYPE_LABEL[type]);
    }
  });

  it('labels every review status', () => {
    const statuses: VerificationDocumentReviewStatus[] = ['pending', 'accepted', 'rejected'];
    for (const status of statuses) {
      expect(DOC_REVIEW_STATUS_LABEL[status]).toBeTruthy();
    }
    expect(DOC_REVIEW_STATUS_LABEL.rejected).toBe('Rejected');
  });

  it('colors accepted/rejected distinctly from pending', () => {
    expect(docReviewStatusColor('accepted')).toBe(colors.surfaceBrand);
    expect(docReviewStatusColor('rejected')).toBe(colors.danger);
    expect(docReviewStatusColor('pending')).toBe(colors.textSecondary);
  });
});
