import { VendorSummary } from '@/types/domain';

import { extractEdgeFunctionError } from './edge-functions';
import { getVendorForOwner } from './vendor-admin';
import { isSupabaseConfigured, supabase } from './supabase';

export interface StripeConnectOnboardingSession {
  url: string;
  stripeTransfersStatus?: VendorSummary['stripeTransfersStatus'];
}

export async function getCurrentVendorPayoutStatus(): Promise<VendorSummary | null> {
  const vendor = await getVendorForOwner();

  // The stored status only changes via webhook, which can lag behind Stripe
  // (or not be configured); re-check the live account until it goes active.
  if (
    vendor &&
    vendor.stripeAccountId &&
    vendor.stripeTransfersStatus !== 'active' &&
    isSupabaseConfigured &&
    supabase
  ) {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-status', { body: {} });
      const liveStatus = (data as { stripe_transfers_status?: VendorSummary['stripeTransfersStatus'] } | null)
        ?.stripe_transfers_status;
      if (!error && liveStatus) {
        return { ...vendor, stripeTransfersStatus: liveStatus };
      }
    } catch {
      /* fall back to the stored status */
    }
  }

  return vendor;
}

export async function startVendorPayoutOnboarding(): Promise<StripeConnectOnboardingSession> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Payout setup requires a live AutoServe backend.');
  }

  const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', { body: {} });
  if (error) {
    throw new Error(await extractEdgeFunctionError(error, 'Could not start payout setup'));
  }

  const response = data as {
    url?: string;
    stripe_transfers_status?: VendorSummary['stripeTransfersStatus'];
    stripeTransfersStatus?: VendorSummary['stripeTransfersStatus'];
  };

  if (!response.url) {
    throw new Error('Payout setup did not return an onboarding link.');
  }

  return {
    url: response.url,
    stripeTransfersStatus: response.stripe_transfers_status ?? response.stripeTransfersStatus,
  };
}
