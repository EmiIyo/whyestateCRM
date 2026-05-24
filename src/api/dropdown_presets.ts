// Workspace-wide preset list for every customisable dropdown column in the
// Prospect grid. One row per option per field, with a chosen palette colour.
//
// Why a single table instead of per-field tables: every dropdown shares the
// same CRUD shape (list / add / remove), the same realtime broadcast channel,
// and the same `dropdowns.manage` permission gate. Splitting them five ways
// would just duplicate code without any RLS or query-shape benefit.

import { supabase } from '@/lib/supabase';

// Field identifiers map 1:1 to the prospect column they decorate.
export type DropdownField =
  | 'calling_status'
  | 'listing_type'
  | 'furnishing'      // labelled "Condition" in the UI
  | 'availability'
  | 'unit_status';

// Palette key — mirrors AGENT_COLOR_PALETTE in ProspectHub.tsx so chips look
// consistent across Agent presets and customisable dropdown options.
export type DropdownColor =
  | 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'pink' | 'orange' | 'teal' | 'gray';

export interface DropdownPreset {
  id:        string;
  field:     DropdownField;
  value:     string;
  color:     DropdownColor;
  position:  number;
  createdBy: string | null;
}

export async function listDropdownPresets(): Promise<DropdownPreset[]> {
  const { data, error } = await supabase
    .from('dropdown_presets')
    .select('*')
    .order('field', { ascending: true })
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    field: r.field as DropdownField,
    value: r.value,
    color: r.color as DropdownColor,
    position: r.position,
    createdBy: r.created_by,
  }));
}

export async function addDropdownPreset(
  field: DropdownField,
  value: string,
  color: DropdownColor,
): Promise<DropdownPreset> {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Value cannot be empty.');

  // Place new entry at the bottom of its field's list.
  const { data: existing } = await supabase
    .from('dropdown_presets')
    .select('position')
    .eq('field', field)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (existing?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from('dropdown_presets')
    .insert({ field, value: trimmed, color, position: nextPos })
    .select('*')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    field: data.field as DropdownField,
    value: data.value,
    color: data.color as DropdownColor,
    position: data.position,
    createdBy: data.created_by,
  };
}

export async function removeDropdownPreset(id: string): Promise<void> {
  const { error } = await supabase.from('dropdown_presets').delete().eq('id', id);
  if (error) throw error;
}

export async function updateDropdownPresetColor(id: string, color: DropdownColor): Promise<void> {
  const { error } = await supabase.from('dropdown_presets').update({ color }).eq('id', id);
  if (error) throw error;
}
