import { DiscoverScreen } from '@/components/DiscoverScreen';
import { useExitAppOnBack } from '@/lib/booking-navigation';

export default function ClientDiscover() {
  useExitAppOnBack();
  return <DiscoverScreen shopRoute="/(client)/shop" />;
}
