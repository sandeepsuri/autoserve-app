import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { FilterChip } from '@/components/FilterChip';
import { OnboardingStepShell } from '@/components/onboarding/OnboardingStepShell';
import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  DOC_REVIEW_STATUS_LABEL,
  DOC_TYPE_LABEL,
  docReviewStatusColor,
  documentTypeLabel,
} from '@/lib/verification-document-display';
import {
  deleteVerificationDocument,
  listMyVerificationDocuments,
  uploadVerificationDocument,
} from '@/lib/vendor-verification-documents';
import { VerificationDocument, VerificationDocumentType } from '@/types/domain';

const DOC_TYPES: { value: VerificationDocumentType; label: string }[] = (
  Object.keys(DOC_TYPE_LABEL) as VerificationDocumentType[]
).map((value) => ({ value, label: DOC_TYPE_LABEL[value] }));

export default function DocumentsStep() {
  const [docs, setDocs] = useState<VerificationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<VerificationDocumentType>('license');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listMyVerificationDocuments();
      setDocs(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.length) return;

    const file = result.assets[0];
    setBusy(true);
    try {
      await uploadVerificationDocument({
        documentType: docType,
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (doc: VerificationDocument) => {
    setError(null);
    setBusy(true);
    try {
      await deleteVerificationDocument(doc);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the document.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingStepShell
      stepId="documents"
      title="Verification documents"
      subtitle="Upload proof so our team can verify your business. This is optional now — you can add documents later if a reviewer requests them."
      canContinue={!busy}
      continueLabel="Continue"
    >
      <View style={styles.section}>
        <Text style={typography.labelMd}>Document type</Text>
        <View style={styles.chips}>
          {DOC_TYPES.map((type) => (
            <FilterChip
              key={type.value}
              label={type.label}
              active={docType === type.value}
              onPress={() => setDocType(type.value)}
            />
          ))}
        </View>
        <AppButton label="Add document" onPress={handleAdd} disabled={busy} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={colors.surfaceBrand} />
      ) : docs.length === 0 ? (
        <Text style={styles.empty}>No documents uploaded yet.</Text>
      ) : (
        <View style={styles.section}>
          {docs.map((doc) => (
            <AppCard key={doc.id} style={styles.docRow}>
              <View style={styles.docInfo}>
                <Text style={typography.labelMd}>{documentTypeLabel(doc.documentType)}</Text>
                <Text style={[styles.status, { color: docReviewStatusColor(doc.reviewStatus) }]}>
                  {DOC_REVIEW_STATUS_LABEL[doc.reviewStatus]}
                </Text>
                {doc.reviewStatus === 'rejected' && doc.reviewerNotes ? (
                  <Text style={styles.notes}>{doc.reviewerNotes}</Text>
                ) : null}
              </View>
              <AppButton label="Remove" variant="ghost" onPress={() => handleRemove(doc)} disabled={busy} />
            </AppCard>
          ))}
        </View>
      )}
    </OnboardingStepShell>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  docInfo: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  status: {
    ...typography.caption,
  },
  notes: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  empty: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
});
