import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';

import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { subscribeBookingChanges } from '@/lib/bookings-realtime';
import { queryClient } from '@/lib/query-client';
import { initAuthListener, useAuthStore } from '@/store/useAuthStore';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RouteGate() {
  const segments = useSegments();
  const { session, profile, loading, guestMode } = useAuthStore();

  if (loading) return null;

  const rootSegment = segments[0] ?? '(public)';
  const inAuth = rootSegment === '(auth)';
  const inVendor = rootSegment === '(vendor)';
  const inClient = rootSegment === '(client)';
  const inPublic = rootSegment === '(public)';
  const routeName = segments[1];

  if (inPublic && routeName === 'welcome' && session && profile?.role === 'client') {
    return <Redirect href="/(client)" />;
  }

  if (inPublic && routeName === 'welcome' && session && profile?.role === 'vendor') {
    return <Redirect href={profile.businessType ? '/(vendor)' : '/(auth)/vendor-onboarding'} />;
  }

  if (inAuth && session && profile?.role === 'vendor') {
    const onboardingDone = Boolean(profile.businessType);
    const inOnboarding = segments[1] === 'vendor-onboarding' || segments[1] === 'vendor-setup';
    if (!onboardingDone && !inOnboarding) {
      return <Redirect href="/(auth)/vendor-onboarding" />;
    }
    if (onboardingDone && !inOnboarding) {
      return <Redirect href="/(vendor)" />;
    }
  }

  if (inAuth && session && profile?.role === 'client') {
    return <Redirect href="/(client)" />;
  }

  if (session && !profile?.role && !inAuth) {
    return <Redirect href="/(auth)/role" />;
  }

  if (inAuth && segments[1] === 'role' && !session) {
    return <Redirect href="/(auth)" />;
  }

  if (inVendor && session && profile?.role === 'vendor' && !profile.businessType) {
    return <Redirect href="/(auth)/vendor-onboarding" />;
  }

  if (inVendor && (!session || profile?.role !== 'vendor')) {
    return <Redirect href="/(auth)" />;
  }

  if (inClient && session && profile?.role === 'vendor') {
    return <Redirect href="/(vendor)" />;
  }

  if (inClient && !session && !guestMode) {
    return <Redirect href="/(auth)" />;
  }

  if (!inPublic && !inAuth && !inClient && !inVendor) {
    return <Redirect href="/(public)/welcome" />;
  }

  return null;
}

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
      <QueryClientProvider client={queryClient}>
        <RouteGate />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(public)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(client)" />
          <Stack.Screen name="(vendor)" />
        </Stack>
        <StatusBar style="dark" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
