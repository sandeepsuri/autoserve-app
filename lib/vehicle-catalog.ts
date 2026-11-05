import { getApiBaseUrl } from './api-config';

export interface VehicleMake {
  label: string;
  path: string;
}
export type VehicleModel = VehicleMake;
export type VehicleYear = VehicleMake;

async function loadCatalog(step: string, params?: URLSearchParams): Promise<VehicleMake[]> {
  const base = getApiBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${base}/api/v1/vehicle-selection/${step}${params ? `?${params.toString()}` : ''}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Couldn't load ${step} (HTTP ${res.status}). Please try again.`);
    }
    const body: unknown = await res.json();
    if (!body || typeof body !== 'object' || !('items' in body) || !Array.isArray(body.items) ||
      !body.items.every((item: unknown) => item && typeof item === 'object' && 'label' in item &&
        typeof item.label === 'string' && item.label.trim() && 'path' in item && typeof item.path === 'string')) {
      throw new Error(`The vehicle service returned invalid ${step}. Please try again.`);
    }
    return body.items as VehicleMake[];
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Loading ${step} timed out. Check your connection and try again.`);
    if (error instanceof TypeError) throw new Error(`Couldn't reach the vehicle service to load ${step}. Check your connection and try again.`);
    if (error instanceof SyntaxError) throw new Error(`The vehicle service returned invalid ${step}. Please try again.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function listVehicleMakes(): Promise<VehicleMake[]> {
  return loadCatalog('makes');
}

export function listVehicleModels(make: string): Promise<VehicleModel[]> {
  return loadCatalog('models', new URLSearchParams({ make }));
}

export function listVehicleYears(make: string, model: string): Promise<VehicleYear[]> {
  return loadCatalog('years', new URLSearchParams({ make, model }));
}
