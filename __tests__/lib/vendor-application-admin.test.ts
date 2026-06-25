jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: jest.fn(),
  },
}));

import {
  approveVendorApplication,
  rejectVendorApplication,
  requestVendorApplicationInfo,
  suspendVendorApplication,
} from '@/lib/vendor-application-admin';
import { supabase } from '@/lib/supabase';

const mockRpc = supabase!.rpc as jest.Mock;

const applicationRow = {
  id: 'application-1',
  owner_id: 'owner-1',
  status: 'needs_more_info',
  business_type: 'shop',
  business_name: 'Riverside Garage',
  business_description: 'General repair.',
  contact_name: 'Alex Rivers',
  contact_email: 'alex@example.com',
  contact_phone: '+1 555 0101',
  location_mode: 'hybrid',
  address: '482 Riverside Way',
  latitude: 34.0522,
  longitude: -118.2437,
  service_radius_miles: 30,
  service_catalog: [{ title: 'Brake Check', category: 'brakes' }],
  submitted_at: '2026-06-23T00:00:00.000Z',
  reviewer_notes: 'Please add insurance details.',
  updated_at: '2026-06-23T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('vendor application admin RPC service', () => {
  it('approves via the admin-gated RPC and maps the active vendor', async () => {
    mockRpc.mockResolvedValue({
      data: {
        id: 'vendor-1',
        owner_id: 'owner-1',
        business_type: 'shop',
        name: 'Riverside Garage',
        description: 'General repair.',
        address: '482 Riverside Way',
        distance_miles: 0,
        rating: 0,
        review_count: 0,
        mobile_service_enabled: true,
        service_radius_miles: 30,
        next_available: null,
        hero_image: null,
        service_categories: ['brakes'],
        latitude: 34.0522,
        longitude: -118.2437,
      },
      error: null,
    });

    const vendor = await approveVendorApplication('application-1', 'Approved');

    expect(mockRpc).toHaveBeenCalledWith('approve_vendor_application', {
      p_application_id: 'application-1',
      p_reason: 'Approved',
    });
    expect(vendor).toEqual(expect.objectContaining({
      id: 'vendor-1',
      ownerId: 'owner-1',
      mobileServiceEnabled: true,
      serviceCategories: ['brakes'],
    }));
  });

  it.each([
    ['rejectVendorApplication', rejectVendorApplication, 'reject_vendor_application', 'rejected'],
    ['requestVendorApplicationInfo', requestVendorApplicationInfo, 'request_vendor_application_info', 'needs_more_info'],
    ['suspendVendorApplication', suspendVendorApplication, 'suspend_vendor_application', 'suspended'],
  ])('calls %s with an application id and reason', async (_name, action, rpcName, status) => {
    mockRpc.mockResolvedValue({
      data: { ...applicationRow, status },
      error: null,
    });

    const application = await action('application-1', 'Admin note');

    expect(mockRpc).toHaveBeenCalledWith(rpcName, {
      p_application_id: 'application-1',
      p_reason: 'Admin note',
    });
    expect(application).toEqual(expect.objectContaining({
      id: 'application-1',
      ownerId: 'owner-1',
      status,
      reviewerNotes: 'Please add insurance details.',
    }));
  });

  it('throws when Supabase rejects an admin transition', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Admin access required' },
    });

    await expect(rejectVendorApplication('application-1', 'No license')).rejects.toMatchObject({
      message: 'Admin access required',
    });
  });
});
