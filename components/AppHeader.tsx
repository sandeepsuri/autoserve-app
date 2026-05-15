import { Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

interface Props {
  title?: string;
  subtitle?: string;
  fallbackHref?: Href;
  showBack?: boolean;
  onBack?: () => void;
}

export function AppHeader({ title, subtitle, fallbackHref, showBack = true, onBack }: Props) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    if (router.canGoBack()) { router.back(); return; }
    if (fallbackHref) { router.replace(fallbackHref); }
  };

  return (
    <View style={styles.container}>
      {showBack ? (
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      ) : null}
      {title ? <Text style={typography.titleLg}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  backLabel: {
    ...typography.labelMd,
    color: colors.surfaceBrand,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
});
