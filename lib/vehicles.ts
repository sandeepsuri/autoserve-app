import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { Vehicle } from '@/types/domain';


import { isSupabaseConfigured, supabase } from './supabase';

export async function listVehicles() {
  const ownerId = useAuthStore.getState().session?.userId;
  if (!ownerId) return [];

  if (!isSupabaseConfigured || !supabase) {
    return useDemoDataStore.getState().vehicles.filter((vehicle) => vehicle.ownerId === ownerId);
  }

  const { data, error } = await supabase.from('vehicles').select('*').eq('owner_id', ownerId);
  if (error || !data) {
    return useDemoDataStore.getState().vehicles.filter((vehicle) => vehicle.ownerId === ownerId);
  }

  return data.map(
    (item): Vehicle => ({
      id: item.id,
      ownerId: item.owner_id,
      make: item.make,
      model: item.model,
      year: item.year,
      nickname: item.nickname ?? undefined,
      isDefault: item.is_default ?? false,
    })
  );
}

export async function createVehicle(vehicle: Omit<Vehicle, 'id'>) {
  const newVehicle: Vehicle = {
    ...vehicle,
    id: `vehicle-${Date.now()}`,
  };

  if (!isSupabaseConfigured || !supabase) {
    useDemoDataStore.getState().addVehicle(newVehicle);
    return newVehicle;
  }

  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      owner_id: vehicle.ownerId,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      nickname: vehicle.nickname ?? null,
      is_default: vehicle.isDefault ?? false,
    })
    .select('*')
    .single();

  if (error || !data) {
    const isAuthenticated = Boolean(useAuthStore.getState().session);
    if (isAuthenticated) {
      throw new Error(error ? (error as { message?: string }).message ?? String(error) : 'Vehicle insert returned no data');
    }
    useDemoDataStore.getState().addVehicle(newVehicle);
    return newVehicle;
  }

  return {
    id: data.id,
    ownerId: data.owner_id,
    make: data.make,
    model: data.model,
    year: data.year,
    nickname: data.nickname ?? undefined,
    isDefault: data.is_default ?? false,
  };
}
