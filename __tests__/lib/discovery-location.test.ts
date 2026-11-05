jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: false,
  isDemoDataEnabled: true,
  supabase: null,
}));

import { demoVendors } from '@/constants/mock-data';
import {
  distanceMilesBetween,
  isValidCoordinates,
  rankVendorsForClient,
  resolveMapRegion,
  shouldRecenterMap,
} from '@/lib/discovery-location';
import { listVendors } from '@/lib/vendors';
import { VendorSummary } from '@/types/domain';

const TORONTO = { latitude: 43.6532, longitude: -79.3832 };
const MISSISSAUGA = { latitude: 43.589, longitude: -79.6441 };
const HAMILTON = { latitude: 43.2557, longitude: -79.8711 };
const MONTREAL = { latitude: 45.5019, longitude: -73.5674 };

const vendor = (id: string, coordinates: unknown, overrides: Partial<VendorSummary> = {}) =>
  ({
    id,
    name: id,
    distanceMiles: 1,
    coordinates,
    ...overrides,
  }) as VendorSummary;

const ids = (vendors: { id: string }[]) => vendors.map((item) => item.id);

describe('isValidCoordinates', () => {
  it.each([
    ['null', null],
    ['missing values', {}],
    ['null values', { latitude: null, longitude: null }],
    ['strings', { latitude: '43.6', longitude: '-79.3' }],
    ['NaN', { latitude: NaN, longitude: -79.3 }],
    ['infinity', { latitude: 43.6, longitude: Infinity }],
    ['latitude out of range', { latitude: 91, longitude: -79.3 }],
    ['longitude out of range', { latitude: 43.6, longitude: -181 }],
    ['the unset 0,0 position', { latitude: 0, longitude: 0 }],
  ])('rejects %s', (_label, value) => {
    expect(isValidCoordinates(value as never)).toBe(false);
  });

  it('accepts real positions, including one on the equator', () => {
    expect(isValidCoordinates(TORONTO)).toBe(true);
    expect(isValidCoordinates({ latitude: 0, longitude: 32.5 })).toBe(true);
  });
});

describe('distanceMilesBetween', () => {
  it('is zero for the same point', () => {
    expect(distanceMilesBetween(TORONTO, TORONTO)).toBe(0);
  });

  it('matches the known Toronto to Montreal distance', () => {
    expect(distanceMilesBetween(TORONTO, MONTREAL)).toBeCloseTo(313, -1);
  });

  it('is the same in both directions', () => {
    expect(distanceMilesBetween(TORONTO, HAMILTON)).toBeCloseTo(distanceMilesBetween(HAMILTON, TORONTO), 8);
  });
});

describe('rankVendorsForClient with a client position', () => {
  it('orders by real distance, ignoring the stored distance_miles', () => {
    const { vendors } = rankVendorsForClient(
      [
        vendor('hamilton', HAMILTON, { distanceMiles: 0.1 }),
        vendor('downtown', TORONTO, { distanceMiles: 99 }),
        vendor('mississauga', MISSISSAUGA, { distanceMiles: 5 }),
      ],
      TORONTO,
      null,
    );
    expect(ids(vendors)).toEqual(['downtown', 'mississauga', 'hamilton']);
    expect(vendors[0].distanceFromClientMiles).toBe(0);
    expect(vendors[1].distanceFromClientMiles).toBeCloseTo(distanceMilesBetween(TORONTO, MISSISSAUGA), 8);
  });

  it('drops vendors beyond the radius and counts them', () => {
    const { vendors, outsideRadiusCount } = rankVendorsForClient(
      [vendor('downtown', TORONTO), vendor('montreal', MONTREAL)],
      TORONTO,
      30,
    );
    expect(ids(vendors)).toEqual(['downtown']);
    expect(outsideRadiusCount).toBe(1);
  });

  it('keeps every vendor, nearest first, when the radius is off', () => {
    const { vendors, outsideRadiusCount } = rankVendorsForClient(
      [vendor('montreal', MONTREAL), vendor('downtown', TORONTO)],
      TORONTO,
      null,
    );
    expect(ids(vendors)).toEqual(['downtown', 'montreal']);
    expect(outsideRadiusCount).toBe(0);
  });

  it('lists vendors with invalid coordinates last with no distance', () => {
    const { vendors, outsideRadiusCount } = rankVendorsForClient(
      [
        vendor('null-island', { latitude: 0, longitude: 0 }),
        vendor('missing', { latitude: null, longitude: null }),
        vendor('downtown', TORONTO),
      ],
      TORONTO,
    );
    expect(ids(vendors)).toEqual(['downtown', 'null-island', 'missing']);
    expect(vendors[1].distanceFromClientMiles).toBeNull();
    expect(vendors[2].distanceFromClientMiles).toBeNull();
    expect(outsideRadiusCount).toBe(0);
  });
});

describe('rankVendorsForClient without a client position', () => {
  it.each([
    ['null', null],
    ['invalid', { latitude: 0, longitude: 0 }],
  ])('keeps order, removes nothing and reports no distance for a %s position', (_label, client) => {
    const { vendors, outsideRadiusCount } = rankVendorsForClient(
      [vendor('montreal', MONTREAL, { distanceMiles: 4 }), vendor('downtown', TORONTO, { distanceMiles: 2 })],
      client,
    );
    expect(ids(vendors)).toEqual(['montreal', 'downtown']);
    expect(vendors.every((item) => item.distanceFromClientMiles === null)).toBe(true);
    expect(outsideRadiusCount).toBe(0);
  });
});

describe('guest/demo fallback', () => {
  it('keeps demo vendors browsable with no location, without distances', async () => {
    const demoVendors = await listVendors();
    expect(demoVendors.length).toBe(demoVendors.length);
    const { vendors } = rankVendorsForClient(demoVendors, null);
    expect(vendors).toHaveLength(demoVendors.length);
    expect(vendors.every((item) => item.distanceFromClientMiles === null)).toBe(true);
  });

  it('offers the far-away demo vendors through the radius count', async () => {
    const { vendors, outsideRadiusCount } = rankVendorsForClient(await listVendors(), TORONTO);
    expect(vendors).toHaveLength(0);
    expect(outsideRadiusCount).toBe(demoVendors.length);
  });
});

describe('resolveMapRegion', () => {
  it('centers on the client, not on a vendor', () => {
    const region = resolveMapRegion(TORONTO, [vendor('montreal', MONTREAL)]);
    expect(region).toMatchObject(TORONTO);
  });

  it('frames valid vendors when the client is unknown, skipping invalid ones', () => {
    const region = resolveMapRegion(null, [
      vendor('bad', { latitude: 0, longitude: 0 }),
      vendor('downtown', TORONTO),
      vendor('hamilton', HAMILTON),
    ]);
    expect(region?.latitude).toBeCloseTo((TORONTO.latitude + HAMILTON.latitude) / 2, 8);
    expect(region?.longitude).toBeCloseTo((TORONTO.longitude + HAMILTON.longitude) / 2, 8);
    expect(region?.latitudeDelta).toBeGreaterThan(TORONTO.latitude - HAMILTON.latitude);
  });

  it('is null when there is nothing valid to show', () => {
    expect(resolveMapRegion(null, [vendor('bad', { latitude: 0, longitude: 0 })])).toBeNull();
    expect(resolveMapRegion(null, [])).toBeNull();
  });
});

describe('shouldRecenterMap', () => {
  const region = (latitude: number) => ({ latitude, longitude: -79.38, latitudeDelta: 0.08, longitudeDelta: 0.08 });

  it('recenters on the first region and on a real move', () => {
    expect(shouldRecenterMap(null, region(43.65))).toBe(true);
    expect(shouldRecenterMap(region(43.65), region(43.7))).toBe(true);
  });

  it('ignores GPS jitter, so a foreground refresh does not undo panning', () => {
    expect(shouldRecenterMap(region(43.65), region(43.6501))).toBe(false);
  });

  it('does nothing without a target region', () => {
    expect(shouldRecenterMap(region(43.65), null)).toBe(false);
  });
});
