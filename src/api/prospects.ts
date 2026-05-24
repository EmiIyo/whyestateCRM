import { supabase } from '@/lib/supabase';
import type { Prospect, CallingStatus, ListingType, Furnishing, Availability, ValidStatus } from '@/data/prospects';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

type DbProspect = Tables<'prospects'>;
type DbInsert   = TablesInsert<'prospects'>;
type DbUpdate   = TablesUpdate<'prospects'>;

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
    // last_edited_at is only stamped by per-field UPDATE calls (see
    // updateProspectField). Imported / freshly-created rows have NULL here,
    // which surfaces as an empty "Last Update" cell — by design.
    lastUpdate:     r.last_edited_at ? new Date(r.last_edited_at).toLocaleString('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }) : '',
    callingStatus:  r.calling_status as CallingStatus,
    valid:          (r.valid ?? '') as ValidStatus,
    listingType:    r.listing_type as ListingType,
    furnishing:     r.furnishing as Furnishing,
    availability:   r.availability as Availability,
    unitStatus:     r.unit_status ?? '',
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
  valid:          'valid',
  listingType:    'listing_type',
  furnishing:     'furnishing',
  availability:   'availability',
  unitStatus:     'unit_status',
  askingRent:     'asking_rent',
  askingPrice:    'asking_price',
  remark:         'remark',
};

// ─── Reads ───────────────────────────────────────────────────────────────────
// PostgREST caps single-request reads at ~1000 rows by default. We page in
// 1000-row chunks until a short chunk arrives — works regardless of how the
// instance's `max-rows` is configured.
const PAGE_SIZE = 1000;

export async function listProspectsByBoard(boardId: string): Promise<Prospect[]> {
  const out: DbProspect[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .eq('board_id', boardId)
      .order('position', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return out.map(fromDb);
}

// Paginated single-board reader. Use this for large boards (>200 rows).
export async function listProspectsPage(boardId: string, opts: { from?: number; to?: number } = {}): Promise<Prospect[]> {
  const from = opts.from ?? 0;
  const to = opts.to ?? from + 99;
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true })
    .range(from, to);
  if (error) throw error;
  return (data ?? []).map(fromDb);
}

export async function listAllProspects(): Promise<Record<string, Prospect[]>> {
  // Auto-page until exhausted — workspaces over 1000 prospects were silently
  // truncated by PostgREST's default page cap before this.
  const grouped: Record<string, Prospect[]> = {};
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .order('board_id', { ascending: true })
      .order('position', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (!r.board_id) continue;
      (grouped[r.board_id] ??= []).push(fromDb(r));
    }
    if (data.length < PAGE_SIZE) break;
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
  // Stamp last_edited_at so the "Last Update" column reflects this edit.
  // (Bulk imports / row creation skip this and leave the column blank.)
  const { error } = await supabase
    .from('prospects')
    .update({ [dbField]: value, last_edited_at: new Date().toISOString() } as DbUpdate)
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
    valid:          src.valid,
    listing_type:   src.listing_type,
    furnishing:     src.furnishing,
    availability:   src.availability,
    unit_status:    src.unit_status,
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
    valid:          r.valid ?? '',
    listing_type:   r.listingType,
    furnishing:     r.furnishing,
    availability:   r.availability,
    unit_status:    r.unitStatus ?? '',
    asking_rent:    r.askingRent,
    asking_price:   r.askingPrice,
    remark:         r.remark,
    position:       startPos + i,
  }));
  if (inserts.length === 0) return;
  // Chunked insert to avoid request-size issues on bulk pastes (1k+ rows).
  const CHUNK = 500;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const slice = inserts.slice(i, i + CHUNK);
    const { error } = await supabase.from('prospects').insert(slice);
    if (error) throw error;
  }
}
