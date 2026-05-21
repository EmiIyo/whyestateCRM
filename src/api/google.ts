// Real Google OAuth wiring via Supabase Auth's identity-linking flow.
// Calendar scope only for now; Drive will follow the same pattern.
//
// Mechanics:
//   1. `linkGoogleCalendar()` redirects the user through Google's consent
//      screen. Supabase handles the callback and stores both
//      `provider_token` (short-lived access token) and
//      `provider_refresh_token` on the session.
//   2. `isGoogleConnected()` looks at the live `user.identities` array —
//      a 'google' identity means the user is currently linked.
//   3. `pushEventToGoogleCalendar()` uses `session.provider_token` to POST
//      directly to the Google Calendar API. The browser→Google call works
//      because Google sets permissive CORS on its v3 endpoints.

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type GoogleConnection = Tables<'google_connections'>;

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

// ─── Connection ───────────────────────────────────────────────────────────
export async function isGoogleConnected(): Promise<{ connected: boolean; email?: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  const google = user?.identities?.find((i) => i.provider === 'google');
  if (!google) return { connected: false };
  // The identity's email may be on the identity_data or the user record.
  const email =
    (google.identity_data as { email?: string } | undefined)?.email
    ?? user?.email
    ?? null;
  return { connected: true, email };
}

export async function linkGoogleCalendar(): Promise<void> {
  // `access_type=offline` + `prompt=consent` is what makes Google issue a
  // refresh token; without it the link works once and silently breaks when
  // the access token expires in an hour.
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      scopes: GOOGLE_CALENDAR_SCOPE,
      redirectTo: `${window.location.origin}${window.location.pathname}${window.location.hash}`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
  // Function doesn't resolve before the redirect — anything after this
  // line runs only if the SDK throws synchronously.
}

export async function unlinkGoogle(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const google = user?.identities?.find((i) => i.provider === 'google');
  if (!google) return;
  const { error } = await supabase.auth.unlinkIdentity(google);
  if (error) throw error;
}

// ─── Sync ────────────────────────────────────────────────────────────────
// The Supabase session carries a provider_token whenever Google identity is
// present + the access token is still valid. Browser→Google CORS is
// permitted for the v3 calendar endpoints with a bearer token.

interface GoogleEventPayload {
  summary: string;
  description?: string;
  location?: string;
  start: string;   // ISO
  end: string;     // ISO
  allDay?: boolean;
  attendees?: string[];
}

export async function pushEventToGoogleCalendar(event: GoogleEventPayload): Promise<{ id: string; htmlLink?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.provider_token;
  if (!token) {
    throw new Error('Google session expired — open Settings → Connect Google Calendar again.');
  }

  const body = {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: event.allDay
      ? { date: event.start.slice(0, 10) }
      : { dateTime: event.start, timeZone: 'Asia/Kuala_Lumpur' },
    end: event.allDay
      ? { date: event.end.slice(0, 10) }
      : { dateTime: event.end,   timeZone: 'Asia/Kuala_Lumpur' },
    attendees: event.attendees?.map((email) => ({ email })),
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Google Calendar rejected the event (${res.status}): ${detail}`);
  }
  const json = await res.json();
  return { id: json.id as string, htmlLink: json.htmlLink as string | undefined };
}

export async function deleteEventFromGoogleCalendar(googleEventId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.provider_token;
  if (!token) throw new Error('Google session expired.');
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
    { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok && res.status !== 410 /* already gone */) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Could not delete on Google (${res.status}): ${detail}`);
  }
}

// ─── Legacy helpers kept for parts of the UI still wired to the old API ──
export async function getMyConnection(): Promise<GoogleConnection | null> {
  // The dashboard row is now optional — the canonical state comes from
  // `isGoogleConnected()`. Returning null is safe.
  return null;
}

export async function disconnect(): Promise<void> {
  await unlinkGoogle();
}
