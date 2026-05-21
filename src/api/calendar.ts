import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

export type DbCalendarEvent = Tables<'calendar_events'>;

export interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string | null;
  notes?: string | null;
  prospectId?: string | null;
  clientId?: string | null;
  attendees: string[];
  clients: string[];
  listing?: string | null;
  color: string;
  ownerId: string;
  googleEventId?: string | null;
  syncedAt?: string | null;
}

export const EVENT_COLORS = [
  '#1EC9C4', '#F97316', '#8B5CF6', '#EF4444', '#22C55E',
  '#F59E0B', '#3B82F6', '#EC4899', '#06B6D4',
] as const;

export const EVENT_TITLE_PRESETS = [
  'Tenant Appointment',
  'Owner Appointment',
  'Buyer Appointment',
] as const;
export type EventTitlePreset = typeof EVENT_TITLE_PRESETS[number];

function fromDb(r: DbCalendarEvent): CalEvent {
  return {
    id: r.id,
    title: r.title,
    start: r.start_at,
    end: r.end_at,
    allDay: r.all_day,
    location: r.location,
    notes: r.notes,
    prospectId: r.prospect_id,
    clientId: r.client_id,
    attendees: r.attendees ?? [],
    clients: r.clients_text ?? [],
    listing: r.listing_text,
    color: r.color,
    ownerId: r.owner_id,
    googleEventId: r.google_event_id,
    syncedAt: r.synced_at,
  };
}

export async function listEvents(): Promise<CalEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .order('start_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromDb);
}

export async function listMyEvents(): Promise<CalEvent[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('owner_id', user.id)
    .order('start_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromDb);
}

export async function createEvent(input: Omit<CalEvent, 'id' | 'ownerId' | 'googleEventId' | 'syncedAt'>): Promise<CalEvent> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const insert: TablesInsert<'calendar_events'> = {
    owner_id: user.id,
    title: input.title,
    start_at: input.start,
    end_at: input.end,
    all_day: input.allDay,
    location: input.location ?? null,
    notes: input.notes ?? null,
    prospect_id: input.prospectId ?? null,
    client_id: input.clientId ?? null,
    attendees: input.attendees,
    clients_text: input.clients,
    listing_text: input.listing ?? null,
    color: input.color,
  };
  const { data, error } = await supabase.from('calendar_events').insert(insert).select('*').single();
  if (error) throw error;
  return fromDb(data);
}

export async function updateEvent(id: string, patch: Partial<Omit<CalEvent, 'id' | 'ownerId'>>): Promise<void> {
  const update: TablesUpdate<'calendar_events'> = {};
  if (patch.title       !== undefined) update.title = patch.title;
  if (patch.start       !== undefined) update.start_at = patch.start;
  if (patch.end         !== undefined) update.end_at = patch.end;
  if (patch.allDay      !== undefined) update.all_day = patch.allDay;
  if (patch.location    !== undefined) update.location = patch.location;
  if (patch.notes       !== undefined) update.notes = patch.notes;
  if (patch.prospectId  !== undefined) update.prospect_id = patch.prospectId;
  if (patch.clientId    !== undefined) update.client_id = patch.clientId;
  if (patch.attendees   !== undefined) update.attendees = patch.attendees;
  if (patch.clients     !== undefined) update.clients_text = patch.clients;
  if (patch.listing     !== undefined) update.listing_text = patch.listing;
  if (patch.color       !== undefined) update.color = patch.color;
  if (patch.googleEventId !== undefined) update.google_event_id = patch.googleEventId;
  if (patch.syncedAt    !== undefined) update.synced_at = patch.syncedAt;

  const { error } = await supabase.from('calendar_events').update(update).eq('id', id);
  if (error) throw error;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  if (error) throw error;
}

// Mock "push event to Google" — kept until real OAuth wiring lands.
export async function syncEventToGoogle(eventId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 300));
  await updateEvent(eventId, {
    googleEventId: `gcal_${Date.now()}`,
    syncedAt: new Date().toISOString(),
  });
}

// ─── Date helpers (kept here to minimise import churn elsewhere) ─────────
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
export function monthGridDays(d: Date): Date[] {
  const first = startOfMonth(d);
  const dayOfWeek = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(start.getDate() - dayOfWeek);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function fmtMonth(d: Date): string {
  return d.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
}
export function fmtDayShort(d: Date): string {
  return d.toLocaleDateString('en-MY', { weekday: 'short', day: '2-digit', month: 'short' });
}
export function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return iso; }
}
export function isoFromDateTime(date: Date, hh: number, mm: number): string {
  const d = new Date(date); d.setHours(hh, mm, 0, 0); return d.toISOString();
}
