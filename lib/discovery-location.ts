import { VendorSummary } from '@/types/domain';

export const DEFAULT_NEARBY_RADIUS_MILES = 30;

const EARTH_RADIUS_MILES = 3958.8;
const DEFAULT_REGION_DELTA = 0.08;
const REGION_PADDING = 1.4;
// Below this a new position is GPS jitter, not a move worth panning the map for.
const RECENTER_THRESHOLD_MILES = 0.06;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends Coordinates {
  latitudeDelta: number;
  longitudeDelta: number;
}

export type DiscoveryVendor = VendorSummary & {
  /** Real client-to-vendor distance; null when either position is unknown. */
  distanceFromClientMiles: number | null;
};

export interface DiscoveryRanking {
  vendors: DiscoveryVendor[];
  /** Vendors dropped only because they are beyond the radius. */
  outsideRadiusCount: number;
}

/** 0,0 is what an unset location looks like in this data, so it counts as invalid. */
export function isValidCoordinates(value: Partial<Coordinates> | null | undefined): value is Coordinates {
  const latitude = value?.latitude;
  const longitude = value?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
  return !(latitude === 0 && longitude === 0);
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function distanceMilesBetween(from: Coordinates, to: Coordinates) {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

/**
 * Orders vendors for discovery. With a client position: nearest first, beyond
 * the radius removed, and vendors without usable coordinates kept at the end
 * with no distance. Without one: input order, no distances, no radius filter.
 * Pass a null radius to keep every vendor regardless of distance.
 */
export function rankVendorsForClient(
  vendors: VendorSummary[],
  client: Coordinates | null | undefined,
  maxDistanceMiles: number | null = DEFAULT_NEARBY_RADIUS_MILES,
): DiscoveryRanking {
  if (!isValidCoordinates(client)) {
    return {
      vendors: vendors.map((vendor) => ({ ...vendor, distanceFromClientMiles: null })),
      outsideRadiusCount: 0,
    };
  }

  const located: DiscoveryVendor[] = [];
  const unlocated: DiscoveryVendor[] = [];
  let outsideRadiusCount = 0;

  for (const vendor of vendors) {
    if (!isValidCoordinates(vendor.coordinates)) {
      unlocated.push({ ...vendor, distanceFromClientMiles: null });
      continue;
    }
    const distance = distanceMilesBetween(client, vendor.coordinates);
    if (maxDistanceMiles !== null && distance > maxDistanceMiles) {
      outsideRadiusCount += 1;
      continue;
    }
    located.push({ ...vendor, distanceFromClientMiles: distance });
  }

  located.sort((a, b) => (a.distanceFromClientMiles as number) - (b.distanceFromClientMiles as number));
  return { vendors: [...located, ...unlocated], outsideRadiusCount };
}

/**
 * The client's position when known. Otherwise frames the vendors' own
 * locations, which is a browsing view and never stands in for the client.
 */
export function resolveMapRegion(
  client: Coordinates | null | undefined,
  vendors: Pick<VendorSummary, 'coordinates'>[],
): MapRegion | null {
  if (isValidCoordinates(client)) {
    return {
      latitude: client.latitude,
      longitude: client.longitude,
      latitudeDelta: DEFAULT_REGION_DELTA,
      longitudeDelta: DEFAULT_REGION_DELTA,
    };
  }

  const points = vendors.map((vendor) => vendor.coordinates).filter(isValidCoordinates);
  if (!points.length) return null;

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max(DEFAULT_REGION_DELTA, (maxLatitude - minLatitude) * REGION_PADDING),
    longitudeDelta: Math.max(DEFAULT_REGION_DELTA, (maxLongitude - minLongitude) * REGION_PADDING),
  };
}

export function shouldRecenterMap(previous: MapRegion | null, next: MapRegion | null) {
  if (!next) return false;
  if (!previous) return true;
  return (
    distanceMilesBetween(previous, next) > RECENTER_THRESHOLD_MILES ||
    Math.abs(previous.latitudeDelta - next.latitudeDelta) > 0.001 ||
    Math.abs(previous.longitudeDelta - next.longitudeDelta) > 0.001
  );
}
