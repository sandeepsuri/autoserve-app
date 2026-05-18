import { apiBaseUrl } from './api-config';

export interface VehicleMake {
  label: string;
  path: string;
}

interface MakesResponse {
  items: VehicleMake[];
}

export async function listVehicleMakes(): Promise<VehicleMake[]> {
  const res = await fetch(`${apiBaseUrl}/api/v1/vehicle-selection/makes`);
  if (!res.ok) throw new Error(`Failed to load makes (${res.status})`);
  const body = (await res.json()) as MakesResponse;
  return body.items ?? [];
}

export interface VehicleModel {
  label: string;
  path: string;
}

interface ModelsResponse {
  items: VehicleModel[];
}

export async function listVehicleModels(make: string): Promise<VehicleModel[]> {
  const res = await fetch(
    `${apiBaseUrl}/api/v1/vehicle-selection/models?make=${encodeURIComponent(make)}`,
  );
  if (!res.ok) throw new Error(`Failed to load models (${res.status})`);
  const body = (await res.json()) as ModelsResponse;
  return body.items ?? [];
}

export interface VehicleYear {
  label: string;
  path: string;
}

interface YearsResponse {
  items: VehicleYear[];
}

export async function listVehicleYears(make: string, model: string): Promise<VehicleYear[]> {
  const params = new URLSearchParams({ make, model });
  const res = await fetch(`${apiBaseUrl}/api/v1/vehicle-selection/years?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to load years (${res.status})`);
  const body = (await res.json()) as YearsResponse;
  return body.items ?? [];
}
