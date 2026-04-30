// Lightweight client-side auth state — backed by localStorage.
// Easy to swap for Supabase Auth later by replacing the bodies of these helpers.

const KEY_AUTH  = 'we.authed';
const KEY_EMAIL = 'we.email';
const KEY_NAME  = 'we.name';
const KEY_USERS = 'we.users';   // directory of every account that has signed up on this browser

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
    users[idx] = { ...users[idx], name: name || users[idx].name, lastSeen: now };
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
  let resolvedName = name;
  if (resolvedName) {
    localStorage.setItem(KEY_NAME, resolvedName);
  } else if (!localStorage.getItem(KEY_NAME)) {
    resolvedName = email.split('@')[0];
    localStorage.setItem(KEY_NAME, resolvedName);
  } else {
    resolvedName = localStorage.getItem(KEY_NAME) ?? email.split('@')[0];
  }
  recordSignIn(email, resolvedName);
}

export function signOut(): void {
  localStorage.removeItem(KEY_AUTH);
  localStorage.removeItem(KEY_EMAIL);
  localStorage.removeItem(KEY_NAME);
}

// Update the user's nickname AND retroactively rewrite the `agent` field on
// every prospect in shared CRM state where it matched the old nickname.
// Returns the old nickname so callers can decide what to do (e.g. reload).
export function setNickname(newName: string): string | null {
  const oldName = localStorage.getItem(KEY_NAME);
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return oldName;
  localStorage.setItem(KEY_NAME, trimmed);

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
