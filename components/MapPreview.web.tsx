import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, typography } from '@/constants/theme';
import { VendorSummary } from '@/types/domain';

interface Props {
  vendors: VendorSummary[];
  height?: number;
}

export function MapPreview({ vendors, height = 240 }: Props) {
  return (
    <View style={[styles.placeholder, { height }]}>
      <Text style={typography.titleSm}>Interactive map available on iOS and Android</Text>
      <Text style={styles.helper}>Previewing {vendors.length} nearby providers</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
