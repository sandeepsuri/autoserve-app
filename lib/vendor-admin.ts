import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { Service, VendorSummary } from '@/types/domain';

import { isSupabaseConfigured, supabase } from './supabase';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export async function getVendorForOwner(): Promise<VendorSummary | null> {
  const ownerId = useAuthStore.getState().session?.userId;
  if (!ownerId) return null;

  if (!isSupabaseConfigured || !supabase) {
    return useDemoDataStore.getState().vendors.find((v) => v.ownerId === ownerId) ?? null;
  }

  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

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
    heroImage: data.hero_image ?? undefined,
    serviceCategories: data.service_categories ?? [],
    coordinates: {
      latitude: data.latitude,
      longitude: data.longitude,
    },
  };
}

export async function listVendorServices() {
  const ownerId = useAuthStore.getState().session?.userId;
  if (!isSupabaseConfigured || !supabase) {
    return useDemoDataStore.getState().services.filter((service) =>
      useDemoDataStore.getState().vendors.some((vendor) => vendor.id === service.vendorId && vendor.ownerId === ownerId)
    );
  }

  const vendor = await getVendorForOwner();
  if (!vendor) return [];

  const servicesResult = await supabase.from('services').select('*').eq('vendor_id', vendor.id);
  if (servicesResult.error || !servicesResult.data) {
    return [];
  }

  return servicesResult.data.map((service) => ({
    id: service.id,
    vendorId: service.vendor_id,
    title: service.title,
    category: service.category,
    description: service.description ?? undefined,
    durationMinutes: service.duration_minutes,
    price: service.price,
    active: service.active ?? true,
    image: service.image ?? undefined,
  }));
}

export async function upsertVendorService(service: Service): Promise<Service> {
  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().upsertService(service);
    return service;
  }

  const payload = {
    vendor_id: service.vendorId,
    title: service.title,
    category: service.category,
    description: service.description ?? null,
    duration_minutes: service.durationMinutes,
    price: service.price,
    active: service.active,
    image: service.image ?? null,
  };

  if (isValidUuid(service.id)) {
    // Existing row — upsert by known UUID.
    const { error } = await supabase.from('services').upsert({ id: service.id, ...payload });
    if (error) throw error;
    return service;
  }

  // New row — omit id so Postgres gen_random_uuid() default applies.
  const { data, error } = await supabase
    .from('services')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  return {
    id: data.id,
    vendorId: data.vendor_id,
    title: data.title,
    category: data.category,
    description: data.description ?? undefined,
    durationMinutes: data.duration_minutes,
    price: data.price,
    active: data.active ?? true,
    image: data.image ?? undefined,
  };
}

export async function removeVendorService(serviceId: string) {
  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().removeService(serviceId);
    return;
  }

  const { error } = await supabase.from('services').delete().eq('id', serviceId);
  if (error) throw error;
}

export async function updateVendorLocation(vendorId: string, patch: Partial<VendorSummary>) {
  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().updateVendor(vendorId, patch);
    return;
  }

  const { error } = await supabase
    .from('vendors')
    .update({
      address: patch.address,
      mobile_service_enabled: patch.mobileServiceEnabled,
      service_radius_miles: patch.serviceRadiusMiles,
      latitude: patch.coordinates?.latitude,
      longitude: patch.coordinates?.longitude,
      next_available: patch.nextAvailable,
    })
    .eq('id', vendorId);
  if (error) throw error;
}
