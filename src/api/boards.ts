import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/types/database';

export type DbBoard = Tables<'boards'>;
export type DbBoardInsert = TablesInsert<'boards'>;

export interface Board {
  id: string;
  name: string;
  location: string;
  color: string;
  position: number;
  ownerId: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

function fromDb(r: DbBoard): Board {
  return {
    id: r.id,
    name: r.name,
    location: r.location,
    color: r.color,
    position: r.position,
    ownerId: r.owner_id,
    folderId: r.folder_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listBoards(): Promise<Board[]> {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromDb);
}

export async function createBoard(input: { name: string; location: string; color: string; folderId?: string | null }): Promise<Board> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: maxRow } = await supabase
    .from('boards')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? -1) + 1;

  const insert: DbBoardInsert = {
    name: input.name,
    location: input.location,
    color: input.color,
    position: nextPosition,
    owner_id: user.id,
    folder_id: input.folderId ?? null,
  };

  const { data, error } = await supabase
    .from('boards')
    .insert(insert)
    .select('*')
    .single();
  if (error) throw error;
  return fromDb(data);
}

export async function updateBoard(id: string, patch: { name?: string; location?: string; color?: string; folderId?: string | null }): Promise<void> {
  const { error } = await supabase.from('boards').update({
    name:      patch.name,
    location:  patch.location,
    color:     patch.color,
    folder_id: patch.folderId,
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteBoard(id: string): Promise<void> {
  const { error } = await supabase.from('boards').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderBoards(orderedIds: string[]): Promise<void> {
  // Single-transaction reorder — the `reorder_boards` RPC walks the id array
  // server-side, so partial-fail can't leave positions out of sync.
  // Cast to bypass missing generated-types entry; the RPC exists at runtime.
  const { error } = await (supabase.rpc as unknown as (
    fn: string, args: { p_ids: string[] }
  ) => Promise<{ error: { message: string } | null }>)(
    'reorder_boards',
    { p_ids: orderedIds },
  );
  if (error) throw new Error(error.message);
}
