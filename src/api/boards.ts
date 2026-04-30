import { supabase } from '@/lib/supabase';

export interface Board {
  id: string;
  name: string;
  location: string;
  color: string;
  position: number;
}

export async function listBoards(): Promise<Board[]> {
  const { data, error } = await supabase
    .from('boards')
    .select('id, name, location, color, position')
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createBoard(input: { name: string; location: string; color: string }): Promise<Board> {
  const { data: maxRow } = await supabase
    .from('boards')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from('boards')
    .insert({ name: input.name, location: input.location, color: input.color, position: nextPosition })
    .select('id, name, location, color, position')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBoard(id: string): Promise<void> {
  const { error } = await supabase.from('boards').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderBoards(orderedIds: string[]): Promise<void> {
  // Update position for each board to match its index
  const updates = orderedIds.map((id, position) =>
    supabase.from('boards').update({ position }).eq('id', id)
  );
  const results = await Promise.all(updates);
  for (const r of results) {
    if (r.error) throw r.error;
  }
}
