// Supabase-backed auth & profile store.
// All UI components consume this module synchronously (via the zustand store)
// — async writes to Supabase are fire-and-forget with optimistic local updates.

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import {
  getProfile,
  listProfiles,
  updateMyProfile,
  type Profile,
  type UserTier,
  USER_TIERS,
} from '@/api/profiles';

export { USER_TIERS };
export type { UserTier };

export interface AuthUser {
  email: string;
  name: string;
  id: string;
}

export interface DirectoryUser {
  email:     string;
  name:      string;
  firstSeen: string;
  lastSeen:  string;
}

export const DEFAULT_AVATAR_COLOR = '#1EC9C4';

// ─── Zustand store ─────────────────────────────────────────────────────────
interface AuthState {
  ready:     boolean;             // initial session hydration done
  user:      AuthUser | null;
  profile:   Profile | null;
  directory: Profile[];           // every profile in the workspace
  setSession: (user: AuthUser | null, profile: Profile | null) => void;
  setDirectory: (rows: Profile[]) => void;
  setProfile: (p: Profile | null) => void;
  setReady: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  user: null,
  profile: null,
  directory: [],
  setSession: (user, profile) => set({ user, profile }),
  setDirectory: (rows) => set({ directory: rows }),
  setProfile: (profile) => set((s) => ({
    profile,
    user: profile && s.user
      ? { ...s.user, name: profile.display_name || s.user.email.split('@')[0] }
      : s.user,
  })),
  setReady: (ready) => set({ ready }),
}));

// ─── Boot: hydrate session + listen for auth changes ──────────────────────
let booted = false;
export async function bootAuth(): Promise<void> {
  if (booted) return;
  booted = true;

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const profile = await getProfile(session.user.id);
    useAuthStore.getState().setSession(
      { id: session.user.id, email: session.user.email ?? '', name: profile?.display_name || (session.user.email?.split('@')[0] ?? '') },
      profile,
    );
    void refreshDirectory();
  }
  useAuthStore.getState().setReady(true);

  supabase.auth.onAuthStateChange(async (_evt, sess) => {
    if (!sess?.user) {
      useAuthStore.getState().setSession(null, null);
      useAuthStore.getState().setDirectory([]);
      return;
    }
    const profile = await getProfile(sess.user.id);
    useAuthStore.getState().setSession(
      { id: sess.user.id, email: sess.user.email ?? '', name: profile?.display_name || (sess.user.email?.split('@')[0] ?? '') },
      profile,
    );
    void refreshDirectory();
  });
}

export async function refreshDirectory(): Promise<void> {
  try {
    const rows = await listProfiles();
    useAuthStore.getState().setDirectory(rows);
  } catch { /* swallow — usually means not signed-in yet */ }
}

// ─── Synchronous read helpers (the rest of the app calls these) ───────────
export function isAuthed(): boolean {
  return useAuthStore.getState().user !== null;
}

export function getCurrentUser(): AuthUser | null {
  return useAuthStore.getState().user;
}

export function listAllUsers(): DirectoryUser[] {
  return useAuthStore.getState().directory.map((p) => ({
    email: p.email,
    name: p.display_name || p.email.split('@')[0],
    firstSeen: p.created_at,
    lastSeen: p.updated_at,
  }));
}

// ─── Mutations ────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signUp(email: string, password: string, displayName: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName.trim() } },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// Full sign-out path used by the topbar + sidebar buttons. Hard-reloads the
// page so realtime channels close, zustand stores reset, and the next user
// in the same browser starts from a clean slate.
export async function signOutAndReset(): Promise<void> {
  try { await supabase.auth.signOut(); } catch { /* network down — still wipe */ }
  try { sessionStorage.removeItem('we.view_as_role'); } catch { /* ignore */ }
  // Use assign (not replace) so the browser's back button still reaches the
  // landing page after the redirect.
  window.location.assign('/');
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

export async function setPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ─── Profile helpers (display name, avatar, tier) ────────────────────────
export async function setNickname(newName: string): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed) return;
  await updateMyProfile({ display_name: trimmed });
  // Optimistic local update so the sidebar refreshes without a roundtrip.
  const s = useAuthStore.getState();
  if (s.profile) s.setProfile({ ...s.profile, display_name: trimmed });
}

export function getUserTier(email?: string): UserTier {
  const s = useAuthStore.getState();
  if (!email) return s.profile?.tier ?? 'Agent';
  const p = s.directory.find((u) => u.email.toLowerCase() === email.toLowerCase());
  return p?.tier ?? 'Agent';
}

export function getAvatarColor(email?: string): string {
  const s = useAuthStore.getState();
  if (!email) return s.profile?.avatar_color ?? DEFAULT_AVATAR_COLOR;
  const p = s.directory.find((u) => u.email.toLowerCase() === email.toLowerCase());
  return p?.avatar_color ?? DEFAULT_AVATAR_COLOR;
}

export function getAvatarImage(email?: string): string | null {
  const s = useAuthStore.getState();
  if (!email) return s.profile?.avatar_url ?? null;
  const p = s.directory.find((u) => u.email.toLowerCase() === email.toLowerCase());
  return p?.avatar_url ?? null;
}

export async function setAvatarColor(color: string): Promise<void> {
  await updateMyProfile({ avatar_color: color });
  const s = useAuthStore.getState();
  if (s.profile) s.setProfile({ ...s.profile, avatar_color: color });
}

export async function setAvatarImage(file: File): Promise<void> {
  const s = useAuthStore.getState();
  if (!s.user) throw new Error('Not authenticated');
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase();
  // Unique path per upload so every overwrite gets a fresh URL — no
  // cache-busting query string needed, and CDN/browser caches behave naturally.
  const path = `${s.user.id}/avatar-${Date.now()}.${ext}`;

  // Best-effort cleanup of previous avatar blobs in this user's folder so
  // storage doesn't grow unbounded. Failures are non-fatal.
  try {
    const { data: previous } = await supabase.storage.from('avatars').list(s.user.id, { limit: 50 });
    if (previous && previous.length > 0) {
      await supabase.storage.from('avatars').remove(previous.map((f) => `${s.user!.id}/${f.name}`));
    }
  } catch { /* ignore */ }

  const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || `image/${ext}`,
  });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = pub.publicUrl ?? null;

  await updateMyProfile({ avatar_url: url });
  if (s.profile) s.setProfile({ ...s.profile, avatar_url: url });
}

export async function clearAvatarImage(): Promise<void> {
  const s = useAuthStore.getState();
  if (!s.user) return;
  // List & remove all files in the user's avatar folder.
  const { data: files } = await supabase.storage.from('avatars').list(s.user.id, { limit: 50 });
  if (files && files.length > 0) {
    await supabase.storage.from('avatars').remove(files.map((f) => `${s.user!.id}/${f.name}`));
  }
  await updateMyProfile({ avatar_url: null });
  if (s.profile) s.setProfile({ ...s.profile, avatar_url: null });
}
