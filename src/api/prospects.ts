import { supabase } from '@/lib/supabase';
import type { Prospect, CallingStatus, ListingType, Furnishing, Availability } from '@/data/prospects';
import type { Database } from '@/types/database';

type DbProspect = Database['public']['Tables']['prospects']['Row'];
type DbInsert   = Database['public']['Tables']['prospects']['Insert'];
type DbUpdate   = Database['public']['Tables']['prospects']['Update'];

// ─── Mappers ─────────────────────────────────────────────────────────────────
function fromDb(r: DbProspect): Prospect {
  return {
    id:             r.id,
    name:           r.name,
    unitNo:         r.unit_no,
    type:           r.type,
    size:           r.size,
    phone:          r.phone,
    agent:          '',
    lastUpdate:     r.updated_at ? new Date(r.updated_at).toLocaleString('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }) : '',
    callingStatus:  r.calling_status as CallingStatus,
    listingType:    r.listing_type as ListingType,
    furnishing:     r.furnishing as Furnishing,
    availability:   r.availability as Availability,
    askingRent:     r.asking_rent,
    askingPrice:    r.asking_price,
    remark:         r.remark,
  };
}

const FIELD_MAP: Partial<Record<keyof Prospect, keyof DbUpdate>> = {
  name:           'name',
  unitNo:         'unit_no',
  type:           'type',
  size:           'size',
  phone:          'phone',
  callingStatus:  'calling_status',
  listingType:    'listing_type',
  furnishing:     'furnishing',
  availability:   'availability',
  askingRent:     'asking_rent',
  askingPrice:    'asking_price',
  remark:         'remark',
};

// ─── Reads ───────────────────────────────────────────────────────────────────
export async function listProspectsByBoard(boardId: string): Promise<Prospect[]> {
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromDb);
}

export async function listAllProspects(): Promise<Record<string, Prospect[]>> {
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .order('board_id', { ascending: true })
    .order('position', { ascending: true });
  if (error) throw error;
  const grouped: Record<string, Prospect[]> = {};
  for (const r of data ?? []) {
    if (!r.board_id) continue;
    (grouped[r.board_id] ??= []).push(fromDb(r));
  }
  return grouped;
}

// ─── Mutations ───────────────────────────────────────────────────────────────
export async function createProspect(boardId: string): Promise<Prospect> {
  const { data: maxRow } = await supabase
    .from('prospects')
    .select('position')
    .eq('board_id', boardId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? -1) + 1;

  const insert: DbInsert = { board_id: boardId, position: nextPosition };
  const { data, error } = await supabase
    .from('prospects')
    .insert(insert)
    .select('*')
    .single();
  if (error) throw error;
  return fromDb(data);
}

export async function updateProspectField<K extends keyof Prospect>(
  id: string,
  field: K,
  value: Prospect[K],
): Promise<void> {
  const dbField = FIELD_MAP[field];
  if (!dbField) throw new Error(`Field ${String(field)} is not mappable`);
  const { error } = await supabase
    .from('prospects')
    .update({ [dbField]: value } as DbUpdate)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteProspect(id: string): Promise<void> {
  const { error } = await supabase.from('prospects').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteProspects(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('prospects').delete().in('id', ids);
  if (error) throw error;
}

export async function duplicateProspect(id: string): Promise<Prospect> {
  const { data: src, error: e1 } = await supabase
    .from('prospects')
    .select('*')
    .eq('id', id)
    .single();
  if (e1) throw e1;
  const insert: DbInsert = {
    board_id:       src.board_id,
    name:           src.name,
    unit_no:        src.unit_no,
    type:           src.type,
    size:           src.size,
    phone:          src.phone,
    calling_status: src.calling_status,
    listing_type:   src.listing_type,
    furnishing:     src.furnishing,
    availability:   src.availability,
    asking_rent:    src.asking_rent,
    asking_price:   src.asking_price,
    remark:         src.remark,
    position:       src.position + 1,
  };
  const { data, error } = await supabase.from('prospects').insert(insert).select('*').single();
  if (error) throw error;
  return fromDb(data);
}

export async function importProspects(boardId: string, rows: Omit<Prospect, 'id'>[], mode: 'replace' | 'append'): Promise<void> {
  if (mode === 'replace') {
    const { error: delErr } = await supabase.from('prospects').delete().eq('board_id', boardId);
    if (delErr) throw delErr;
  }
  const { data: maxRow } = await supabase
    .from('prospects')
    .select('position')
    .eq('board_id', boardId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const startPos = (maxRow?.position ?? -1) + 1;
  const inserts: DbInsert[] = rows.map((r, i) => ({
    board_id:       boardId,
    name:           r.name,
    unit_no:        r.unitNo,
    type:           r.type,
    size:           r.size,
    phone:          r.phone,
    calling_status: r.callingStatus,
    listing_type:   r.listingType,
    furnishing:     r.furnishing,
    availability:   r.availability,
    asking_rent:    r.askingRent,
    asking_price:   r.askingPrice,
    remark:         r.remark,
    position:       startPos + i,
  }));
  if (inserts.length === 0) return;
  const { error } = await supabase.from('prospects').insert(inserts);
  if (error) throw error;
}
