import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import { colors } from '@/constants/theme';
import { loadProfileForUser } from '@/lib/auth';
import { useAuthStore } from '@/store/useAuthStore';

export default function VendorLayout() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const setSessionData = useAuthStore((s) => s.setSessionData);

  useEffect(() => {
    if (session && profile?.role !== 'vendor') {
      loadProfileForUser(session.userId, session.email).then((fresh) => {
        if (fresh) setSessionData(session, fresh);
      });
    }
  }, [session, profile?.role, setSessionData]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.surfaceAccent,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="services" options={{ title: 'Services' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="location" options={{ title: 'Location' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="booking-detail/[id]" options={{ href: null }} />
    </Tabs>
  );
}
