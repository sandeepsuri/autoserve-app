import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { BookingSummaryCard } from '@/components/BookingSummaryCard';
import { Screen } from '@/components/Screen';
import { typography } from '@/constants/theme';
import { signOut } from '@/lib/auth';
import { useAuthStore } from '@/store/useAuthStore';

export default function VendorProfileScreen() {
  const router = useRouter();
  const { profile, session } = useAuthStore();
  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)');
  };

  return (
    <Screen>
      <Text style={typography.titleLg}>Vendor profile</Text>
      <BookingSummaryCard
        title="Business profile"
        rows={[
          { label: 'Contact', value: profile?.fullName ?? 'Vendor' },
          { label: 'Email', value: session?.email ?? 'No email' },
          { label: 'Account type', value: profile?.businessType ?? 'shop' },
        ]}
      />

      <AppButton label="Sign Out" variant="secondary" onPress={handleSignOut} />
    </Screen>
  );
}
