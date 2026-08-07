import { create } from 'zustand';

import { BookingDraft, BookingRecord } from '@/types/domain';

interface BookingDraftState {
  draft: BookingDraft;
  submittedGuestBooking: BookingRecord | null;
  updateDraft: (patch: Partial<BookingDraft>) => void;
  clearDraft: () => void;
  setSubmittedGuestBooking: (booking: BookingRecord | null) => void;
}

const initialDraft: BookingDraft = {};

export const useBookingDraftStore = create<BookingDraftState>((set) => ({
  draft: initialDraft,
  submittedGuestBooking: null,
  updateDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  clearDraft: () => set({ draft: initialDraft }),
  setSubmittedGuestBooking: (booking) => set({ submittedGuestBooking: booking }),
}));
