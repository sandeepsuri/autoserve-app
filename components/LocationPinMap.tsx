import { StyleSheet } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { colors, radius } from '@/constants/theme';

interface Props {
  coords: { latitude: number; longitude: number };
  radiusMiles?: number;
  onDragEnd: (coords: { latitude: number; longitude: number }) => void;
}

export function LocationPinMap({ coords, radiusMiles, onDragEnd }: Props) {
  const region = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  };

  return (
    <MapView style={styles.map} region={region}>
      <Marker
        coordinate={coords}
        draggable
        onDragEnd={(e) => onDragEnd(e.nativeEvent.coordinate)}
      />
      {radiusMiles ? (
        <Circle
          center={coords}
          radius={radiusMiles * 1609.34}
          strokeColor={colors.surfaceBrand}
          fillColor={colors.surfaceBrand + '20'}
          strokeWidth={1.5}
        />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
