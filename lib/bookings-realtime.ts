import { QueryClient } from '@tanstack/react-query';

import { isSupabaseConfigured, supabase } from './supabase';

export function subscribeBookingChanges(queryClient: QueryClient): () => void {
  if (!isSupabaseConfigured || !supabase) return () => {};

  const channel = supabase
    .channel('public:bookings')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bookings' },
      (payload) => {
        const id = (payload.new as Record<string, unknown>)?.id
          ?? (payload.old as Record<string, unknown>)?.id;
        queryClient.invalidateQueries({ queryKey: ['client-bookings'] });
        queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
        if (id) queryClient.invalidateQueries({ queryKey: ['booking-detail', id] });
      },
    )
    .subscribe();

  return () => { supabase!.removeChannel(channel); };
}
