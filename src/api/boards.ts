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
  // Sequential to avoid races; small list (boards count) so cost is negligible.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('boards').update({ position: i }).eq('id', orderedIds[i]);
    if (error) throw error;
  }
}
