import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate, Enums } from '@/types/database';

// ─── Re-exported types (kept compatible with the previous lib/clients.ts) ──
export type ClientType   = Enums<'client_type'>;
export type ClientStage  = Enums<'client_stage'>;
export type ClientSource = Enums<'client_source'>;
export type TaskPriority = Enums<'task_priority'>;

export type DbClient     = Tables<'clients'>;
export type DbClientTask = Tables<'client_tasks'>;

export interface ClientTask {
  id: string;
  title: string;
  done: boolean;
  dueDate: string;
  priority: TaskPriority;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  type: ClientType;
  stage: ClientStage;
  source: ClientSource;
  prospectId?: string | null;
  boardName?: string | null;
  unitNo?: string | null;
  propertyInterest: string;
  budget: string;
  lastContact: string;
  nextFollowUp: string;
  notes: string;
  ownerId: string;
  createdAt: string;
  tasks: ClientTask[];
}

export const CLIENT_TYPES: ClientType[]   = ['Buyer', 'Tenant', 'Seller', 'Landlord', 'Lead'];
export const CLIENT_STAGES: ClientStage[] = ['New', 'Engaged', 'Qualified', 'Proposal', 'Negotiating', 'Closed Won', 'Closed Lost'];

export const STAGE_TONES: Record<ClientStage, { bg: string; text: string; dot: string }> = {
  'New':         { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
  'Engaged':     { bg: '#E0F2FE', text: '#0369A1', dot: '#3B82F6' },
  'Qualified':   { bg: '#EDE9FE', text: '#7C3AED', dot: '#8B5CF6' },
  'Proposal':    { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  'Negotiating': { bg: '#FFEDD5', text: '#9A3412', dot: '#F97316' },
  'Closed Won':  { bg: '#DCFCE7', text: '#15803D', dot: '#22C55E' },
  'Closed Lost': { bg: '#FEE2E2', text: '#B91C1C', dot: '#EF4444' },
};

export const TYPE_TONES: Record<ClientType, { bg: string; text: string }> = {
  'Buyer':    { bg: '#DCFCE7', text: '#15803D' },
  'Tenant':   { bg: '#E0F2FE', text: '#0369A1' },
  'Seller':   { bg: '#FEF3C7', text: '#92400E' },
  'Landlord': { bg: '#EDE9FE', text: '#7C3AED' },
  'Lead':     { bg: '#F3F4F6', text: '#374151' },
};

export const PRIORITY_TONES: Record<TaskPriority, { bg: string; text: string }> = {
  high:   { bg: '#FEE2E2', text: '#B91C1C' },
  medium: { bg: '#FEF3C7', text: '#92400E' },
  low:    { bg: '#E0F2FE', text: '#0369A1' },
};

// ─── Mappers ───────────────────────────────────────────────────────────────
function taskFromDb(r: DbClientTask): ClientTask {
  return {
    id: r.id, title: r.title, done: r.done,
    dueDate: r.due_date ?? '', priority: r.priority,
    createdAt: r.created_at,
  };
}

function clientFromDb(r: DbClient, tasks: DbClientTask[] = []): Client {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    type: r.type,
    stage: r.stage,
    source: r.source,
    prospectId: r.prospect_id,
    boardName: r.board_name,
    unitNo: r.unit_no,
    propertyInterest: r.property_interest,
    budget: r.budget,
    lastContact: r.last_contact ?? '',
    nextFollowUp: r.next_follow_up ?? '',
    notes: r.notes,
    ownerId: r.owner_id,
    createdAt: r.created_at,
    tasks: tasks.map(taskFromDb),
  };
}

// ─── Reads ────────────────────────────────────────────────────────────────
export async function listClients(): Promise<Client[]> {
  const [clientsRes, tasksRes] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('client_tasks').select('*').order('created_at', { ascending: false }),
  ]);
  if (clientsRes.error) throw clientsRes.error;
  if (tasksRes.error)   throw tasksRes.error;

  const tasksByClient = new Map<string, DbClientTask[]>();
  for (const t of tasksRes.data ?? []) {
    const list = tasksByClient.get(t.client_id) ?? [];
    list.push(t);
    tasksByClient.set(t.client_id, list);
  }
  return (clientsRes.data ?? []).map((r) => clientFromDb(r, tasksByClient.get(r.id) ?? []));
}

export async function getClient(id: string): Promise<Client | null> {
  // Two parallel single-table reads (avoids the embedded-select typing
  // friction of `.select('*, client_tasks(*)')`).
  const [clientRes, tasksRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).maybeSingle(),
    supabase.from('client_tasks').select('*').eq('client_id', id).order('created_at', { ascending: false }),
  ]);
  if (clientRes.error) throw clientRes.error;
  if (tasksRes.error)  throw tasksRes.error;
  if (!clientRes.data) return null;
  return clientFromDb(clientRes.data, tasksRes.data ?? []);
}

// ─── Writes ───────────────────────────────────────────────────────────────
export async function createClient(input: Omit<Client, 'id' | 'createdAt' | 'tasks' | 'ownerId'>): Promise<Client> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const insert: TablesInsert<'clients'> = {
    owner_id: user.id,
    name: input.name,
    phone: input.phone,
    email: input.email,
    type: input.type,
    stage: input.stage,
    source: input.source,
    prospect_id: input.prospectId ?? null,
    board_name: input.boardName ?? null,
    unit_no: input.unitNo ?? null,
    property_interest: input.propertyInterest,
    budget: input.budget,
    last_contact: input.lastContact || null,
    next_follow_up: input.nextFollowUp || null,
    notes: input.notes,
  };
  const { data, error } = await supabase.from('clients').insert(insert).select('*').single();
  if (error) throw error;
  return clientFromDb(data, []);
}

export async function updateClient(id: string, patch: Partial<Omit<Client, 'id' | 'tasks' | 'createdAt' | 'ownerId'>>): Promise<void> {
  const update: TablesUpdate<'clients'> = {};
  if (patch.name              !== undefined) update.name = patch.name;
  if (patch.phone             !== undefined) update.phone = patch.phone;
  if (patch.email             !== undefined) update.email = patch.email;
  if (patch.type              !== undefined) update.type = patch.type;
  if (patch.stage             !== undefined) update.stage = patch.stage;
  if (patch.source            !== undefined) update.source = patch.source;
  if (patch.prospectId        !== undefined) update.prospect_id = patch.prospectId;
  if (patch.boardName         !== undefined) update.board_name = patch.boardName;
  if (patch.unitNo            !== undefined) update.unit_no = patch.unitNo;
  if (patch.propertyInterest  !== undefined) update.property_interest = patch.propertyInterest;
  if (patch.budget            !== undefined) update.budget = patch.budget;
  if (patch.lastContact       !== undefined) update.last_contact = patch.lastContact || null;
  if (patch.nextFollowUp      !== undefined) update.next_follow_up = patch.nextFollowUp || null;
  if (patch.notes             !== undefined) update.notes = patch.notes;

  const { error } = await supabase.from('clients').update(update).eq('id', id);
  if (error) throw error;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// ─── Tasks ────────────────────────────────────────────────────────────────
export async function addTask(clientId: string, title: string, dueDate = '', priority: TaskPriority = 'medium'): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;
  const { error } = await supabase.from('client_tasks').insert({
    client_id: clientId,
    title: trimmed,
    due_date: dueDate || null,
    priority,
  });
  if (error) throw error;
}

export async function toggleTask(taskId: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('client_tasks').update({ done }).eq('id', taskId);
  if (error) throw error;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('client_tasks').delete().eq('id', taskId);
  if (error) throw error;
}

// ─── Prospect → Client import (server-side RPC) ──────────────────────────
export async function importFromProspect(prospectId: string): Promise<Client> {
  const { data, error } = await supabase.rpc('import_prospect_to_client', { p_prospect_id: prospectId });
  if (error) throw error;
  // The RPC returns a single row, but Supabase typings may expose it as a
  // setof — coerce defensively.
  const row = (Array.isArray(data) ? data[0] : data) as DbClient;
  return clientFromDb(row, []);
}

// ─── Selectors (date helpers) ────────────────────────────────────────────
export function isOverdue(iso: string | undefined): boolean {
  if (!iso) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}
export function isToday(iso: string | undefined): boolean {
  if (!iso) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
}
export function isUpcoming(iso: string | undefined, days = 7): boolean {
  if (!iso) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const limit = new Date(today); limit.setDate(limit.getDate() + days);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  return d.getTime() > today.getTime() && d.getTime() <= limit.getTime();
}
export function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
