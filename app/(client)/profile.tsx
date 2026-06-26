import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { Screen } from '@/components/Screen';
import { typography } from '@/constants/theme';
import { signOut } from '@/lib/auth';
import { useAuthStore } from '@/store/useAuthStore';

export default function ClientProfileScreen() {
  const router = useRouter();
  const { profile, session, guestMode } = useAuthStore();
  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)');
  };

  return (
    <Screen>
      <Text style={typography.titleLg}>Profile</Text>
      <BookingSummaryCard
        title="Account"
        rows={[
          { label: 'Name', value: profile?.fullName ?? 'Guest user' },
          { label: 'Email', value: session?.email ?? (guestMode ? 'Guest browsing enabled' : 'No active session') },
          { label: 'Role', value: profile?.role ?? 'guest' },
        ]}
      />

      {session ? <AppButton label="Sign Out" variant="secondary" onPress={handleSignOut} /> : null}
    </Screen>
  );
}
