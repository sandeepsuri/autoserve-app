import { Platform, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { describeLocationRecovery } from '@/lib/client-location';
import { useClientLocationStore } from '@/store/useClientLocationStore';

import { AppButton } from './AppButton';

export function LocationStatusBanner() {
  const { status, canAskAgain, coordinates, isLoading, enableDialogFailed, recover } = useClientLocationStore();

  if (status === 'checking') {
    return (
      <View style={styles.banner}>
        <Text style={styles.body}>Finding your location…</Text>
      </View>
    );
  }

  const recovery = describeLocationRecovery({
    status,
    canAskAgain,
    hasLastPosition: coordinates !== null,
    enableDialogFailed,
    platform: Platform.OS,
  });
  if (!recovery) return null;

  return (
    <View style={styles.banner}>
      <Text style={typography.titleSm}>{recovery.title}</Text>
      <Text style={styles.body}>{recovery.body}</Text>
      <AppButton
        label={isLoading ? 'Checking…' : recovery.actionLabel}
        variant="secondary"
        disabled={isLoading}
        onPress={() => void recover(recovery.action)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  body: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
});
