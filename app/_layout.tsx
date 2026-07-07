import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';

import { QueryClientProvider } from '@tanstack/react-query';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useFonts, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { subscribeBookingChanges } from '@/lib/bookings-realtime';
import { queryClient } from '@/lib/query-client';
import { initAuthListener } from '@/store/useAuthStore';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    initAuthListener();
  }, []);

  useEffect(() => {
    return subscribeBookingChanges(queryClient);
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={stripePublishableKey} merchantIdentifier="merchant.com.vibez.autoserve">
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(public)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(client)" />
            <Stack.Screen name="(vendor)" />
          </Stack>
          <StatusBar style="dark" />
        </QueryClientProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
