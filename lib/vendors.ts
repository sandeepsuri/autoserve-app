import { availabilityByVendor } from '@/constants/mock-data';
import { demoReviewsState, useDemoDataStore } from '@/store/useDemoDataStore';
import { DiscoveryFilters, Review, Service, VendorSummary } from '@/types/domain';

import { isSupabaseConfigured, supabase } from './supabase';

const defaultFilters: DiscoveryFilters = {
  query: '',
  mobileOnly: false,
  minimumRating: 0,
  category: 'all',
  maxDistanceMiles: 30,
};

function filterVendors(vendors: VendorSummary[], filters: DiscoveryFilters) {
  return vendors.filter((vendor) => {
    const matchesQuery =
      !filters.query ||
      vendor.name.toLowerCase().includes(filters.query.toLowerCase()) ||
      vendor.description.toLowerCase().includes(filters.query.toLowerCase());
    const matchesMobile = !filters.mobileOnly || vendor.mobileServiceEnabled;
    const matchesRating = vendor.rating >= filters.minimumRating;
    const matchesDistance = vendor.distanceMiles <= filters.maxDistanceMiles;
    const matchesCategory = filters.category === 'all' || vendor.serviceCategories.includes(filters.category);

    return matchesQuery && matchesMobile && matchesRating && matchesDistance && matchesCategory;
  });
}

export async function listVendors(filters: Partial<DiscoveryFilters> = {}) {
  const merged = { ...defaultFilters, ...filters };
  if (!isSupabaseConfigured || !supabase) {
    return filterVendors(useDemoDataStore.getState().vendors, merged);
  }

  const { data, error } = await supabase.from('vendors').select('*');
  if (error || !data) {
    return filterVendors(useDemoDataStore.getState().vendors, merged);
  }

  const vendors: VendorSummary[] = data.map((item) => ({
    id: item.id,
    ownerId: item.owner_id,
    businessType: item.business_type,
    name: item.name,
    description: item.description,
    address: item.address,
    distanceMiles: item.distance_miles ?? 0,
    rating: item.rating ?? 0,
    reviewCount: item.review_count ?? 0,
    mobileServiceEnabled: item.mobile_service_enabled ?? false,
    serviceRadiusMiles: item.service_radius_miles ?? 0,
    nextAvailable: item.next_available ?? 'Schedule pending',
    heroImage: item.hero_image,
    serviceCategories: item.service_categories ?? [],
    coordinates: {
      latitude: item.latitude,
      longitude: item.longitude,
    },
  }));

  return filterVendors(vendors, merged);
}

export async function getVendorDetail(vendorId: string) {
  const vendor = useDemoDataStore.getState().vendors.find((item) => item.id === vendorId) ?? null;
  const services = useDemoDataStore.getState().services.filter((item) => item.vendorId === vendorId && item.active);
  const reviews = demoReviewsState.filter((item) => item.vendorId === vendorId);
  const availability = availabilityByVendor[vendorId] ?? [];

  if (!isSupabaseConfigured || !supabase || vendor) {
    return { vendor, services, reviews, availability };
  }

  return { vendor: null, services: [] as Service[], reviews: [] as Review[], availability };
}
