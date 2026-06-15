import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { VendorOnboardingDraft, VendorOnboardingDraftPatch } from '@/types/domain';
import type { VendorOnboardingStepId } from '@/lib/vendor-onboarding-steps';

interface VendorOnboardingState {
  draft: VendorOnboardingDraft | null;
  completedSteps: VendorOnboardingStepId[];
  setDraft: (draft: VendorOnboardingDraft) => void;
  patchDraft: (patch: VendorOnboardingDraftPatch) => void;
  markComplete: (id: VendorOnboardingStepId) => void;
  reset: () => void;
}

export const useVendorOnboardingStore = create<VendorOnboardingState>()(
  persist(
    (set, get) => ({
      draft: null,
      completedSteps: [],
      setDraft: (draft) => set({ draft }),
      patchDraft: (patch) => {
        const base = get().draft;
        if (!base) return;
        set({
          draft: {
            ...base,
            businessType: patch.businessType ?? base.businessType,
            profile: patch.profile ? { ...base.profile, ...patch.profile } : base.profile,
            location: patch.location ? { ...base.location, ...patch.location } : base.location,
            services: patch.services ?? base.services,
            availabilityConfigured: patch.availabilityConfigured ?? base.availabilityConfigured,
            completed: patch.completed ?? base.completed,
            submittedAt: patch.submittedAt ?? base.submittedAt,
          },
        });
      },
      markComplete: (id) =>
        set((s) => ({
          completedSteps: s.completedSteps.includes(id) ? s.completedSteps : [...s.completedSteps, id],
        })),
      reset: () => set({ draft: null, completedSteps: [] }),
    }),
    {
      name: 'autoserve-vendor-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
