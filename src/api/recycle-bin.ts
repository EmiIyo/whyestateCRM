import { supabase } from '@/lib/supabase';
import type { Tables, Json, Enums } from '@/types/database';

export type RecycleKind = Enums<'recycle_kind'>;
export type DbRecycleRow = Tables<'recycle_bin'>;

export interface RecycledItem {
  id: string;
  kind: RecycleKind;
  payload: unknown;
  deletedAt: string;
  deletedBy: string | null;
  expiresAt: string;
}

const fromDb = (r: DbRecycleRow): RecycledItem => ({
  id: r.id, kind: r.kind, payload: r.payload,
  deletedAt: r.deleted_at, deletedBy: r.deleted_by, expiresAt: r.expires_at,
});

export async function listRecycleBin(): Promise<RecycledItem[]> {
  const { data, error } = await supabase
    .from('recycle_bin')
    .select('*')
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDb);
}

export async function pushToRecycleBin(kind: RecycleKind, payload: unknown): Promise<RecycledItem> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('recycle_bin')
    .insert({ kind, payload: payload as Json, deleted_by: user?.id ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return fromDb(data);
}

export async function purgeRecycleItem(id: string): Promise<void> {
  const { error } = await supabase.from('recycle_bin').delete().eq('id', id);
  if (error) throw error;
}

export async function purgeAllRecycleItems(): Promise<void> {
  // RLS will limit deletion to items the caller is allowed to purge.
  const { error } = await supabase
    .from('recycle_bin')
    .delete()
    .gte('deleted_at', '1970-01-01');
  if (error) throw error;
}
