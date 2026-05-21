// Calendar module — local storage backed, with a stubbed Google Calendar
// connection. Swap the GoogleAuth helpers for real `gapi.client.calendar` calls
// when the OAuth client id is provisioned.

const KEY_EVENTS  = 'we.calendar.events';
const KEY_GOOGLE  = 'we.calendar.google';

export interface CalEvent {
  id: string;
  title: string;
  start: string;            // ISO timestamp
  end: string;              // ISO timestamp
  allDay?: boolean;
  location?: string;
  notes?: string;
  prospectId?: string;      // optional cross-link to a Prospect Hub row
  attendees?: string[];     // emails
  // Scaffolded for the future Clients + Listings modules — stored on the
  // event today so we don't have to migrate data when those modules ship.
  clients?: string[];       // free-text client identifiers (names or future client IDs)
  listing?: string;         // free-text listing identifier (board name or future listing ID)
  color: string;            // hex
  ownerEmail: string;       // who created it
  // Google sync metadata — set when the event has been synced to a Google
  // Calendar (mock for now; real once OAuth is wired).
  googleEventId?: string;
  syncedAt?: string;
}

export const EVENT_COLORS = [
  '#1EC9C4', '#F97316', '#8B5CF6', '#EF4444', '#22C55E',
  '#F59E0B', '#3B82F6', '#EC4899', '#06B6D4',
] as const;

// Preset appointment titles surfaced in the New/Edit Event dialog. Free-text
// titles still work — these are just quick picks.
export const EVENT_TITLE_PRESETS = [
  'Tenant Appointment',
  'Owner Appointment',
  'Buyer Appointment',
] as const;
export type EventTitlePreset = typeof EVENT_TITLE_PRESETS[number];

export interface GoogleState {
  connected: boolean;
  email?: string;
  connectedAt?: string;
  // In production this would be a refresh token / accessToken from gapi.
  mockToken?: string;
}

// ─── Events ──────────────────────────────────────────────────────────────────
export function listEvents(): CalEvent[] {
  try {
    const raw = localStorage.getItem(KEY_EVENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveEvents(events: CalEvent[]): void {
  try { localStorage.setItem(KEY_EVENTS, JSON.stringify(events)); } catch { /* ignore */ }
}
export function createEvent(e: Omit<CalEvent, 'id'>): CalEvent {
  const ev: CalEvent = { ...e, id: `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}` };
  saveEvents([...listEvents(), ev]);
  return ev;
}
export function updateEvent(id: string, patch: Partial<CalEvent>): void {
  saveEvents(listEvents().map((e) => (e.id === id ? { ...e, ...patch } : e)));
}
export function deleteEvent(id: string): void {
  saveEvents(listEvents().filter((e) => e.id !== id));
}

// ─── Google Calendar connection (mock) ──────────────────────────────────────
export function getGoogleState(): GoogleState {
  try {
    const raw = localStorage.getItem(KEY_GOOGLE);
    if (!raw) return { connected: false };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as GoogleState : { connected: false };
  } catch { return { connected: false }; }
}
function saveGoogleState(s: GoogleState): void {
  try { localStorage.setItem(KEY_GOOGLE, JSON.stringify(s)); } catch { /* ignore */ }
}

// In production: open Google's OAuth popup via `gapi.auth2.getAuthInstance().signIn()`,
// then store the resulting access token. The local mock just stamps the user's
// own email + a fake token so the UI can branch on "connected" state.
export async function connectGoogleMock(email: string): Promise<GoogleState> {
  await new Promise((r) => setTimeout(r, 600));
  const next: GoogleState = {
    connected: true,
    email,
    connectedAt: new Date().toISOString(),
    mockToken: `mock_${Date.now()}`,
  };
  saveGoogleState(next);
  return next;
}
export function disconnectGoogle(): void {
  saveGoogleState({ connected: false });
}

// Mock "push event to Google" — in production this hits the Calendar API.
export async function syncEventToGoogle(eventId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 300));
  updateEvent(eventId, {
    googleEventId: `gcal_${Date.now()}`,
    syncedAt: new Date().toISOString(),
  });
}

// ─── Date helpers ───────────────────────────────────────────────────────────
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
// Returns an array of 42 dates spanning the calendar grid for the month
// containing `d` (6 rows × 7 days, starting Monday).
export function monthGridDays(d: Date): Date[] {
  const first = startOfMonth(d);
  // Convert Sunday=0..Saturday=6 to Monday=0..Sunday=6
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
