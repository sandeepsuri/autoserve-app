import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';

import { colors } from '@/constants/theme';
import { loadVendorCapability } from '@/lib/vendor-capability';
import { useAuthStore } from '@/store/useAuthStore';

export default function VendorLayout() {
  const session = useAuthStore((s) => s.session);
  const vendorCapability = useAuthStore((s) => s.vendorCapability);
  const setVendorCapability = useAuthStore((s) => s.setVendorCapability);
  // Tracks whether capability has been confirmed at least once this mount, so
  // the guard below doesn't bounce a real vendor before the async check below
  // resolves. Starts true when we already know they have an active vendor.
  const [capabilityChecked, setCapabilityChecked] = useState(
    () => vendorCapability?.hasActiveVendor ?? false,
  );

  useEffect(() => {
    // Vendor access is gated by post-auth routing (lib/post-auth-destination)
    // + backend RLS. This effect refreshes a stale/missing capability right
    // after approval, and the guard below turns it into an actual route guard
    // so a non-vendor who deep-links into /(vendor)/* is redirected out
    // instead of rendering empty vendor screens (defense-in-depth over RLS).
    if (session && !vendorCapability?.hasActiveVendor) {
      loadVendorCapability().then((fresh) => {
        if (fresh.hasActiveVendor) setVendorCapability(fresh);
        setCapabilityChecked(true);
      });
    } else {
      setCapabilityChecked(true);
    }
  }, [session, vendorCapability?.hasActiveVendor, setVendorCapability]);

  if (!session) {
    return <Redirect href="/(auth)" />;
  }
  // Wait for the async capability check before deciding, to avoid a flash-redirect.
  if (capabilityChecked && !vendorCapability?.hasActiveVendor) {
    return <Redirect href="/(client)" />;
  }

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
