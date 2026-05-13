import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, typography } from '@/constants/theme';

interface Props {
  coords: { latitude: number; longitude: number };
  radiusMiles?: number;
  onDragEnd: (coords: { latitude: number; longitude: number }) => void;
}

export function LocationPinMap({ coords }: Props) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.title}>Map confirmation available on iOS and Android</Text>
      <Text style={styles.sub}>
        Pin: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.bgStrong,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    ...typography.titleSm,
    color: colors.textInverse,
    textAlign: 'center',
  },
  sub: {
    ...typography.bodyMd,
    color: colors.textInverse,
    textAlign: 'center',
    opacity: 0.7,
  },
});
