import { Ionicons } from '@expo/vector-icons';
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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="location"
        options={{
          title: 'Location',
          tabBarIcon: ({ color, size }) => <Ionicons name="location-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="booking-detail/[id]" options={{ href: null }} />
    </Tabs>
  );
}
