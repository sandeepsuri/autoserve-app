import { useEffect, useRef } from 'react';

import { useBookingDraftStore } from '@/store/useBookingDraftStore';
import { Service } from '@/types/domain';

import { reconcileNotice, reconcileServices } from './booking-types';

/**
 * Keeps the draft's services bookable as the booking type or the vendor's
 * catalogue changes, and returns a notice naming what was removed. Pass
 * undefined until the catalogue loads: no data says nothing about the draft.
 *
 * Booking steps stay mounted as sibling tabs, so whichever step reconciles
 * first may be hidden. The notice lives on the draft so the visible step shows it.
 */
export function useBookingServiceReconciliation(catalogue: readonly Service[] | undefined) {
  const { draft, updateDraft } = useBookingDraftStore();
  const { vendorId, bookingMode, serviceIds, serviceRemovalNotice } = draft;
  const lastMode = useRef(bookingMode);

  useEffect(() => {
    const modeChanged = lastMode.current !== bookingMode;
    lastMode.current = bookingMode;
    if (!vendorId || !catalogue) return;
    const result = reconcileServices(catalogue, serviceIds ?? [], bookingMode);
    if (result.serviceIds.length !== (serviceIds ?? []).length) {
      updateDraft({
        serviceIds: result.serviceIds,
        serviceId: result.serviceIds[0],
        serviceRemovalNotice: reconcileNotice(result, bookingMode),
      });
    } else if (modeChanged && serviceRemovalNotice) {
      updateDraft({ serviceRemovalNotice: undefined });
    }
  }, [bookingMode, catalogue, serviceIds, serviceRemovalNotice, updateDraft, vendorId]);

  return serviceRemovalNotice;
}
