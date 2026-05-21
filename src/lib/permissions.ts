// Supabase-backed permission helpers + role catalog.
// The role matrix lives in `public.role_permissions`; it's pulled once at app
// boot and kept in the zustand store. Components consume `canDo()` and the
// store synchronously.

import { create } from 'zustand';
import {
  loadRolePerms,
  saveRolePerms as apiSaveRolePerms,
  ROLES,
  PERMISSIONS,
  PERMISSION_GROUPS,
  type RolePerms,
  type AppRole,
  type PermissionDef,
} from '@/api/permissions';
import { useAuthStore } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { adminSetUserRole as apiSetRole } from '@/api/profiles';

export { ROLES, PERMISSIONS, PERMISSION_GROUPS };
export type { RolePerms, AppRole as Role, PermissionDef };

// ─── Store ───────────────────────────────────────────────────────────────
interface PermsState {
  perms: RolePerms;
  loaded: boolean;
  setPerms: (p: RolePerms) => void;
}

export const usePermsStore = create<PermsState>((set) => ({
  perms: { master_admin: [], admin: [], editor: [], viewer: [] },
  loaded: false,
  setPerms: (perms) => set({ perms, loaded: true }),
}));

// ─── Boot ─────────────────────────────────────────────────────────────────
let booted = false;
export async function bootPermissions(): Promise<void> {
  if (booted) return;
  booted = true;
  try {
    const perms = await loadRolePerms();
    usePermsStore.getState().setPerms(perms);
  } catch {
    // Anonymous bootstrap — leave defaults; will reload after sign-in.
  }
}

export async function refreshPermissions(): Promise<void> {
  const perms = await loadRolePerms();
  usePermsStore.getState().setPerms(perms);
}

// ─── Synchronous read helpers ────────────────────────────────────────────
export function canDo(role: AppRole, permission: string): boolean {
  if (role === 'master_admin') return true;
  const perms = usePermsStore.getState().perms;
  return (perms[role] ?? []).includes(permission);
}

export function getCurrentRole(): AppRole {
  return useAuthStore.getState().profile?.role ?? 'viewer';
}

export function canCurrentUser(permission: string): boolean {
  return canDo(getViewAsRole() ?? getCurrentRole(), permission);
}

// ─── Mutations ───────────────────────────────────────────────────────────
export async function saveRolePerms(perms: RolePerms): Promise<void> {
  // Master admin row is immutable server-side; loop the three editable roles.
  await Promise.all([
    apiSaveRolePerms('admin',  perms.admin),
    apiSaveRolePerms('editor', perms.editor),
    apiSaveRolePerms('viewer', perms.viewer),
  ]);
  usePermsStore.getState().setPerms(perms);
}

// Factory defaults for the editable roles. Mirrors the seed in
// migration `permissions_and_invites`.
const DEFAULTS = {
  admin: [
    'boards.create','boards.edit','boards.delete','boards.reorder','boards.invite_members','boards.remove_members',
    'folders.create','folders.edit','folders.delete','folders.assign_boards','folders.view_combined','folders.invite_members','folders.remove_members',
    'rows.create','rows.edit','rows.delete','rows.duplicate','rows.bulk_delete',
    'columns.create','columns.edit','columns.delete',
    'agents.manage',
    'data.import','data.export','data.demo',
    'view.filter','view.quick_tabs',
    'recycle.access','recycle.restore','recycle.purge',
  ],
  editor: [
    'folders.view_combined',
    'rows.create','rows.edit','rows.duplicate',
    'columns.create','columns.edit',
    'agents.manage',
    'data.import','data.export',
    'view.filter','view.quick_tabs',
    'recycle.access','recycle.restore',
  ],
  viewer: [
    'folders.view_combined',
    'data.export',
    'view.filter','view.quick_tabs',
  ],
} as const;

export async function resetRolePerms(): Promise<void> {
  await Promise.all([
    apiSaveRolePerms('admin',  [...DEFAULTS.admin]),
    apiSaveRolePerms('editor', [...DEFAULTS.editor]),
    apiSaveRolePerms('viewer', [...DEFAULTS.viewer]),
  ]);
  await refreshPermissions();
}

// ─── User ↔ role assignment ─────────────────────────────────────────────
export function getUserRole(email: string): AppRole {
  const dir = useAuthStore.getState().directory;
  const row = dir.find((p) => p.email.toLowerCase() === email.toLowerCase());
  return row?.role ?? 'viewer';
}

export function getAllUserRoles(): Record<string, AppRole> {
  const dir = useAuthStore.getState().directory;
  const out: Record<string, AppRole> = {};
  for (const p of dir) out[p.email.toLowerCase()] = p.role;
  return out;
}

export async function setUserRole(email: string, role: AppRole): Promise<void> {
  const dir = useAuthStore.getState().directory;
  const row = dir.find((p) => p.email.toLowerCase() === email.toLowerCase());
  if (!row) throw new Error('User not found');
  await apiSetRole(row.id, role);
  // Update local directory optimistically.
  const next = dir.map((p) => p.id === row.id ? { ...p, role } : p);
  useAuthStore.getState().setDirectory(next);
}

// ─── "View as" preview (master admin only) ──────────────────────────────
const VIEW_AS_KEY = 'we.view_as_role';

export function getViewAsRole(): AppRole | null {
  try {
    const raw = sessionStorage.getItem(VIEW_AS_KEY);
    if (!raw) return null;
    return (ROLES.some((r) => r.id === raw) ? raw as AppRole : null);
  } catch { return null; }
}
export function setViewAsRole(role: AppRole | null): void {
  try {
    if (role) sessionStorage.setItem(VIEW_AS_KEY, role);
    else sessionStorage.removeItem(VIEW_AS_KEY);
  } catch { /* ignore */ }
}

// ─── Realtime subscription (so admin matrix edits propagate live) ───────
let realtimeSubscribed = false;
export function subscribePermissionsRealtime(): void {
  if (realtimeSubscribed) return;
  realtimeSubscribed = true;
  supabase
    .channel('role_permissions')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions' }, () => {
      void refreshPermissions();
    })
    .subscribe();
}
