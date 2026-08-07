import { ensureProfileRow } from './auth';
import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';
import { useVendorAvailabilityStore } from '@/store/useVendorAvailabilityStore';
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
  VendorApplicationStatus,
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

type VendorApplicationRow = {
  id: string;
  owner_id: string;
  status: VendorApplicationStatus;
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
  availability: unknown;
  submitted_at: string | null;
  reviewer_notes: string | null;
  updated_at: string | null;
};

export function isVendorApplicationEditable(status?: VendorApplicationStatus) {
  return !status || status === 'draft' || status === 'needs_more_info';
}

export function isVendorApplicationLocked(status?: VendorApplicationStatus) {
  return !isVendorApplicationEditable(status);
}

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

function rowToDraft(row: VendorApplicationRow, profile?: UserProfile | null): VendorOnboardingDraft {
  const isSubmitted = row.status !== 'draft' && row.status !== 'needs_more_info';
  return {
    ownerId: row.owner_id,
    applicationId: row.id,
    applicationStatus: row.status,
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
    availability: (row.availability as VendorOnboardingDraft['availability']) ?? undefined,
    completed: isSubmitted || Boolean(row.submitted_at),
    submittedAt: row.submitted_at ?? undefined,
    reviewerNotes: row.reviewer_notes ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function draftToApplicationRow(draft: VendorOnboardingDraft): Omit<VendorApplicationRow, 'id' | 'status' | 'reviewer_notes' | 'updated_at'> {
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
    availability: draft.availability ?? null,
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

async function loadLiveVendorState(ownerId: string) {
  const [applicationResult, vendorResult] = await Promise.all([
    supabase!.from('vendor_applications').select('*').eq('owner_id', ownerId).maybeSingle(),
    supabase!.from('vendors').select('*').eq('owner_id', ownerId).maybeSingle(),
  ]);

  if (applicationResult.error) throw applicationResult.error;
  if (vendorResult.error) throw vendorResult.error;

  const vendor = vendorResult.data as VendorRow | null;
  let services: ServiceRow[] = [];

  if (vendor) {
    const servicesResult = await supabase!.from('services').select('*').eq('vendor_id', vendor.id);
    if (servicesResult.error) throw servicesResult.error;
    services = (servicesResult.data ?? []) as ServiceRow[];
  }

  return {
    applicationRow: applicationResult.data as VendorApplicationRow | null,
    vendor,
    services,
  };
}

function getDemoVendorState(ownerId: string) {
  const demo = useDemoDataStore.getState();
  const vendor = demo.vendors.find((item) => item.ownerId === ownerId) ?? null;
  const application = demo.vendorApplications.find((item) => item.ownerId === ownerId) ?? null;
  return {
    application,
    draft: demo.onboardingDrafts.find((item) => item.ownerId === ownerId) ?? null,
    vendor,
    services: vendor ? demo.services.filter((item) => item.vendorId === vendor.id) : [],
  };
}

export async function loadVendorOnboardingDraft(): Promise<VendorOnboardingDraft> {
  const { session, profile } = requireSession();

  if (!isSupabaseConfigured || !supabase) {
    const { application, draft, vendor, services } = getDemoVendorState(session.userId);
    if (application) {
      return {
        ownerId: application.ownerId,
        applicationId: application.id,
        applicationStatus: application.status,
        businessType: application.businessType,
        profile: application.profile,
        location: application.location,
        services: application.services,
        completed: application.status !== 'draft' && application.status !== 'needs_more_info',
        submittedAt: application.submittedAt,
        reviewerNotes: application.reviewerNotes,
        updatedAt: application.updatedAt,
      };
    }
    return draft ?? buildDraftFromVendorState({ ownerId: session.userId, profile, vendor, services });
  }

  const { applicationRow, vendor, services } = await loadLiveVendorState(session.userId);
  if (applicationRow) {
    return rowToDraft(applicationRow, profile);
  }

  return buildDraftFromVendorState({ ownerId: session.userId, profile, vendor, services });
}

export async function saveVendorOnboardingDraft(patch: VendorOnboardingDraftPatch): Promise<VendorOnboardingDraft> {
  requireSession();
  await ensureProfileRow();
  const currentDraft = await loadVendorOnboardingDraft();
  if (isVendorApplicationLocked(currentDraft.applicationStatus)) {
    useVendorOnboardingStore.getState().setDraft(currentDraft);
    return currentDraft;
  }

  const draft = mergeDraft(currentDraft, patch);

  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().saveOnboardingDraft(draft);
    return draft;
  }

  const { error } = await supabase.from('vendor_applications').upsert(draftToApplicationRow(draft), {
    onConflict: 'owner_id',
  });

  if (error) throw error;
  return draft;
}

export async function submitVendorOnboarding(patch?: VendorOnboardingDraftPatch): Promise<VendorOnboardingDraft> {
  const { session, profile } = requireSession();
  await ensureProfileRow();

  const localDraft = useVendorOnboardingStore.getState().draft;
  const currentDraft = localDraft ?? await loadVendorOnboardingDraft();
  if (isVendorApplicationLocked(currentDraft.applicationStatus)) {
    useVendorOnboardingStore.getState().setDraft(currentDraft);
    return currentDraft;
  }

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
  // Availability is edited in a separate store during onboarding; capture it
  // onto the draft so it persists to the application and is materialized into a
  // real vendor_availability row on approval.
  draft.availability = useVendorAvailabilityStore.getState().availability;

  const errors = validateSubmission(draft);
  if (errors.length) {
    throw new Error(`Vendor onboarding submission invalid: ${errors.join('; ')}`);
  }

  if (!isSupabaseConfigured || !supabase) {
    const demo = useDemoDataStore.getState();
    const applicationId = draft.applicationId ?? createDemoId('application');
    const submittedApplication = {
      id: applicationId,
      ownerId: session.userId,
      status: 'submitted' as const,
      businessType: draft.businessType,
      profile: {
        businessName: draft.profile.businessName,
        description: draft.profile.description,
        contactName: draft.profile.contactName,
        contactEmail: draft.profile.contactEmail,
        contactPhone: draft.profile.contactPhone,
      },
      location: draft.location,
      services: draft.services,
      submittedAt: draft.submittedAt,
      updatedAt: draft.updatedAt,
    };

    demo.saveVendorApplication(submittedApplication);
    demo.saveOnboardingDraft({
      ...draft,
      applicationId,
      applicationStatus: 'submitted',
    });
    useVendorOnboardingStore.getState().setDraft({
      ...draft,
      applicationId,
      applicationStatus: 'submitted',
    });
    return {
      ...draft,
      applicationId,
      applicationStatus: 'submitted',
    };
  }

  const applicationPayload = draftToApplicationRow(draft);
  const { error: applicationError } = await supabase.from('vendor_applications').upsert(applicationPayload, {
    onConflict: 'owner_id',
  });
  if (applicationError) throw applicationError;

  const { data: submittedApplication, error: submitError } = await supabase.rpc('submit_vendor_application');
  if (submitError) throw submitError;

  const submittedDraft = rowToDraft(submittedApplication as VendorApplicationRow, profile);
  useVendorOnboardingStore.getState().setDraft(submittedDraft);
  await queryClient.invalidateQueries({ queryKey: ['vendor-application', session.userId] });

  return submittedDraft;
}
