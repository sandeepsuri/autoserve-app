import { useAuthStore } from '@/store/useAuthStore';
import { useDemoDataStore } from '@/store/useDemoDataStore';
import { Vehicle } from '@/types/domain';

import { isSupabaseConfigured, supabase } from './supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToVehicle(item: Record<string, unknown>): Vehicle {
  return {
    id: item.id as string,
    ownerId: item.owner_id as string,
    make: item.make as string,
    model: item.model as string,
    year: item.year as string,
    trim: (item.trim as string | null) ?? undefined,
    plate: (item.plate as string | null) ?? undefined,
    color: (item.color as string | null) ?? undefined,
    photoUrl: (item.photo_url as string | null) ?? undefined,
    nickname: (item.nickname as string | null) ?? undefined,
    isDefault: (item.is_default as boolean | null) ?? false,
  };
}

function resolveOwnerId(): string | null {
  const { session, guestClientId } = useAuthStore.getState();
  return session?.userId ?? guestClientId ?? null;
}

function shouldUseSupabase(): boolean {
  return Boolean(isSupabaseConfigured && supabase && useAuthStore.getState().session);
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listVehicles(): Promise<Vehicle[]> {
  const ownerId = resolveOwnerId();
  if (!ownerId) return [];

  const client = shouldUseSupabase() ? supabase : null;

  if (!client) {
    return useDemoDataStore.getState().vehicles.filter((v) => v.ownerId === ownerId);
  }

  const { data, error } = await client
    .from('vehicles')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message ?? 'Failed to load vehicles');
  }

  return (data ?? []).map((item) => rowToVehicle(item as Record<string, unknown>));
}

// ─── Get by id ────────────────────────────────────────────────────────────────

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const ownerId = resolveOwnerId();

  const client = shouldUseSupabase() ? supabase : null;

  if (!client) {
    const v = useDemoDataStore.getState().vehicles.find((v) => v.id === id);
    if (!v) return null;
    if (ownerId && v.ownerId !== ownerId) return null;
    return v;
  }

  if (!ownerId) return null;

  const { data, error } = await client
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToVehicle(data as Record<string, unknown>);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createVehicle(vehicle: Omit<Vehicle, 'id'>): Promise<Vehicle> {
  const ownerId = vehicle.ownerId || resolveOwnerId();
  if (!ownerId) throw new Error('Sign in required to save a vehicle');

  const newVehicle: Vehicle = {
    ...vehicle,
    ownerId,
    id: `vehicle-${Date.now()}`,
  };

  const client = shouldUseSupabase() ? supabase : null;

  if (!client) {
    if (newVehicle.isDefault) {
      useDemoDataStore.getState().clearVehicleDefaults(ownerId);
    }
    useDemoDataStore.getState().addVehicle(newVehicle);
    return newVehicle;
  }

  if (vehicle.isDefault) {
    const { error } = await client
      .from('vehicles')
      .update({ is_default: false })
      .eq('owner_id', ownerId)
      .eq('is_default', true);
    if (error) throw new Error(error.message ?? 'Failed to clear default vehicle');
  }

  const { data, error } = await client
    .from('vehicles')
    .insert({
      owner_id: ownerId,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      trim: vehicle.trim ?? null,
      plate: vehicle.plate ?? null,
      color: vehicle.color ?? null,
      photo_url: vehicle.photoUrl ?? null,
      nickname: vehicle.nickname ?? null,
      is_default: vehicle.isDefault ?? false,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error ? (error as { message?: string }).message ?? String(error) : 'Vehicle insert returned no data');
  }

  return rowToVehicle(data as Record<string, unknown>);
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateVehicle(id: string, patch: Partial<Omit<Vehicle, 'id' | 'ownerId'>>): Promise<Vehicle> {
  const ownerId = resolveOwnerId();
  if (!ownerId) throw new Error('Sign in required to update a vehicle');

  const client = shouldUseSupabase() ? supabase : null;

  if (!client) {
    if (patch.isDefault) {
      useDemoDataStore.getState().clearVehicleDefaults(ownerId);
    }
    useDemoDataStore.getState().updateVehicle(id, patch);
    const updated = useDemoDataStore.getState().vehicles.find((v) => v.id === id);
    if (!updated) throw new Error('Vehicle not found');
    return updated;
  }

  if (patch.isDefault) {
    const { error } = await client
      .from('vehicles')
      .update({ is_default: false })
      .eq('owner_id', ownerId)
      .eq('is_default', true);
    if (error) throw new Error(error.message ?? 'Failed to clear default vehicle');
  }

  const updates: Record<string, unknown> = {};
  if (patch.make !== undefined) updates.make = patch.make;
  if (patch.model !== undefined) updates.model = patch.model;
  if (patch.year !== undefined) updates.year = patch.year;
  if (patch.trim !== undefined) updates.trim = patch.trim ?? null;
  if (patch.plate !== undefined) updates.plate = patch.plate ?? null;
  if (patch.color !== undefined) updates.color = patch.color ?? null;
  if (patch.photoUrl !== undefined) updates.photo_url = patch.photoUrl ?? null;
  if (patch.nickname !== undefined) updates.nickname = patch.nickname ?? null;
  if (patch.isDefault !== undefined) updates.is_default = patch.isDefault;

  const { data, error } = await client
    .from('vehicles')
    .update(updates)
    .eq('id', id)
    .eq('owner_id', ownerId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message ?? 'Failed to update vehicle');
  if (!data) throw new Error('Vehicle not found or update did not affect any rows');
  return rowToVehicle(data as Record<string, unknown>);
}

// ─── Remove ───────────────────────────────────────────────────────────────────

export async function removeVehicle(id: string): Promise<void> {
  const ownerId = resolveOwnerId();
  if (!ownerId) throw new Error('Sign in required to remove a vehicle');

  const client = shouldUseSupabase() ? supabase : null;

  if (!client) {
    const vehicles = useDemoDataStore.getState().vehicles;
    const target = vehicles.find((v) => v.id === id && v.ownerId === ownerId);
    if (!target) return;
    useDemoDataStore.getState().removeVehicle(id);
    if (target.isDefault) {
      const remaining = useDemoDataStore.getState().vehicles.filter((v) => v.ownerId === ownerId);
      if (remaining.length > 0) {
        useDemoDataStore.getState().updateVehicle(remaining[0].id, { isDefault: true });
      }
    }
    return;
  }

  const { data: target, error: targetError } = await client
    .from('vehicles')
    .select('is_default')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (targetError) throw new Error(targetError.message ?? 'Failed to load vehicle');

  const { error } = await client.from('vehicles').delete().eq('id', id).eq('owner_id', ownerId);
  if (error) throw new Error(error.message ?? 'Failed to remove vehicle');

  if (target?.is_default) {
    const { data: next } = await client
      .from('vehicles')
      .select('id')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (next?.id) {
      await client.from('vehicles').update({ is_default: true }).eq('id', next.id);
    }
  }
}

// ─── Set default ──────────────────────────────────────────────────────────────

export async function setDefaultVehicle(id: string): Promise<Vehicle> {
  return updateVehicle(id, { isDefault: true });
}
