import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'we.auth',
    flowType: 'pkce',
    // Disable the default cross-tab `navigator.locks` coordination. With it
    // enabled, a stale lock from a previous deploy / crashed tab / pinned
    // tab can hang auth client init with `AbortError: signal is aborted
    // without reason`, leaving the user on a white screen on first load
    // (incognito works because it has an isolated lock space).
    //
    // The lock only serialises token-refresh + session-read calls across
    // tabs. Concurrent refresh is safe under PKCE (Supabase dedupes
    // internally), and cross-tab profile / role / admin_access updates are
    // already handled by the `me-profile-${userId}` realtime channel in
    // src/lib/auth.ts — so we lose nothing functional by skipping it.
    lock: (_name, _acquireTimeout, fn) => fn(),
  },
  global: {
    headers: { 'x-application-name': 'why-estate-crm' },
  },
  realtime: {
    params: { eventsPerSecond: 5 },
  },
});
