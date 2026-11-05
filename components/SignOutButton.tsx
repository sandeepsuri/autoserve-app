import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { signOut } from '@/lib/auth';

const CONFIRM_TITLE = 'Sign out?';
const CONFIRM_MESSAGE = "You'll need to log in again to access your account.";
const FAILURE_TITLE = 'Could not sign out';

// Alert.alert is a no-op in react-native-web, so web needs the browser dialogs.
function confirmSignOut(onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${CONFIRM_TITLE}\n\n${CONFIRM_MESSAGE}`)) onConfirm();
    return;
  }
  Alert.alert(CONFIRM_TITLE, CONFIRM_MESSAGE, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign Out', style: 'destructive', onPress: onConfirm },
  ]);
}

function reportFailure(message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${FAILURE_TITLE}\n\n${message}`);
    return;
  }
  Alert.alert(FAILURE_TITLE, message);
}

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleConfirm = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)');
    } catch (error) {
      setSigningOut(false);
      reportFailure(error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <AppButton
      label={signingOut ? 'Signing out...' : 'Sign Out'}
      variant="secondary"
      disabled={signingOut}
      onPress={() => confirmSignOut(handleConfirm)}
    />
  );
}
