import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import { colors } from '@/constants/theme';
import { loadVendorCapability } from '@/lib/vendor-capability';
import { useAuthStore } from '@/store/useAuthStore';

export default function VendorLayout() {
  const session = useAuthStore((s) => s.session);
  const vendorCapability = useAuthStore((s) => s.vendorCapability);
  const setVendorCapability = useAuthStore((s) => s.setVendorCapability);

  useEffect(() => {
    // Safety net: the group guard enforces the capability gate at the layout
    // boundary, so this only refreshes a stale/missing capability right
    // after approval rather than refetching on every mount (profiles.role
    // never becomes 'vendor' under Option B).
    //
    // This depends only on the primitive `hasActiveVendor` boolean (not the
    // whole vendorCapability object), and useAuthStore.setVendorCapability
    // is itself a no-op when the next value is equal to the current one —
    // both guard against this effect re-firing/re-setting on every render
    // from object-identity churn alone.
    if (session && !vendorCapability?.hasActiveVendor) {
      loadVendorCapability().then((fresh) => {
        if (fresh.hasActiveVendor) setVendorCapability(fresh);
      });
    }
  }, [session, vendorCapability?.hasActiveVendor, setVendorCapability]);

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
