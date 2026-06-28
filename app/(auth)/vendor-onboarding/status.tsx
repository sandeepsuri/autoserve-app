import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { Screen } from '@/components/Screen';
import { ApplicationStatusScreen, ApplicationStatusScreenStatus } from '@/components/onboarding/ApplicationStatusScreen';
import { colors } from '@/constants/theme';
import { signOut } from '@/lib/auth';
import { shouldShowVendorApplicationStatus } from '@/lib/post-auth-destination';
import { loadVendorCapability } from '@/lib/vendor-capability';
import { loadVendorOnboardingDraft } from '@/lib/vendor-onboarding';
import { listMyVerificationDocuments } from '@/lib/vendor-verification-documents';
import { useAuthStore } from '@/store/useAuthStore';
import type { VendorApplicationStatus, VendorOnboardingDraft, VerificationDocument } from '@/types/domain';

const DOCUMENT_FEEDBACK_STATUSES: VendorApplicationStatus[] = ['needs_more_info', 'rejected'];

const DRAFT_DETAIL_STATUSES: VendorApplicationStatus[] = [
  'submitted',
  'under_review',
  'needs_more_info',
  'rejected',
];

export default function VendorApplicationStatusScreen() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const vendorCapability = useAuthStore((s) => s.vendorCapability);
  const setVendorCapability = useAuthStore((s) => s.setVendorCapability);
  const [capabilityLoading, setCapabilityLoading] = useState(false);
  const [draft, setDraft] = useState<VendorOnboardingDraft | null>(null);
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);

  const status = vendorCapability?.applicationStatus;
  const isRenderableStatus = shouldShowVendorApplicationStatus(status);

  useEffect(() => {
    if (!session || vendorCapability || capabilityLoading) return;

    let cancelled = false;
    setCapabilityLoading(true);
    loadVendorCapability()
      .then((capability) => {
        if (!cancelled) setVendorCapability(capability);
      })
      .catch(() => {
        if (!cancelled) setVendorCapability({ hasActiveVendor: false });
      })
      .finally(() => {
        if (!cancelled) setCapabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [capabilityLoading, session, setVendorCapability, vendorCapability]);

  useEffect(() => {
    if (!status || !DRAFT_DETAIL_STATUSES.includes(status)) {
      setDraft(null);
      return;
    }

    let cancelled = false;
    loadVendorOnboardingDraft()
      .then((loadedDraft) => {
        if (!cancelled) setDraft(loadedDraft);
      })
      .catch(() => {
        if (!cancelled) setDraft(null);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (!status || !DOCUMENT_FEEDBACK_STATUSES.includes(status)) {
      setDocuments([]);
      return;
    }

    let cancelled = false;
    listMyVerificationDocuments()
      .then((loadedDocs) => {
        if (!cancelled) setDocuments(loadedDocs);
      })
      .catch(() => {
        if (!cancelled) setDocuments([]);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  if (session && !vendorCapability) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgBase }}>
        <ActivityIndicator color={colors.surfaceBrand} />
      </View>
    );
  }

  if (!isRenderableStatus) {
    const returnToLogin = async () => {
      await signOut();
      router.replace('/(auth)');
    };

    return (
      <Screen>
        <AppHeader
          title="No active application status"
          subtitle="We could not find a vendor application status that needs review."
          fallbackHref="/(auth)"
        />
        <Text style={{ color: colors.textSecondary }}>
          Sign out and log back in if you need to use a different account or submit a new application.
        </Text>
        <AppButton label="Return to login" onPress={returnToLogin} />
      </Screen>
    );
  }

  return (
    <ApplicationStatusScreen
      status={status as ApplicationStatusScreenStatus}
      draft={draft}
      documents={documents}
    />
  );
}
