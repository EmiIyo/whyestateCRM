import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type DbFolder = Tables<'folders'>;

export interface Folder {
  id: string;
  name: string;
  position: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

function fromDb(r: DbFolder): Folder {
  return {
    id: r.id,
    name: r.name,
    position: r.position,
    ownerId: r.owner_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listFolders(): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromDb);
}

export async function createFolder(name: string): Promise<Folder> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: maxRow } = await supabase
    .from('folders')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from('folders')
    .insert({ name: name.trim(), position: nextPosition, owner_id: user.id })
    .select('*')
    .single();
  if (error) throw error;
  return fromDb(data);
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('folders').update({ name: name.trim() }).eq('id', id);
  if (error) throw error;
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase.from('folders').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderFolders(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('folders').update({ position: i }).eq('id', orderedIds[i]);
    if (error) throw error;
  }
}
