import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/useAuthStore';

import { getVendorForOwner } from './vendor-admin';

/** Share the published shop identity across vendor screens, scoped to this session. */
export function useVendorIdentity() {
  const ownerId = useAuthStore((state) => state.session?.userId);
  const query = useQuery({
    queryKey: ['vendor-self', ownerId],
    queryFn: async () => {
      if (!ownerId || useAuthStore.getState().session?.userId !== ownerId) return null;
      const vendor = await getVendorForOwner();
      return vendor?.ownerId === ownerId && useAuthStore.getState().session?.userId === ownerId
        ? vendor : null;
    },
    enabled: Boolean(ownerId),
  });

  return { ...query, data: ownerId && query.data?.ownerId === ownerId ? query.data : null };
}
