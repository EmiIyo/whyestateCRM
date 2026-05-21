import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type DbAgentPreset = Tables<'agent_presets'>;

export interface AgentPreset {
  id: string;
  name: string;
  color: string;
  position: number;
  createdBy: string | null;
  createdAt: string;
}

const fromDb = (r: DbAgentPreset): AgentPreset => ({
  id: r.id, name: r.name, color: r.color, position: r.position,
  createdBy: r.created_by, createdAt: r.created_at,
});

export async function listAgentPresets(): Promise<AgentPreset[]> {
  const { data, error } = await supabase
    .from('agent_presets')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromDb);
}

export async function createAgentPreset(input: { name: string; color: string; id?: string }): Promise<AgentPreset> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: maxRow } = await supabase
    .from('agent_presets').select('position').order('position', { ascending: false }).limit(1).maybeSingle();
  const nextPosition = (maxRow?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from('agent_presets')
    .insert({
      id: input.id,
      name: input.name.trim(),
      color: input.color,
      position: nextPosition,
      created_by: user?.id ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return fromDb(data);
}

export async function updateAgentPreset(id: string, patch: { name?: string; color?: string }): Promise<void> {
  const { error } = await supabase
    .from('agent_presets')
    .update({ name: patch.name?.trim(), color: patch.color })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteAgentPreset(id: string): Promise<void> {
  const { error } = await supabase.from('agent_presets').delete().eq('id', id);
  if (error) throw error;
}
