import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { Service, VendorSummary } from '@/types/domain';

import { isSupabaseConfigured, supabase } from './supabase';

export async function listVendorServices() {
  const ownerId = useAuthStore.getState().session?.userId;
  if (!isSupabaseConfigured || !supabase) {
    return useDemoDataStore.getState().services.filter((service) =>
      useDemoDataStore.getState().vendors.some((vendor) => vendor.id === service.vendorId && vendor.ownerId === ownerId)
    );
  }

  const vendorResult = await supabase.from('vendors').select('id').eq('owner_id', ownerId).maybeSingle();
  if (vendorResult.error || !vendorResult.data) {
    return [];
  }

  const servicesResult = await supabase.from('services').select('*').eq('vendor_id', vendorResult.data.id);
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

export async function upsertVendorService(service: Service) {
  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().upsertService(service);
    return service;
  }

  await supabase.from('services').upsert({
    id: service.id,
    vendor_id: service.vendorId,
    title: service.title,
    category: service.category,
    description: service.description ?? null,
    duration_minutes: service.durationMinutes,
    price: service.price,
    active: service.active,
    image: service.image ?? null,
  });

  return service;
}

export async function removeVendorService(serviceId: string) {
  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().removeService(serviceId);
    return;
  }

  await supabase.from('services').delete().eq('id', serviceId);
}

export async function updateVendorLocation(vendorId: string, patch: Partial<VendorSummary>) {
  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().updateVendor(vendorId, patch);
    return;
  }

  await supabase
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
}
