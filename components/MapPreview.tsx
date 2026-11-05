import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { colors, radius, typography } from '@/constants/theme';
import { Coordinates, isValidCoordinates, MapRegion, resolveMapRegion, shouldRecenterMap } from '@/lib/discovery-location';
import { VendorSummary } from '@/types/domain';

interface Props {
  vendors: VendorSummary[];
  height?: number;
  geocodedCoords?: Coordinates | null;
  clientCoords?: Coordinates | null;
}

export function MapPreview({ vendors, height = 240, geocodedCoords, clientCoords }: Props) {
  const mapRef = useRef<MapView>(null);
  const client = isValidCoordinates(clientCoords) ? clientCoords : null;
  const region = useMemo(
    () => resolveMapRegion(geocodedCoords ?? client, vendors),
    [geocodedCoords, client, vendors],
  );
  const lastRegion = useRef<MapRegion | null>(region);

  // initialRegion only applies on mount, so later position changes pan here.
  useEffect(() => {
    if (region && shouldRecenterMap(lastRegion.current, region)) {
      mapRef.current?.animateToRegion(region, 400);
      lastRegion.current = region;
    }
  }, [region]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={typography.titleSm}>Interactive map available on iOS and Android</Text>
        <Text style={styles.helper}>Previewing {vendors.length} nearby providers</Text>
      </View>
    );
  }

  if (!region) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={typography.titleSm}>Map unavailable</Text>
      </View>
    );
  }

  return (
    <MapView ref={mapRef} style={[styles.map, { height }]} initialRegion={region}>
      {vendors.map((vendor) => {
        const markerCoords = geocodedCoords ?? (isValidCoordinates(vendor.coordinates) ? vendor.coordinates : null);
        if (!markerCoords) return null;
        return <Marker key={vendor.id} coordinate={markerCoords} title={vendor.name} />;
      })}
      {client ? (
        <Marker identifier="client-location" coordinate={client} title="You are here" pinColor="blue" zIndex={1} />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  placeholder: {
    borderRadius: radius.lg,
    backgroundColor: colors.bgStrong,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  helper: {
    ...typography.bodyMd,
    color: colors.textInverse,
  },
});
