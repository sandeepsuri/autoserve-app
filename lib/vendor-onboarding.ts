import { ensureProfileRow } from './auth';
import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';
import {
  BusinessType,
  Coordinates,
  Service,
  ServiceCategory,
  UserProfile,
  VendorLocationMode,
  VendorOnboardingDraft,
  VendorOnboardingDraftPatch,
  VendorOnboardingLocationDraft,
  VendorOnboardingServiceDraft,
  VendorSummary,
} from '@/types/domain';

import { isSupabaseConfigured, supabase } from './supabase';
import { queryClient } from './query-client';

type VendorRow = {
  id: string;
  owner_id: string;
  business_type: BusinessType;
  name: string;
  description: string | null;
  address: string;
  distance_miles: number | null;
  rating: number | null;
  review_count: number | null;
  mobile_service_enabled: boolean | null;
  service_radius_miles: number | null;
  next_available: string | null;
  hero_image: string | null;
  service_categories: ServiceCategory[] | null;
  latitude: number | null;
  longitude: number | null;
  location_mode?: VendorLocationMode | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
};

type ServiceRow = {
  id: string;
  vendor_id: string;
  title: string;
  category: ServiceCategory;
  description?: string | null;
  duration_minutes: number;
  price: number;
  active: boolean | null;
  image?: string | null;
};

type VendorOnboardingDraftRow = {
  owner_id: string;
  business_type: BusinessType | null;
  business_name: string | null;
  business_description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  location_mode: VendorLocationMode | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  service_radius_miles: number | null;
  service_catalog: unknown;
  completed: boolean | null;
  submitted_at: string | null;
  updated_at: string | null;
};

function createDemoId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function requireSession() {
  const { session, profile } = useAuthStore.getState();
  if (!session) {
    throw new Error('Vendor onboarding requires an authenticated session');
  }

  return { session, profile };
}

function makeEmptyDraft(ownerId: string, profile?: UserProfile | null): VendorOnboardingDraft {
  return {
    ownerId,
    businessType: profile?.businessType,
    profile: {
      contactName: profile?.fullName,
      contactEmail: profile?.email,
      contactPhone: profile?.phone,
    },
    location: {},
    services: [],
    completed: false,
  };
}

function normalizeCoordinates(coordinates?: Partial<Coordinates>) {
  const latitude = typeof coordinates?.latitude === 'number' ? coordinates.latitude : undefined;
  const longitude = typeof coordinates?.longitude === 'number' ? coordinates.longitude : undefined;

  if (latitude === undefined && longitude === undefined) {
    return undefined;
  }

  return { latitude, longitude };
}

function mergeLocation(
  base: VendorOnboardingLocationDraft,
  patch?: VendorOnboardingDraftPatch['location'],
): VendorOnboardingLocationDraft {
  if (!patch) return base;

  return {
    ...base,
    ...patch,
    coordinates: patch.coordinates ? { ...base.coordinates, ...patch.coordinates } : base.coordinates,
  };
}

function mergeDraft(base: VendorOnboardingDraft, patch: VendorOnboardingDraftPatch): VendorOnboardingDraft {
  return {
    ...base,
    businessType: patch.businessType ?? base.businessType,
    profile: patch.profile ? { ...base.profile, ...patch.profile } : base.profile,
    location: mergeLocation(base.location, patch.location),
    services: patch.services ?? base.services,
    completed: patch.completed ?? base.completed,
    submittedAt: patch.submittedAt ?? base.submittedAt,
    updatedAt: new Date().toISOString(),
  };
}

function toServiceDraft(service: Service): VendorOnboardingServiceDraft {
  return {
    id: service.id,
    title: service.title,
    category: service.category,
    description: service.description,
    durationMinutes: service.durationMinutes,
    price: service.price,
    active: service.active,
  };
}

function isVendorSummary(vendor: VendorRow | VendorSummary): vendor is VendorSummary {
  return 'ownerId' in vendor;
}

function deriveLocationMode(vendor?: VendorRow | VendorSummary | null): VendorLocationMode | undefined {
  if (!vendor) return undefined;
  if ('location_mode' in vendor && vendor.location_mode) return vendor.location_mode;
  const mobileEnabled = isVendorSummary(vendor) ? vendor.mobileServiceEnabled : vendor.mobile_service_enabled;
  return mobileEnabled ? 'hybrid' : 'fixed';
}

function buildDraftFromVendorState(params: {
  ownerId: string;
  profile?: UserProfile | null;
  vendor?: VendorRow | VendorSummary | null;
  services?: Array<ServiceRow | Service>;
}): VendorOnboardingDraft {
  const { ownerId, profile, vendor, services = [] } = params;

  if (!vendor) {
    return makeEmptyDraft(ownerId, profile);
  }

  const address = 'address' in vendor ? vendor.address : undefined;
  const latitude =
    'coordinates' in vendor ? vendor.coordinates.latitude : vendor.latitude ?? undefined;
  const longitude =
    'coordinates' in vendor ? vendor.coordinates.longitude : vendor.longitude ?? undefined;
  const serviceRadiusMiles =
    isVendorSummary(vendor) ? vendor.serviceRadiusMiles : vendor.service_radius_miles ?? undefined;
  const businessType = isVendorSummary(vendor) ? vendor.businessType : vendor.business_type;

  return {
    ownerId,
    businessType: businessType ?? profile?.businessType,
    profile: {
      businessName: vendor.name,
      description: vendor.description ?? undefined,
      contactName:
        ('contact_name' in vendor ? vendor.contact_name : undefined) ?? profile?.fullName,
      contactEmail:
        ('contact_email' in vendor ? vendor.contact_email : undefined) ?? profile?.email,
      contactPhone:
        ('contact_phone' in vendor ? vendor.contact_phone : undefined) ?? profile?.phone,
    },
    location: {
      mode: deriveLocationMode(vendor),
      address: address ?? undefined,
      coordinates: normalizeCoordinates({ latitude, longitude }),
      serviceRadiusMiles,
    },
    services: services.map((service) =>
      'vendorId' in service
        ? toServiceDraft(service)
        : {
            id: service.id,
            title: service.title,
            category: service.category,
            description: service.description ?? undefined,
            durationMinutes: service.duration_minutes,
            price: service.price,
            active: service.active ?? true,
          },
    ),
    completed: true,
  };
}

function coerceServiceCatalog(
  catalog: unknown,
): VendorOnboardingServiceDraft[] {
  if (!Array.isArray(catalog)) return [];

  return catalog.map((entry) => {
    const service = entry as Record<string, unknown>;
    return {
      id: typeof service.id === 'string' ? service.id : undefined,
      title: typeof service.title === 'string' ? service.title : undefined,
      category: typeof service.category === 'string' ? (service.category as ServiceCategory) : undefined,
      description: typeof service.description === 'string' ? service.description : undefined,
      durationMinutes: typeof service.durationMinutes === 'number' ? service.durationMinutes : undefined,
      price: typeof service.price === 'number' ? service.price : undefined,
      active: typeof service.active === 'boolean' ? service.active : undefined,
    };
  });
}

function rowToDraft(row: VendorOnboardingDraftRow, profile?: UserProfile | null): VendorOnboardingDraft {
  return {
    ownerId: row.owner_id,
    businessType: row.business_type ?? profile?.businessType,
    profile: {
      businessName: row.business_name ?? undefined,
      description: row.business_description ?? undefined,
      contactName: row.contact_name ?? profile?.fullName,
      contactEmail: row.contact_email ?? profile?.email,
      contactPhone: row.contact_phone ?? profile?.phone,
    },
    location: {
      mode: row.location_mode ?? undefined,
      address: row.address ?? undefined,
      coordinates: normalizeCoordinates({ latitude: row.latitude ?? undefined, longitude: row.longitude ?? undefined }),
      serviceRadiusMiles: row.service_radius_miles ?? undefined,
    },
    services: coerceServiceCatalog(row.service_catalog),
    completed: row.completed ?? false,
    submittedAt: row.submitted_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function draftToRow(draft: VendorOnboardingDraft): Omit<VendorOnboardingDraftRow, 'updated_at'> {
  return {
    owner_id: draft.ownerId,
    business_type: draft.businessType ?? null,
    business_name: draft.profile.businessName ?? null,
    business_description: draft.profile.description ?? null,
    contact_name: draft.profile.contactName ?? null,
    contact_email: draft.profile.contactEmail ?? null,
    contact_phone: draft.profile.contactPhone ?? null,
    location_mode: draft.location.mode ?? null,
    address: draft.location.address ?? null,
    latitude: draft.location.coordinates?.latitude ?? null,
    longitude: draft.location.coordinates?.longitude ?? null,
    service_radius_miles: draft.location.serviceRadiusMiles ?? null,
    service_catalog: draft.services,
    completed: draft.completed,
    submitted_at: draft.submittedAt ?? null,
  };
}

function validateSubmission(draft: VendorOnboardingDraft) {
  const errors: string[] = [];

  if (!draft.businessType) errors.push('businessType is required');
  if (!draft.profile.businessName?.trim()) errors.push('profile.businessName is required');
  if (!draft.profile.description?.trim()) errors.push('profile.description is required');
  if (!draft.profile.contactName?.trim()) errors.push('profile.contactName is required');
  if (!draft.profile.contactEmail?.trim()) errors.push('profile.contactEmail is required');
  if (!draft.profile.contactPhone?.trim()) errors.push('profile.contactPhone is required');
  if (!draft.location.mode) errors.push('location.mode is required');
  if (!draft.location.address?.trim()) errors.push('location.address is required');
  if (typeof draft.location.coordinates?.latitude !== 'number') {
    errors.push('location.coordinates.latitude is required');
  }
  if (typeof draft.location.coordinates?.longitude !== 'number') {
    errors.push('location.coordinates.longitude is required');
  }

  if (
    (draft.location.mode === 'mobile' || draft.location.mode === 'hybrid') &&
    (!draft.location.serviceRadiusMiles || draft.location.serviceRadiusMiles <= 0)
  ) {
    errors.push('location.serviceRadiusMiles is required for mobile or hybrid onboarding');
  }

  if (!draft.services.length) {
    errors.push('at least one service is required');
  }

  draft.services.forEach((service, index) => {
    if (!service.title?.trim()) errors.push(`services[${index}].title is required`);
    if (!service.category) errors.push(`services[${index}].category is required`);
    if (typeof service.durationMinutes !== 'number' || service.durationMinutes <= 0) {
      errors.push(`services[${index}].durationMinutes must be a positive number`);
    }
    if (typeof service.price !== 'number' || service.price < 0) {
      errors.push(`services[${index}].price must be a non-negative number`);
    }
  });

  return errors;
}

function normalizeDemoVendorServices(vendorId: string, services: VendorOnboardingServiceDraft[]): Service[] {
  return services.map((service) => ({
    id: service.id ?? createDemoId('service'),
    vendorId,
    title: service.title!.trim(),
    category: service.category!,
    description: service.description?.trim() || undefined,
    durationMinutes: service.durationMinutes!,
    price: service.price!,
    active: service.active ?? true,
  }));
}

function toVendorSummary(
  vendorId: string,
  draft: VendorOnboardingDraft,
  existingVendor?: VendorSummary | VendorRow | null,
): VendorSummary {
  const mobileEnabled = draft.location.mode === 'mobile' || draft.location.mode === 'hybrid';
  const coordinates = {
    latitude: draft.location.coordinates!.latitude!,
    longitude: draft.location.coordinates!.longitude!,
  };
  const categories = Array.from(
    new Set(
      draft.services
        .map((service) => service.category)
        .filter((category): category is ServiceCategory => Boolean(category)),
    ),
  );

  return {
    id: vendorId,
    ownerId: draft.ownerId,
    businessType: draft.businessType!,
    name: draft.profile.businessName!,
    description: draft.profile.description!.trim(),
    address: draft.location.address!,
    distanceMiles: existingVendor ? (isVendorSummary(existingVendor) ? existingVendor.distanceMiles : existingVendor.distance_miles ?? 0) : 0,
    rating: existingVendor ? (isVendorSummary(existingVendor) ? existingVendor.rating : existingVendor.rating ?? 0) : 0,
    reviewCount: existingVendor
      ? isVendorSummary(existingVendor)
        ? existingVendor.reviewCount
        : existingVendor.review_count ?? 0
      : 0,
    mobileServiceEnabled: mobileEnabled,
    serviceRadiusMiles: draft.location.serviceRadiusMiles ?? 0,
    nextAvailable:
      (existingVendor
        ? isVendorSummary(existingVendor)
          ? existingVendor.nextAvailable
          : existingVendor.next_available
        : undefined) ?? '',
    heroImage:
      (existingVendor
        ? isVendorSummary(existingVendor)
          ? existingVendor.heroImage
          : existingVendor.hero_image
        : undefined) ?? '',
    serviceCategories: categories,
    coordinates,
  };
}

async function loadLiveVendorState(ownerId: string) {
  const [draftResult, vendorResult] = await Promise.all([
    supabase!.from('vendor_onboarding_drafts').select('*').eq('owner_id', ownerId).maybeSingle(),
    supabase!.from('vendors').select('*').eq('owner_id', ownerId).maybeSingle(),
  ]);

  if (draftResult.error) throw draftResult.error;
  if (vendorResult.error) throw vendorResult.error;

  const vendor = vendorResult.data as VendorRow | null;
  let services: ServiceRow[] = [];

  if (vendor) {
    const servicesResult = await supabase!.from('services').select('*').eq('vendor_id', vendor.id);
    if (servicesResult.error) throw servicesResult.error;
    services = (servicesResult.data ?? []) as ServiceRow[];
  }

  return {
    draftRow: draftResult.data as VendorOnboardingDraftRow | null,
    vendor,
    services,
  };
}

function getDemoVendorState(ownerId: string) {
  const demo = useDemoDataStore.getState();
  const vendor = demo.vendors.find((item) => item.ownerId === ownerId) ?? null;
  return {
    draft: demo.onboardingDrafts.find((item) => item.ownerId === ownerId) ?? null,
    vendor,
    services: vendor ? demo.services.filter((item) => item.vendorId === vendor.id) : [],
  };
}

export async function loadVendorOnboardingDraft(): Promise<VendorOnboardingDraft> {
  const { session, profile } = requireSession();

  if (!isSupabaseConfigured || !supabase) {
    const { draft, vendor, services } = getDemoVendorState(session.userId);
    return draft ?? buildDraftFromVendorState({ ownerId: session.userId, profile, vendor, services });
  }

  const { draftRow, vendor, services } = await loadLiveVendorState(session.userId);
  if (draftRow) {
    return rowToDraft(draftRow, profile);
  }

  return buildDraftFromVendorState({ ownerId: session.userId, profile, vendor, services });
}

export async function saveVendorOnboardingDraft(patch: VendorOnboardingDraftPatch): Promise<VendorOnboardingDraft> {
  requireSession();
  await ensureProfileRow();
  const draft = mergeDraft(await loadVendorOnboardingDraft(), patch);

  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().saveOnboardingDraft(draft);
    return draft;
  }

  const { error } = await supabase.from('vendor_onboarding_drafts').upsert(draftToRow(draft), {
    onConflict: 'owner_id',
  });

  if (error) throw error;
  return draft;
}

export async function saveVendorOnboardingProfileDraft(profile: VendorOnboardingDraftPatch['profile'], businessType?: BusinessType) {
  return saveVendorOnboardingDraft({
    businessType,
    profile,
  });
}

export async function saveVendorOnboardingLocationDraft(location: VendorOnboardingDraftPatch['location']) {
  return saveVendorOnboardingDraft({ location });
}

export async function saveVendorOnboardingServicesDraft(services: VendorOnboardingServiceDraft[]) {
  return saveVendorOnboardingDraft({ services });
}

export async function submitVendorOnboarding(patch?: VendorOnboardingDraftPatch): Promise<VendorOnboardingDraft> {
  const { session, profile } = requireSession();
  await ensureProfileRow();

  const localDraft = useVendorOnboardingStore.getState().draft;
  let baseDraft: VendorOnboardingDraft;
  if (patch) {
    baseDraft = await saveVendorOnboardingDraft(patch);
  } else if (localDraft) {
    await saveVendorOnboardingDraft({});
    baseDraft = localDraft;
  } else {
    baseDraft = await loadVendorOnboardingDraft();
  }

  const draft = mergeDraft(baseDraft, {
    completed: true,
    submittedAt: new Date().toISOString(),
  });

  const errors = validateSubmission(draft);
  if (errors.length) {
    throw new Error(`Vendor onboarding submission invalid: ${errors.join('; ')}`);
  }

  if (!isSupabaseConfigured || !supabase) {
    const demo = useDemoDataStore.getState();
    const existingVendor = demo.vendors.find((item) => item.ownerId === session.userId) ?? null;
    const vendorId = existingVendor?.id ?? createDemoId('vendor');
    const vendor = toVendorSummary(vendorId, draft, existingVendor);
    const services = normalizeDemoVendorServices(vendorId, draft.services);

    demo.addOrUpdateProfile({
      id: session.userId,
      email: session.email,
      fullName: draft.profile.contactName!,
      phone: draft.profile.contactPhone!,
      avatarUrl: profile?.avatarUrl,
      role: 'vendor',
      businessType: draft.businessType,
    });
    demo.upsertVendor(vendor);
    demo.services
      .filter((service) => service.vendorId === vendorId)
      .forEach((service) => demo.removeService(service.id));
    services.forEach((service) => demo.upsertService(service));
    demo.saveOnboardingDraft(draft);
    useAuthStore.getState().setSessionData(session, {
      id: session.userId,
      email: session.email,
      fullName: draft.profile.contactName!,
      phone: draft.profile.contactPhone!,
      avatarUrl: profile?.avatarUrl,
      role: 'vendor',
      businessType: draft.businessType,
    });
    useVendorOnboardingStore.getState().setDraft(draft);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['vendor-self', session.userId] }),
      queryClient.invalidateQueries({ queryKey: ['vendor-services', session.userId] }),
    ]);
    return draft;
  }

  const { vendor } = await loadLiveVendorState(session.userId);
  const mobileEnabled = draft.location.mode === 'mobile' || draft.location.mode === 'hybrid';
  const vendorPayload = {
    owner_id: session.userId,
    business_type: draft.businessType,
    name: draft.profile.businessName,
    description: draft.profile.description!.trim(),
    address: draft.location.address,
    distance_miles: vendor?.distance_miles ?? 0,
    rating: vendor?.rating ?? 0,
    review_count: vendor?.review_count ?? 0,
    mobile_service_enabled: mobileEnabled,
    service_radius_miles: draft.location.serviceRadiusMiles ?? 0,
    next_available: vendor?.next_available ?? null,
    hero_image: vendor?.hero_image ?? null,
    service_categories: Array.from(
      new Set(
        draft.services
          .map((service) => service.category)
          .filter((category): category is ServiceCategory => Boolean(category)),
      ),
    ),
    latitude: draft.location.coordinates?.latitude,
    longitude: draft.location.coordinates?.longitude,
    location_mode: draft.location.mode,
    contact_name: draft.profile.contactName,
    contact_email: draft.profile.contactEmail,
    contact_phone: draft.profile.contactPhone,
  };

  const profilePayload = {
    id: session.userId,
    email: session.email,
    full_name: draft.profile.contactName,
    phone: draft.profile.contactPhone,
    avatar_url: profile?.avatarUrl ?? null,
    role: 'vendor',
    business_type: draft.businessType,
  };

  const { error: profileError } = await supabase.from('profiles').upsert(profilePayload);
  if (profileError) throw profileError;

  let vendorId = vendor?.id;
  if (vendorId) {
    const { error: vendorError } = await supabase
      .from('vendors')
      .update(vendorPayload)
      .eq('id', vendorId)
      .eq('owner_id', session.userId);
    if (vendorError) throw vendorError;
  } else {
    const vendorInsertResult = await supabase
      .from('vendors')
      .insert(vendorPayload)
      .select('id')
      .single();
    if (vendorInsertResult.error) throw vendorInsertResult.error;
    vendorId = vendorInsertResult.data.id;
  }

  const existingServicesResult = await supabase.from('services').select('id').eq('vendor_id', vendorId);
  if (existingServicesResult.error) throw existingServicesResult.error;

  const existingServiceIds = new Set((existingServicesResult.data ?? []).map((item: { id: string }) => item.id));
  const nextServiceIds = new Set(
    draft.services
      .map((service) => service.id)
      .filter((id): id is string => Boolean(id)),
  );
  const removedIds = Array.from(existingServiceIds).filter((id) => !nextServiceIds.has(id));

  if (removedIds.length) {
    const { error: deleteError } = await supabase.from('services').delete().in('id', removedIds);
    if (deleteError) throw deleteError;
  }

  for (const service of draft.services) {
    const servicePayload = {
      vendor_id: vendorId,
      title: service.title!.trim(),
      category: service.category!,
      description: service.description?.trim() ?? null,
      duration_minutes: service.durationMinutes!,
      price: service.price!,
      active: service.active ?? true,
      image: null,
    };

    if (service.id) {
      const { error: serviceError } = await supabase
        .from('services')
        .update(servicePayload)
        .eq('id', service.id)
        .eq('vendor_id', vendorId);
      if (serviceError) throw serviceError;
      continue;
    }

    const { error: serviceInsertError } = await supabase.from('services').insert(servicePayload);
    if (serviceInsertError) throw serviceInsertError;
  }

  const { error: draftError } = await supabase.from('vendor_onboarding_drafts').upsert(draftToRow(draft), {
    onConflict: 'owner_id',
  });
  if (draftError) throw draftError;

  useAuthStore.getState().setSessionData(session, {
    id: session.userId,
    email: session.email,
    fullName: draft.profile.contactName!,
    phone: draft.profile.contactPhone!,
    avatarUrl: profile?.avatarUrl,
    role: 'vendor',
    businessType: draft.businessType,
  });
  useVendorOnboardingStore.getState().setDraft(draft);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['vendor-self', session.userId] }),
    queryClient.invalidateQueries({ queryKey: ['vendor-services', session.userId] }),
  ]);

  return draft;
}
