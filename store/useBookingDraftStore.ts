import { create } from 'zustand';

import { BookingDraft } from '@/types/domain';

interface BookingDraftState {
  draft: BookingDraft;
  updateDraft: (patch: Partial<BookingDraft>) => void;
  clearDraft: () => void;
}

const initialDraft: BookingDraft = {};

export const useBookingDraftStore = create<BookingDraftState>((set) => ({
  draft: initialDraft,
  updateDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  clearDraft: () => set({ draft: initialDraft }),
}));
