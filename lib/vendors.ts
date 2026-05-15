import { useDemoDataStore } from '@/store/useDemoDataStore';
import { DiscoveryFilters, Review, Service, VendorSummary } from '@/types/domain';

import { isSupabaseConfigured, supabase } from './supabase';

const defaultFilters: DiscoveryFilters = {
  query: '',
  mobileOnly: false,
  minimumRating: 0,
  category: 'all',
  maxDistanceMiles: 30,
};

function mapVendorRow(item: Record<string, unknown>): VendorSummary {
  return {
    id: item.id as string,
    ownerId: item.owner_id as string,
    businessType: item.business_type as VendorSummary['businessType'],
    name: item.name as string,
    description: item.description as string,
    address: item.address as string,
    distanceMiles: (item.distance_miles as number) ?? 0,
    rating: (item.rating as number) ?? 0,
    reviewCount: (item.review_count as number) ?? 0,
    mobileServiceEnabled: (item.mobile_service_enabled as boolean) ?? false,
    serviceRadiusMiles: (item.service_radius_miles as number) ?? 0,
    nextAvailable: (item.next_available as string) ?? 'Schedule pending',
    heroImage: item.hero_image as string,
    serviceCategories: (item.service_categories as VendorSummary['serviceCategories']) ?? [],
    coordinates: {
      latitude: item.latitude as number,
      longitude: item.longitude as number,
    },
  };
}

function mapServiceRow(item: Record<string, unknown>): Service {
  return {
    id: item.id as string,
    vendorId: item.vendor_id as string,
    title: item.title as string,
    category: item.category as Service['category'],
    durationMinutes: item.duration_minutes as number,
    price: item.price as number,
    active: (item.active as boolean) ?? true,
    description: item.description as string | undefined,
    image: item.image as string | undefined,
  };
}

function mapReviewRow(item: Record<string, unknown>): Review {
  return {
    id: item.id as string,
    bookingId: item.booking_id as string,
    vendorId: item.vendor_id as string,
    clientId: item.client_id as string,
    author: item.author as string,
    rating: item.rating as number,
    text: item.text as string,
    createdAt: item.created_at as string,
  };
}

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

  return filterVendors(data.map(mapVendorRow), merged);
}

export async function getVendorDetail(vendorId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return { vendor: null, services: [] as Service[], reviews: [] as Review[], businessHours: [] as { day: string; hours: string }[] };
  }

  const [vendorResult, servicesResult, reviewsResult] = await Promise.all([
    supabase.from('vendors').select('*').eq('id', vendorId).maybeSingle(),
    supabase.from('services').select('*').eq('vendor_id', vendorId).eq('active', true),
    supabase.from('reviews').select('*').eq('vendor_id', vendorId).order('created_at', { ascending: false }),
  ]);

  if (!vendorResult.data) {
    return { vendor: null, services: [] as Service[], reviews: [] as Review[], businessHours: [] as { day: string; hours: string }[] };
  }

  const vendorRow = vendorResult.data as Record<string, unknown>;
  const vendor = mapVendorRow(vendorRow);
  const businessHours = Array.isArray(vendorRow.business_hours)
    ? (vendorRow.business_hours as { day: string; hours: string }[])
    : [];
  const services = (servicesResult.data ?? []).map(mapServiceRow);
  const reviews = (reviewsResult.data ?? []).map(mapReviewRow);

  return { vendor, services, reviews, businessHours };
}
