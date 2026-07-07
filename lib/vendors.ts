import { demoReviewsState, useDemoDataStore } from '@/store/useDemoDataStore';
import { makeDefaultAvailability, makeEmptyAvailability } from '@/store/useVendorAvailabilityStore';
import { DiscoveryFilters, Review, Service, VendorAvailability, VendorSummary } from '@/types/domain';

import { loadVendorAvailability } from './vendor-availability';
import { isDemoDataEnabled, isSupabaseConfigured, supabase } from './supabase';

// Client/guest-facing vendor reads go through the `vendors_public` view, which
// exposes only these non-sensitive columns — deliberately excluding the Stripe
// Connect account id and contact PII (contact_name/email/phone), which are
// owner-only on the base `vendors` table. Kept in sync with
// supabase/migrations/restrict_vendor_public_columns.sql.
const VENDOR_PUBLIC_VIEW = 'vendors_public';
const VENDOR_PUBLIC_COLUMNS =
  'id,owner_id,business_type,name,description,address,distance_miles,rating,review_count,' +
  'mobile_service_enabled,service_radius_miles,next_available,hero_image,service_categories,' +
  'latitude,longitude,business_hours,stripe_transfers_status,stripe_account_updated_at,is_active';

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
    // stripe_account_id is intentionally NOT selected for client-facing reads
    // (owner-only); see VENDOR_PUBLIC_COLUMNS.
    stripeTransfersStatus: (item.stripe_transfers_status as VendorSummary['stripeTransfersStatus'] | undefined) ?? undefined,
    stripeAccountUpdatedAt: (item.stripe_account_updated_at as string | undefined) ?? undefined,
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
    return isDemoDataEnabled ? filterVendors(useDemoDataStore.getState().vendors, merged) : [];
  }

  const { data, error } = await supabase.from(VENDOR_PUBLIC_VIEW).select(VENDOR_PUBLIC_COLUMNS).eq('is_active', true);
  if (error) {
    throw new Error(error.message ?? 'Failed to load vendors from Supabase.');
  }

  return filterVendors(((data ?? []) as unknown as Record<string, unknown>[]).map(mapVendorRow), merged);
}

export async function getVendorDetail(vendorId: string): Promise<{
  vendor: VendorSummary | null;
  services: Service[];
  reviews: Review[];
  businessHours: { day: string; hours: string }[];
  availability: VendorAvailability;
}> {
  if (!isSupabaseConfigured || !supabase) {
    if (!isDemoDataEnabled) {
      return {
        vendor: null,
        services: [] as Service[],
        reviews: [] as Review[],
        businessHours: [] as { day: string; hours: string }[],
        availability: makeDefaultAvailability(),
      };
    }
    const demo = useDemoDataStore.getState();
    const vendor = demo.vendors.find((item) => item.id === vendorId) ?? null;
    const demoAvailability = demo.vendorAvailabilities?.[vendorId] ?? makeDefaultAvailability();
    return {
      vendor,
      services: demo.services.filter((item) => item.vendorId === vendorId && item.active),
      reviews: demoReviewsState.filter((item) => item.vendorId === vendorId),
      businessHours: [] as { day: string; hours: string }[],
      availability: demoAvailability,
    };
  }

  const [vendorResult, servicesResult, reviewsResult, availability] = await Promise.all([
    supabase.from(VENDOR_PUBLIC_VIEW).select(VENDOR_PUBLIC_COLUMNS).eq('id', vendorId).eq('is_active', true).maybeSingle(),
    supabase.from('services').select('*').eq('vendor_id', vendorId).eq('active', true),
    supabase.from('reviews').select('*').eq('vendor_id', vendorId).order('created_at', { ascending: false }),
    // Client-facing: fall back to an empty (no-slot) availability so an
    // unconfigured vendor shows "no availability" instead of fabricated slots.
    loadVendorAvailability(vendorId, { fallback: 'empty' }).catch(() => makeEmptyAvailability()),
  ]);

  if (vendorResult.error) {
    throw new Error(vendorResult.error.message ?? 'Failed to load vendor from Supabase.');
  }

  if (servicesResult.error) {
    throw new Error(servicesResult.error.message ?? 'Failed to load services from Supabase.');
  }

  if (reviewsResult.error) {
    throw new Error(reviewsResult.error.message ?? 'Failed to load reviews from Supabase.');
  }

  if (!vendorResult.data) {
    return {
      vendor: null,
      services: [] as Service[],
      reviews: [] as Review[],
      businessHours: [] as { day: string; hours: string }[],
      availability,
    };
  }

  const vendorRow = vendorResult.data as unknown as Record<string, unknown>;
  const vendor = mapVendorRow(vendorRow);
  const businessHours = Array.isArray(vendorRow.business_hours)
    ? (vendorRow.business_hours as { day: string; hours: string }[])
    : [];
  const services = (servicesResult.data ?? []).map(mapServiceRow);
  const reviews = (reviewsResult.data ?? []).map(mapReviewRow);

  return { vendor, services, reviews, businessHours, availability };
}
