import { supabase } from '@/lib/supabase';
import type { Tables, Json } from '@/types/database';

export type DbCustomField = Tables<'custom_fields'>;
export type DbCustomValue = Tables<'custom_values'>;

export interface CustomField {
  id: string;
  boardId: string | null;
  key: string;
  label: string;
  type: string;
  options: string[];
  position: number;
}

const fromDb = (r: DbCustomField): CustomField => ({
  id: r.id, boardId: r.board_id, key: r.key, label: r.label, type: r.type,
  options: Array.isArray(r.options) ? (r.options as Json[]).map(String) : [],
  position: r.position,
});

export async function listCustomFields(boardId?: string): Promise<CustomField[]> {
  let q = supabase.from('custom_fields').select('*').order('position', { ascending: true });
  if (boardId) q = q.eq('board_id', boardId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(fromDb);
}

export async function createCustomField(input: {
  boardId: string | null; key: string; label: string; type?: string; options?: string[];
}): Promise<CustomField> {
  const { data: maxRow } = await supabase
    .from('custom_fields').select('position').order('position', { ascending: false }).limit(1).maybeSingle();
  const nextPosition = (maxRow?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from('custom_fields')
    .insert({
      board_id: input.boardId,
      key: input.key,
      label: input.label,
      type: input.type ?? 'text',
      options: (input.options ?? []) as unknown as Json,
      position: nextPosition,
    })
    .select('*')
    .single();
  if (error) throw error;
  return fromDb(data);
}

export async function renameCustomField(id: string, label: string): Promise<void> {
  const { error } = await supabase.from('custom_fields').update({ label }).eq('id', id);
  if (error) throw error;
}

export async function deleteCustomField(id: string): Promise<void> {
  const { error } = await supabase.from('custom_fields').delete().eq('id', id);
  if (error) throw error;
}

// ─── Values (per prospect) ────────────────────────────────────────────────
export async function listCustomValuesForProspect(prospectId: string): Promise<DbCustomValue[]> {
  const { data, error } = await supabase
    .from('custom_values')
    .select('*')
    .eq('prospect_id', prospectId);
  if (error) throw error;
  return data ?? [];
}

export async function setCustomValue(prospectId: string, fieldId: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('custom_values')
    .upsert({ prospect_id: prospectId, field_id: fieldId, value }, { onConflict: 'prospect_id,field_id' });
  if (error) throw error;
  // Mirror system-field edits: stamp last_edited_at on the parent row so the
  // "Last Update" column reflects custom-cell edits too.
  await supabase
    .from('prospects')
    .update({ last_edited_at: new Date().toISOString() })
    .eq('id', prospectId);
}
