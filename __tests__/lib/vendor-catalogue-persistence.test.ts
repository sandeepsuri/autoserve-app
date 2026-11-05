import AsyncStorage from '@react-native-async-storage/async-storage';

import { upsertVendorService } from '@/lib/vendor-admin';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { Service } from '@/types/domain';

jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: null }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => ({ session: { userId: 'owner-1' } }) } }));

const storage = new Map<string, string>();
const service = (id: string): Service => ({
  id, vendorId: 'vendor-1', title: `Oil Change ${id}`, category: 'oil', price: 50, durationMinutes: 30, active: true,
});

beforeEach(() => {
  storage.clear();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key) => storage.get(key) ?? null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => { storage.set(key, value); });
  useDemoDataStore.setState({ services: [service('first'), service('second'), service('third')] });
});

test('successive demo edits and additions survive storage rehydration with titles and order intact', async () => {
  for (const id of ['second', 'first', 'third', 'second']) {
    await upsertVendorService({ ...service(id), title: '  Full  Synthetic Oil Change  ', price: 99 });
    // Discard in-memory services, then restore from persisted AsyncStorage,
    // exercising the same hydration path used after an app relaunch.
    const saved = storage.get('autoserve-demo-data')!;
    useDemoDataStore.setState({ services: [] });
    storage.set('autoserve-demo-data', saved);
    await useDemoDataStore.persist.rehydrate();
    const rows = useDemoDataStore.getState().services;
    expect(rows.map((s) => s.id)).toEqual(['first', 'second', 'third']);
    expect(rows.find((s) => s.id === id)?.title).toBe('Full  Synthetic Oil Change');
  }
  await upsertVendorService(service('fourth'));
  await useDemoDataStore.persist.rehydrate();
  expect(useDemoDataStore.getState().services.map((s) => s.id)).toEqual(['first', 'second', 'third', 'fourth']);
});
