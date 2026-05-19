import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/constants/theme';

export default function ClientLayout() {
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
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" color={color} size={size} />,
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
        name="vehicles"
        options={{
          title: 'Garage',
          tabBarIcon: ({ color, size }) => <Ionicons name="car-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />

      <Tabs.Screen name="shop/[id]"           options={{ href: null }} />
      <Tabs.Screen name="booking-detail/[id]" options={{ href: null }} />
      <Tabs.Screen name="booking/vehicle"     options={{ href: null }} />
      <Tabs.Screen name="booking/service"     options={{ href: null }} />
      <Tabs.Screen name="booking/schedule"    options={{ href: null }} />
      <Tabs.Screen name="booking/review"      options={{ href: null }} />
      <Tabs.Screen name="vehicle/make"        options={{ href: null }} />
      <Tabs.Screen name="vehicle/model"       options={{ href: null }} />
      <Tabs.Screen name="vehicle/year"        options={{ href: null }} />
      <Tabs.Screen name="vehicle/confirm"      options={{ href: null }} />
      <Tabs.Screen name="vehicle/garage-add"  options={{ href: null }} />
      <Tabs.Screen name="vehicle/garage-edit" options={{ href: null }} />
      <Tabs.Screen name="confirmation"        options={{ href: null }} />
    </Tabs>
  );
}
