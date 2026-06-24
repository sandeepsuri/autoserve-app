import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { colors } from '@/constants/theme';
import { isVendorApplicationLocked, loadVendorOnboardingDraft } from '@/lib/vendor-onboarding';
import { VENDOR_ONBOARDING_STEPS } from '@/lib/vendor-onboarding-steps';
import { VENDOR_APPLICATION_PATH } from '@/lib/route-gate';
import { useAuthStore } from '@/store/useAuthStore';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';

export default function VendorOnboardingEntry() {
  const { draft, completedSteps, setDraft, reset } = useVendorOnboardingStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { session, postAuthPath, setPostAuthPath } = useAuthStore.getState();
    if (postAuthPath === VENDOR_APPLICATION_PATH) setPostAuthPath(null);
    const isStale = Boolean(draft && session && draft.ownerId !== session.userId);
    if (isStale) reset();

    loadVendorOnboardingDraft()
      .then(setDraft)
      .catch(() => {
        if (draft && !isStale) return;
        const { session, profile } = useAuthStore.getState();
        if (!session) return;
        setDraft({
          ownerId: session.userId,
          businessType: profile?.businessType,
          profile: {
            contactName: profile?.fullName,
            contactEmail: profile?.email,
            contactPhone: profile?.phone,
          },
          location: {},
          services: [],
          completed: false,
        });
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgBase }}>
        <ActivityIndicator color={colors.surfaceBrand} />
      </View>
    );
  }

  if (draft?.completed || isVendorApplicationLocked(draft?.applicationStatus)) {
    return <Redirect href="/(auth)/vendor-onboarding/review" />;
  }

  const nextStep = VENDOR_ONBOARDING_STEPS.find((s) => !completedSteps.includes(s.id)) ?? VENDOR_ONBOARDING_STEPS[0];
  return <Redirect href={nextStep.route} />;
}
