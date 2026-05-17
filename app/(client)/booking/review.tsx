import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { Screen } from '@/components/Screen';

export default function LegacyBookingReviewRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(client)/booking/schedule');
  }, [router]);

  return (
    <Screen>
      <AppHeader title="Redirecting" subtitle="We’ve moved confirmation into the booking wizard so you can finish in two steps." />
    </Screen>
  );
}
