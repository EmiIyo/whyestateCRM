// Per-user UI preferences (column widths, view lock/zoom, WhatsApp templates,
// WhatsApp language). Stored in `public.user_preferences`, one row per user,
// owned by them via RLS. Replaces the prior localStorage scheme so prefs
// follow the user across devices/browsers.
import { supabase } from '@/lib/supabase';
import type { Json, TablesUpdate } from '@/types/database';

export type WaLang = 'en' | 'zh';
export interface WaTemplate { id: string; label: string; body: string; lang: WaLang }

export interface UserPreferences {
  columnWidths: Record<string, number>;
  viewUnlocked: boolean;
  viewZoom:     number;
  waTemplates:  WaTemplate[];
  waLang:       WaLang;
}

export const DEFAULT_PREFS: UserPreferences = {
  columnWidths: {},
  viewUnlocked: false,
  viewZoom:     1,
  waTemplates:  [],
  waLang:       'en',
};

function parseWidths(v: Json): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, Json>)) {
    if (typeof val === 'number' && Number.isFinite(val)) out[k] = val;
  }
  return out;
}

function parseTemplates(v: Json): WaTemplate[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((t): t is Record<string, Json> => !!t && typeof t === 'object' && !Array.isArray(t))
    .map((t) => ({
      id:    String(t.id ?? `tpl_${Math.random().toString(36).slice(2, 8)}`),
      label: String(t.label ?? ''),
      body:  String(t.body ?? ''),
      lang:  (t.lang === 'zh' ? 'zh' : 'en') as WaLang,
    }));
}

// Reads (or creates) the current user's prefs row. Returns DEFAULT_PREFS
// when there's no signed-in user — keeps the boot path quiet.
export async function loadUserPreferences(): Promise<UserPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_PREFS;

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    // First-time login — seed an empty row so subsequent updates succeed.
    await supabase.from('user_preferences').insert({ user_id: user.id });
    return DEFAULT_PREFS;
  }

  return {
    columnWidths: parseWidths(data.column_widths),
    viewUnlocked: !!data.view_unlocked,
    viewZoom:     Number.isFinite(data.view_zoom) ? Number(data.view_zoom) : 1,
    waTemplates:  parseTemplates(data.wa_templates),
    waLang:       (data.wa_lang === 'zh' ? 'zh' : 'en') as WaLang,
  };
}

// Patch one or more pref fields. Caller is responsible for debouncing
// high-frequency updates (e.g. column resize) so we don't hammer the DB.
export async function saveUserPreferences(patch: Partial<UserPreferences>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const update: TablesUpdate<'user_preferences'> = {};
  if (patch.columnWidths !== undefined) update.column_widths = patch.columnWidths as unknown as Json;
  if (patch.viewUnlocked !== undefined) update.view_unlocked = patch.viewUnlocked;
  if (patch.viewZoom     !== undefined) update.view_zoom     = patch.viewZoom;
  if (patch.waTemplates  !== undefined) update.wa_templates  = patch.waTemplates as unknown as Json;
  if (patch.waLang       !== undefined) update.wa_lang       = patch.waLang;
  if (Object.keys(update).length === 0) return;

  // Upsert so the row materializes if loadUserPreferences hasn't run yet.
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: user.id, ...update }, { onConflict: 'user_id' });
  if (error) throw error;
}

// One-time migration: lifts the legacy `we.*` localStorage keys (used before
// prefs moved to Supabase) into `user_preferences`, then deletes them so this
// is a no-op on subsequent boots. Safe to call on every boot — short-circuits
// when no legacy keys are present. Returns the count of fields migrated so
// the caller can surface a notice if helpful.
const LEGACY_KEYS = [
  'we.column_widths',
  'we.view.unlocked',
  'we.view.zoom',
  'we.wa_templates',
  'we.wa_lang',
] as const;

export async function migrateLegacyLocalPrefs(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  const ls = window.localStorage;
  if (!LEGACY_KEYS.some((k) => ls.getItem(k) !== null)) return 0;

  const patch: Partial<UserPreferences> = {};

  const w = ls.getItem('we.column_widths');
  if (w) {
    try {
      const parsed = JSON.parse(w) as Json;
      const widths = parseWidths(parsed);
      if (Object.keys(widths).length > 0) patch.columnWidths = widths;
    } catch { /* skip malformed */ }
  }

  const u = ls.getItem('we.view.unlocked');
  if (u != null) patch.viewUnlocked = u === '1';

  const z = ls.getItem('we.view.zoom');
  if (z != null) {
    const n = Number(z);
    if (Number.isFinite(n) && n >= 0.5 && n <= 2) patch.viewZoom = n;
  }

  const t = ls.getItem('we.wa_templates');
  if (t) {
    try {
      const parsed = JSON.parse(t) as Json;
      const templates = parseTemplates(parsed);
      if (templates.length > 0) patch.waTemplates = templates;
    } catch { /* skip malformed */ }
  }

  const l = ls.getItem('we.wa_lang');
  if (l === 'en' || l === 'zh') patch.waLang = l;

  const migrated = Object.keys(patch).length;
  if (migrated === 0) {
    // Nothing valid to lift, but the keys still exist — clear them so we
    // don't re-attempt parsing every boot.
    LEGACY_KEYS.forEach((k) => ls.removeItem(k));
    return 0;
  }

  try {
    await saveUserPreferences(patch);
    LEGACY_KEYS.forEach((k) => ls.removeItem(k));
    return migrated;
  } catch {
    // Leave the keys in place so next boot can retry once the user has
    // network / a valid session.
    return 0;
  }
}
