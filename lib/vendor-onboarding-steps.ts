import { Href } from 'expo-router';

import { VendorOnboardingDraft } from '@/types/domain';

export type VendorOnboardingStepId =
  | 'account-type'
  | 'business-info'
  | 'location'
  | 'services'
  | 'review';

export interface VendorOnboardingStep {
  id: VendorOnboardingStepId;
  route: Href;
  label: string;
  index: number;
}

export const VENDOR_ONBOARDING_STEPS: VendorOnboardingStep[] = [
  { id: 'account-type', route: '/(auth)/vendor-onboarding/account-type', label: 'Account type', index: 0 },
  { id: 'business-info', route: '/(auth)/vendor-onboarding/business-info', label: 'Business info', index: 1 },
  { id: 'location', route: '/(auth)/vendor-onboarding/location', label: 'Location', index: 2 },
  { id: 'services', route: '/(auth)/vendor-onboarding/services', label: 'Services', index: 3 },
  { id: 'review', route: '/(auth)/vendor-onboarding/review', label: 'Review', index: 4 },
];

export function getStep(id: VendorOnboardingStepId): VendorOnboardingStep {
  const step = VENDOR_ONBOARDING_STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`Unknown onboarding step: ${id}`);
  return step;
}

export function getNextStep(id: VendorOnboardingStepId): VendorOnboardingStep | null {
  const current = getStep(id);
  return VENDOR_ONBOARDING_STEPS[current.index + 1] ?? null;
}

export function getPrevStep(id: VendorOnboardingStepId): VendorOnboardingStep | null {
  const current = getStep(id);
  return VENDOR_ONBOARDING_STEPS[current.index - 1] ?? null;
}

export function isDraftReadyFor(id: VendorOnboardingStepId, draft: VendorOnboardingDraft | null): boolean {
  if (!draft) return false;
  switch (id) {
    case 'account-type':
      return Boolean(draft.businessType);
    case 'business-info':
      return Boolean(draft.profile?.businessName?.trim());
    case 'location':
      return Boolean(draft.location?.address?.trim());
    case 'services':
      return true;
    case 'review':
      return Boolean(draft.businessType) && Boolean(draft.profile?.businessName?.trim());
  }
}
