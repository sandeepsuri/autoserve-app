import type { Href } from 'expo-router';

import { BusinessType, VendorLocationMode, VendorOnboardingDraft } from '@/types/domain';

export const LOCATION_MODE_LABELS: Record<VendorLocationMode, string> = {
  fixed: 'Fixed location',
  mobile: 'Mobile service',
  hybrid: 'Hybrid (shop + mobile)',
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  shop: 'Business shop',
  solo: 'Solo vendor',
};

export type VendorOnboardingStepId =
  | 'account-type'
  | 'business-info'
  | 'location'
  | 'services'
  | 'availability'
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
  { id: 'availability', route: '/(auth)/vendor-onboarding/availability' as Href, label: 'Availability', index: 4 },
  { id: 'review', route: '/(auth)/vendor-onboarding/review', label: 'Review', index: 5 },
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

  const hasValidService = draft.services.some(
    (service) =>
      Boolean(service.title?.trim()) &&
      Boolean(service.category) &&
      typeof service.durationMinutes === 'number' &&
      service.durationMinutes > 0 &&
      typeof service.price === 'number' &&
      service.price >= 0,
  );

  switch (id) {
    case 'account-type':
      return Boolean(draft.businessType);
    case 'business-info':
      return Boolean(draft.profile?.businessName?.trim());
    case 'location':
      return Boolean(draft.location?.address?.trim());
    case 'services':
      return hasValidService;
    case 'availability':
      return hasValidService; // availability step requires services to be done first
    case 'review':
      return Boolean(draft.businessType) && Boolean(draft.profile?.businessName?.trim()) && hasValidService;
  }
}
