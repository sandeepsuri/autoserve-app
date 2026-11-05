import { Stack } from 'expo-router';

export default function PublicLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* An iOS swipe would pop this screen without the leave-booking prompt. */}
      <Stack.Screen name="guest-booking/[vendorId]/details" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
