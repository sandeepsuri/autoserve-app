import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

export function AutoServeLogo() {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="AutoServe" style={styles.lockup}>
      <Image source={require('@/assets/brand/book-and-go-mark.png')} style={styles.mark} contentFit="contain" />
      <Text style={styles.wordmark}>
        Auto<Text style={styles.accent}>Serve</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  wordmark: {
    ...typography.displayMd,
    color: colors.surfaceBrand,
    flexShrink: 1,
  },
  accent: {
    color: colors.surfaceAccent,
  },
});
