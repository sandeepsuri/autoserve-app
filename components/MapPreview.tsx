import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { VendorSummary } from '@/types/domain';
import { colors, radius, typography } from '@/constants/theme';

interface Props {
  vendors: VendorSummary[];
  height?: number;
  geocodedCoords?: { latitude: number; longitude: number } | null;
}

function isValidCoord(n: number | null | undefined): boolean {
  return typeof n === 'number' && isFinite(n) && n !== 0;
}

export function MapPreview({ vendors, height = 240, geocodedCoords }: Props) {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={typography.titleSm}>Interactive map available on iOS and Android</Text>
        <Text style={styles.helper}>Previewing {vendors.length} nearby providers</Text>
      </View>
    );
  }

  const centerCoords =
    geocodedCoords ??
    (isValidCoord(vendors[0]?.coordinates?.latitude) && isValidCoord(vendors[0]?.coordinates?.longitude)
      ? { latitude: vendors[0].coordinates.latitude, longitude: vendors[0].coordinates.longitude }
      : null);

  if (!centerCoords) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={typography.titleSm}>Map unavailable</Text>
      </View>
    );
  }

  return (
    <MapView
      style={[styles.map, { height }]}
      initialRegion={{
        latitude: centerCoords.latitude,
        longitude: centerCoords.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }}
    >
      {vendors.map((vendor) => {
        const markerCoords = geocodedCoords ?? (
          isValidCoord(vendor.coordinates?.latitude) && isValidCoord(vendor.coordinates?.longitude)
            ? vendor.coordinates
            : null
        );
        if (!markerCoords) return null;
        return (
          <Marker
            key={vendor.id}
            coordinate={markerCoords}
            title={vendor.name}
          />
        );
      })}
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
