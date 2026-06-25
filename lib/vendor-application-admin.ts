import { VendorApplication, VendorSummary } from '@/types/domain';

import { isSupabaseConfigured, supabase } from './supabase';

export async function approveVendorApplication(
  applicationId: string,
  reason?: string,
): Promise<VendorSummary | null> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Vendor approval requires a configured Supabase project');
  }

  const { data, error } = await supabase.rpc('approve_vendor_application', {
    p_application_id: applicationId,
    p_reason: reason ?? null,
  });

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    ownerId: data.owner_id,
    businessType: data.business_type,
    name: data.name,
    description: data.description,
    address: data.address,
    distanceMiles: data.distance_miles ?? 0,
    rating: data.rating ?? 0,
    reviewCount: data.review_count ?? 0,
    mobileServiceEnabled: data.mobile_service_enabled ?? false,
    serviceRadiusMiles: data.service_radius_miles ?? 0,
    nextAvailable: data.next_available ?? '',
    heroImage: data.hero_image ?? '',
    serviceCategories: data.service_categories ?? [],
    coordinates: {
      latitude: data.latitude,
      longitude: data.longitude,
    },
  };
}

export async function rejectVendorApplication(applicationId: string, reason: string): Promise<VendorApplication> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Vendor rejection requires a configured Supabase project');
  }

  const { data, error } = await supabase.rpc('reject_vendor_application', {
    p_application_id: applicationId,
    p_reason: reason,
  });

  if (error) throw error;
  return mapApplicationRow(data);
}

export async function requestVendorApplicationInfo(
  applicationId: string,
  reason: string,
): Promise<VendorApplication> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Requesting application info requires a configured Supabase project');
  }

  const { data, error } = await supabase.rpc('request_vendor_application_info', {
    p_application_id: applicationId,
    p_reason: reason,
  });

  if (error) throw error;
  return mapApplicationRow(data);
}

export async function suspendVendorApplication(
  applicationId: string,
  reason: string,
): Promise<VendorApplication> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Suspending an application requires a configured Supabase project');
  }

  const { data, error } = await supabase.rpc('suspend_vendor_application', {
    p_application_id: applicationId,
    p_reason: reason,
  });

  if (error) throw error;
  return mapApplicationRow(data);
}

function mapApplicationRow(row: Record<string, unknown>): VendorApplication {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    status: row.status as VendorApplication['status'],
    businessType: row.business_type as VendorApplication['businessType'],
    profile: {
      businessName: (row.business_name as string) ?? undefined,
      description: (row.business_description as string) ?? undefined,
      contactName: (row.contact_name as string) ?? undefined,
      contactEmail: (row.contact_email as string) ?? undefined,
      contactPhone: (row.contact_phone as string) ?? undefined,
    },
    location: {
      mode: row.location_mode as VendorApplication['location']['mode'],
      address: (row.address as string) ?? undefined,
      coordinates: {
        latitude: row.latitude as number | undefined,
        longitude: row.longitude as number | undefined,
      },
      serviceRadiusMiles: (row.service_radius_miles as number) ?? undefined,
    },
    services: Array.isArray(row.service_catalog) ? (row.service_catalog as VendorApplication['services']) : [],
    submittedAt: (row.submitted_at as string) ?? undefined,
    reviewerNotes: (row.reviewer_notes as string) ?? undefined,
    updatedAt: (row.updated_at as string) ?? undefined,
  };
}
