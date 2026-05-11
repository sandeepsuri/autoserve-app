import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { Screen } from '@/components/Screen';
import { colors, typography } from '@/constants/theme';

export default function ConfirmationScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  return (
    <Screen contentStyle={styles.container}>
      <Text style={styles.check}>✓</Text>
      <Text style={typography.titleLg}>Booking Confirmed!</Text>
      <Text style={styles.subtitle}>Your appointment request has been sent. Booking reference: {bookingId}</Text>

      <BookingSummaryCard
        title="Next steps"
        rows={[
          { label: 'Calendar', value: 'Add appointment to device calendar' },
          { label: 'Contact vendor', value: 'Message and phone actions coming next' },
        ]}
      />

      <AppButton label="Add to Calendar" variant="accent" />
      <AppButton label="Back to Discovery" variant="secondary" onPress={() => router.replace('/(public)/discover')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  check: {
    fontSize: 54,
    color: colors.surfaceAccent,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
