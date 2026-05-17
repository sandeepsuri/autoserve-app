import { isSupabaseConfigured, supabase } from './supabase';

export async function fetchProfileNamesByIds(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length || !isSupabaseConfigured || !supabase) return {};
  const unique = Array.from(new Set(ids));
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', unique);
  return Object.fromEntries(
    (data ?? []).map((r: { id: string; full_name: string | null }) => [r.id, r.full_name ?? '']),
  );
}
