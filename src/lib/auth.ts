// Lightweight client-side auth state — backed by localStorage.
// Easy to swap for Supabase Auth later by replacing the bodies of these helpers.

const KEY_AUTH      = 'we.authed';
const KEY_EMAIL     = 'we.email';
const KEY_NAME      = 'we.name';
const KEY_COLOR     = 'we.avatar_color';  // per-user picked avatar hex (falls back to teal)
const KEY_USERS     = 'we.users';   // directory of every account that has signed up on this browser
const KEY_PASSWORDS = 'we.passwords';  // { [emailLower]: sha256Hex } — local mock auth only

export interface AuthUser {
  email: string;
  name: string;
}

export interface DirectoryUser {
  email:     string;
  name:      string;
  firstSeen: string;   // ISO timestamp
  lastSeen:  string;   // ISO timestamp
}

export function listAllUsers(): DirectoryUser[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY_USERS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveAllUsers(users: DirectoryUser[]): void {
  try { localStorage.setItem(KEY_USERS, JSON.stringify(users)); } catch { /* ignore */ }
}

function recordSignIn(email: string, name: string): void {
  const now = new Date().toISOString();
  const lower = email.toLowerCase();
  const users = listAllUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === lower);
  if (idx >= 0) {
    // Keep the existing directory name when the incoming one is just the
    // email prefix — protects against a generic "linux" overwriting a
    // user-edited "Linux Lin" on sign-in.
    const existing = users[idx].name ?? '';
    const incoming = name ?? '';
    const emailPrefix = email.split('@')[0];
    const nextName =
      (!incoming || incoming === emailPrefix) && existing
        ? existing
        : incoming || existing;
    users[idx] = { ...users[idx], name: nextName, lastSeen: now };
  } else {
    users.push({ email, name, firstSeen: now, lastSeen: now });
  }
  saveAllUsers(users);
}

export function removeUserFromDirectory(email: string): void {
  const lower = email.toLowerCase();
  const next = listAllUsers().filter((u) => u.email.toLowerCase() !== lower);
  saveAllUsers(next);
}

// Update any user's display name in the directory (admin-side rename).
// Also retroactively rewrites the prospect `agent` field anywhere it matched
// the old name, and if the renamed user is the currently-signed-in one, syncs
// `we.name` so the sidebar refreshes on reload.
export function setUserName(email: string, newName: string): boolean {
  const trimmed = newName.trim();
  if (!trimmed) return false;
  const lower = email.toLowerCase();
  const users = listAllUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === lower);
  if (idx < 0) return false;
  const oldName = users[idx].name;
  if (oldName === trimmed) return false;
  users[idx] = { ...users[idx], name: trimmed };
  saveAllUsers(users);

  // If editing the currently-signed-in user, keep KEY_NAME in sync.
  const myEmail = localStorage.getItem(KEY_EMAIL);
  if (myEmail && myEmail.toLowerCase() === lower) {
    localStorage.setItem(KEY_NAME, trimmed);
  }

  // Retroactively rewrite the agent field on any prospect that matched the old name.
  if (oldName) {
    try {
      const raw = localStorage.getItem('we.crm.state');
      if (raw) {
        const state = JSON.parse(raw) as { prospects?: Record<string, Array<{ agent?: string }>> };
        if (state.prospects) {
          for (const boardId of Object.keys(state.prospects)) {
            for (const p of state.prospects[boardId]) {
              if (p.agent === oldName) p.agent = trimmed;
            }
          }
          localStorage.setItem('we.crm.state', JSON.stringify(state));
        }
      }
    } catch { /* ignore */ }
  }
  return true;
}

// ─── Tier (per-user job tier — separate from permission/role) ───────────────
export const USER_TIERS = ['Agent', 'Staff', 'Branch Manager', 'Branch Partner'] as const;
export type UserTier = typeof USER_TIERS[number];
const KEY_USER_TIERS = 'we.user_tiers';

function loadTiers(): Record<string, UserTier> {
  try {
    const raw = localStorage.getItem(KEY_USER_TIERS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed as Record<string, UserTier> : {};
  } catch { return {}; }
}
function saveTiers(map: Record<string, UserTier>): void {
  try { localStorage.setItem(KEY_USER_TIERS, JSON.stringify(map)); } catch { /* ignore */ }
}
export function getUserTier(email: string): UserTier {
  if (typeof window === 'undefined') return 'Agent';
  return loadTiers()[email.toLowerCase()] ?? 'Agent';
}
export function setUserTier(email: string, tier: UserTier): void {
  if (typeof window === 'undefined') return;
  const map = loadTiers();
  map[email.toLowerCase()] = tier;
  saveTiers(map);
}

// Admin-created account — adds an entry to the directory without signing them in.
// Returns true if a new entry was added, false if one with this email already exists.
export function createUser(email: string, name: string): boolean {
  const cleanEmail = email.trim();
  const cleanName  = name.trim() || cleanEmail.split('@')[0];
  if (!cleanEmail) return false;
  const lower = cleanEmail.toLowerCase();
  const users = listAllUsers();
  if (users.some((u) => u.email.toLowerCase() === lower)) return false;
  const now = new Date().toISOString();
  users.push({ email: cleanEmail, name: cleanName, firstSeen: now, lastSeen: now });
  saveAllUsers(users);
  return true;
}

export function isAuthed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEY_AUTH) === '1';
}

export function getCurrentUser(): AuthUser | null {
  if (!isAuthed()) return null;
  return {
    email: localStorage.getItem(KEY_EMAIL) ?? '',
    name:  localStorage.getItem(KEY_NAME)  ?? '',
  };
}

export function signIn(email: string, name?: string): void {
  localStorage.setItem(KEY_AUTH,  '1');
  localStorage.setItem(KEY_EMAIL, email);
  // Resolution order:
  //   1. an explicit name passed in (signup path)
  //   2. the existing directory entry's name (so previously-edited nicknames
  //      survive sign-out → sign-in)
  //   3. whatever KEY_NAME still holds (legacy fallback)
  //   4. the email prefix (first-time login with no other info)
  let resolvedName = name?.trim() || '';
  if (!resolvedName) {
    const dirUser = listAllUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (dirUser?.name) resolvedName = dirUser.name;
  }
  if (!resolvedName) {
    resolvedName = localStorage.getItem(KEY_NAME) || email.split('@')[0];
  }
  localStorage.setItem(KEY_NAME, resolvedName);
  recordSignIn(email, resolvedName);
}

export function signOut(): void {
  localStorage.removeItem(KEY_AUTH);
  localStorage.removeItem(KEY_EMAIL);
  localStorage.removeItem(KEY_NAME);
}

// ─── Password (per-user, client-side mock) ──────────────────────────────────
// SHA-256 via Web Crypto — not real security, but better than plain text.
// Swap for Supabase Auth when wiring real auth.
async function hashPassword(pw: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return pw;
  const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function loadPasswords(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY_PASSWORDS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed as Record<string, string> : {};
  } catch { return {}; }
}
function savePasswords(map: Record<string, string>): void {
  try { localStorage.setItem(KEY_PASSWORDS, JSON.stringify(map)); } catch { /* ignore */ }
}
export async function setPassword(email: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  const all = loadPasswords();
  all[email.toLowerCase()] = hash;
  savePasswords(all);
}
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const all = loadPasswords();
  const stored = all[email.toLowerCase()];
  if (!stored) return false;  // no password set yet
  return stored === await hashPassword(password);
}
export function hasPasswordSet(email: string): boolean {
  return !!loadPasswords()[email.toLowerCase()];
}

// ─── Avatars (color + optional image, keyed by user email) ──────────────────
// All users share one map per kind so any user can render any other user's
// avatar (e.g. in the admin user table, member lists, etc.).
const KEY_AVATAR_COLORS = 'we.avatar_colors';  // { [emailLower]: hex }
const KEY_AVATAR_IMGS   = 'we.avatar_imgs';    // { [emailLower]: dataUrl }
export const DEFAULT_AVATAR_COLOR = '#1EC9C4';

function loadMap(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed as Record<string, string> : {};
  } catch { return {}; }
}
function saveMap(key: string, map: Record<string, string>): void {
  try { localStorage.setItem(key, JSON.stringify(map)); } catch { /* ignore */ }
}
function currentEmailLower(): string {
  return (localStorage.getItem(KEY_EMAIL) ?? '').toLowerCase();
}

// One-time migration of the legacy single-user keys onto the current user's slot.
let _migratedAvatars = false;
function migrateLegacyAvatars(): void {
  if (_migratedAvatars || typeof window === 'undefined') return;
  _migratedAvatars = true;
  const email = currentEmailLower();
  if (!email) return;
  // Legacy color key
  const legacyColor = localStorage.getItem(KEY_COLOR);
  if (legacyColor) {
    const colors = loadMap(KEY_AVATAR_COLORS);
    if (!colors[email]) { colors[email] = legacyColor; saveMap(KEY_AVATAR_COLORS, colors); }
    localStorage.removeItem(KEY_COLOR);
  }
  // Legacy image key
  const legacyImg = localStorage.getItem('we.avatar_img');
  if (legacyImg) {
    const imgs = loadMap(KEY_AVATAR_IMGS);
    if (!imgs[email]) { imgs[email] = legacyImg; saveMap(KEY_AVATAR_IMGS, imgs); }
    localStorage.removeItem('we.avatar_img');
  }
}

export function getAvatarColor(email?: string): string {
  if (typeof window === 'undefined') return DEFAULT_AVATAR_COLOR;
  migrateLegacyAvatars();
  const e = (email ?? currentEmailLower()).toLowerCase();
  return loadMap(KEY_AVATAR_COLORS)[e] || DEFAULT_AVATAR_COLOR;
}
export function setAvatarColor(color: string, email?: string): void {
  if (typeof window === 'undefined') return;
  const e = (email ?? currentEmailLower()).toLowerCase();
  if (!e) return;
  const map = loadMap(KEY_AVATAR_COLORS);
  map[e] = color;
  saveMap(KEY_AVATAR_COLORS, map);
}

export function getAvatarImage(email?: string): string | null {
  if (typeof window === 'undefined') return null;
  migrateLegacyAvatars();
  const e = (email ?? currentEmailLower()).toLowerCase();
  return loadMap(KEY_AVATAR_IMGS)[e] || null;
}
export function setAvatarImage(dataUrl: string, email?: string): void {
  if (typeof window === 'undefined') return;
  const e = (email ?? currentEmailLower()).toLowerCase();
  if (!e) return;
  const map = loadMap(KEY_AVATAR_IMGS);
  map[e] = dataUrl;
  saveMap(KEY_AVATAR_IMGS, map);
}
export function clearAvatarImage(email?: string): void {
  if (typeof window === 'undefined') return;
  const e = (email ?? currentEmailLower()).toLowerCase();
  if (!e) return;
  const map = loadMap(KEY_AVATAR_IMGS);
  delete map[e];
  saveMap(KEY_AVATAR_IMGS, map);
}

// Update the user's nickname AND
//   1. update their entry in the directory (we.users) so member/admin tables refresh
//   2. retroactively rewrite the `agent` field on every prospect that matched the old name
// Returns the old nickname so callers can decide what to do (e.g. reload).
export function setNickname(newName: string): string | null {
  const oldName = localStorage.getItem(KEY_NAME);
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return oldName;
  localStorage.setItem(KEY_NAME, trimmed);

  // Sync directory entry so AdminControl / member lists pick up the new name.
  const email = localStorage.getItem(KEY_EMAIL);
  if (email) {
    const lower = email.toLowerCase();
    const users = listAllUsers();
    const idx = users.findIndex((u) => u.email.toLowerCase() === lower);
    if (idx >= 0) {
      users[idx] = { ...users[idx], name: trimmed };
      saveAllUsers(users);
    }
  }

  if (oldName) {
    try {
      const raw = localStorage.getItem('we.crm.state');
      if (raw) {
        const state = JSON.parse(raw) as { prospects?: Record<string, Array<{ agent?: string }>> };
        if (state.prospects) {
          for (const boardId of Object.keys(state.prospects)) {
            for (const p of state.prospects[boardId]) {
              if (p.agent === oldName) p.agent = trimmed;
            }
          }
          localStorage.setItem('we.crm.state', JSON.stringify(state));
        }
      }
    } catch { /* ignore — user can re-edit if needed */ }
  }
  return oldName;
}
