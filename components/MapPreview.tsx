import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';

import { VendorSummary } from '@/types/domain';
import { colors, radius, typography } from '@/constants/theme';

interface Props {
  vendors: VendorSummary[];
  region?: Region;
  height?: number;
}

export function MapPreview({ vendors, region, height = 240 }: Props) {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={typography.titleSm}>Interactive map available on iOS and Android</Text>
        <Text style={styles.helper}>Previewing {vendors.length} nearby providers</Text>
      </View>
    );
  }

  return (
    <MapView
      style={[styles.map, { height }]}
      initialRegion={
        region ?? {
          latitude: vendors[0]?.coordinates.latitude ?? 34.0522,
          longitude: vendors[0]?.coordinates.longitude ?? -118.2437,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }
      }
    >
      {vendors.map((vendor) => (
        <Marker
          key={vendor.id}
          coordinate={vendor.coordinates}
          title={vendor.name}
          description={`From $${Math.min(...vendors.map(() => 85))}`}
        />
      ))}
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
