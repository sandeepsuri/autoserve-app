import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { getPostAuthDestination } from '@/lib/post-auth-destination';
import { useAuthStore } from '@/store/useAuthStore';

// Guests must never be held back by a slow session check.
const STARTUP_TIMEOUT_MS = 3000;

export default function Index() {
  const loading = useAuthStore((state) => state.loading);
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const vendorCapability = useAuthStore((state) => state.vendorCapability);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), STARTUP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  // `loading` clears before the capability arrives, and routing without it
  // would send a signed-in vendor to the client tabs.
  if (session && vendorCapability) {
    const { path } = getPostAuthDestination({ profile, vendorCapability });
    return <Redirect href={path as never} />;
  }

  if ((loading || session) && !timedOut) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.surfaceAccent} />
      </View>
    );
  }

  return <Redirect href="/(public)/welcome" />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgBase },
});
