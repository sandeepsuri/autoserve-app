import { Redirect } from 'expo-router';

export default function VendorSetupRedirect() {
  return <Redirect href="/(auth)/vendor-onboarding" />;
}
