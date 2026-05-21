import { supabase } from '@/lib/supabase';
import type { Tables, Enums } from '@/types/database';

export type AppRole = Enums<'app_role'>;
export type RolePermissionsRow = Tables<'role_permissions'>;

// ─── Role catalog (UI labels + tones) ─────────────────────────────────────
export const ROLES: { id: AppRole; label: string; locked: boolean; tone: { bg: string; text: string } }[] = [
  { id: 'master_admin', label: 'Master Admin', locked: true,  tone: { bg: '#FEF3C7', text: '#92400E' } },
  { id: 'admin',        label: 'Admin',        locked: false, tone: { bg: '#DAF3F2', text: '#0F766E' } },
  { id: 'editor',       label: 'Editor',       locked: false, tone: { bg: '#E0F2FE', text: '#0369A1' } },
  { id: 'viewer',       label: 'Viewer',       locked: false, tone: { bg: '#F3F4F6', text: '#374151' } },
];

// ─── Permission catalog (what the UI exposes for Admin Control) ───────────
export interface PermissionDef {
  key:   string;
  label: string;
  group: string;
}

export const PERMISSIONS: PermissionDef[] = [
  // Sidebar / route gates — controls which top-level modules each role can
  // see and visit. Hiding the nav entry also blocks the URL from working.
  { key: 'nav.dashboard',         label: 'Dashboard module',                group: 'Navigation' },
  { key: 'nav.leads',             label: 'Prospect Hub module',             group: 'Navigation' },
  { key: 'nav.clients',           label: 'Clients module',                  group: 'Navigation' },
  { key: 'nav.calendar',          label: 'Calendar module',                 group: 'Navigation' },
  { key: 'nav.documents',         label: 'Documents module',                group: 'Navigation' },

  { key: 'boards.create',         label: 'Create new board',                group: 'Boards' },
  { key: 'boards.edit',           label: 'Edit board settings',             group: 'Boards' },
  { key: 'boards.delete',         label: 'Delete board (and its data)',     group: 'Boards' },
  { key: 'boards.reorder',        label: 'Rearrange boards (Manage mode)',  group: 'Boards' },
  { key: 'boards.invite_members', label: 'Invite members to a board',       group: 'Boards' },
  { key: 'boards.remove_members', label: 'Remove members from a board',     group: 'Boards' },

  { key: 'folders.create',         label: 'Create folder',                   group: 'Folders' },
  { key: 'folders.edit',           label: 'Rename folder',                   group: 'Folders' },
  { key: 'folders.delete',         label: 'Delete folder',                   group: 'Folders' },
  { key: 'folders.assign_boards',  label: 'Move boards into folders',        group: 'Folders' },
  { key: 'folders.view_combined',  label: 'Open combined folder view',       group: 'Folders' },
  { key: 'folders.invite_members', label: 'Invite members to a folder',      group: 'Folders' },
  { key: 'folders.remove_members', label: 'Remove members from a folder',    group: 'Folders' },

  { key: 'rows.create',           label: 'Add new prospect row',            group: 'Prospects' },
  { key: 'rows.edit',             label: 'Edit cell values',                group: 'Prospects' },
  { key: 'rows.delete',           label: 'Delete prospect row',             group: 'Prospects' },
  { key: 'rows.duplicate',        label: 'Duplicate prospect row',          group: 'Prospects' },
  { key: 'rows.bulk_delete',      label: 'Bulk delete (multi-select)',      group: 'Prospects' },

  { key: 'columns.create',        label: 'Add custom column',               group: 'Columns' },
  { key: 'columns.edit',          label: 'Rename column',                   group: 'Columns' },
  { key: 'columns.delete',        label: 'Delete column',                   group: 'Columns' },

  { key: 'agents.manage',         label: 'Add / remove agent presets',      group: 'Agents' },

  { key: 'data.import',           label: 'Import data (CSV / Excel)',       group: 'Data' },
  { key: 'data.export',           label: 'Export data (CSV / Excel)',       group: 'Data' },
  { key: 'data.demo',             label: 'Load / Unload demo dataset',      group: 'Data' },

  { key: 'view.filter',           label: 'Use filters and search',          group: 'View' },
  { key: 'view.quick_tabs',       label: 'Use quick-view tabs (All / Rent / Sale)', group: 'View' },

  { key: 'recycle.access',        label: 'Open the Recycle Bin',            group: 'Recycle Bin' },
  { key: 'recycle.restore',       label: 'Restore deleted items',           group: 'Recycle Bin' },
  { key: 'recycle.purge',         label: 'Permanently delete from bin',     group: 'Recycle Bin' },
];

export const PERMISSION_GROUPS = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

// ─── Data access ──────────────────────────────────────────────────────────
export type RolePerms = Record<AppRole, string[]>;

export async function loadRolePerms(): Promise<RolePerms> {
  const { data, error } = await supabase.from('role_permissions').select('*');
  if (error) throw error;
  const out: RolePerms = { master_admin: [], admin: [], editor: [], viewer: [] };
  for (const row of data ?? []) out[row.role] = row.permissions;
  return out;
}

export async function saveRolePerms(role: Exclude<AppRole, 'master_admin'>, permissions: string[]): Promise<void> {
  const { error } = await supabase
    .from('role_permissions')
    .update({ permissions })
    .eq('role', role);
  if (error) throw error;
}

// Computes whether a role has a permission. Master admin always wins.
export function canDo(role: AppRole, permission: string, matrix: RolePerms): boolean {
  if (role === 'master_admin') return true;
  return matrix[role]?.includes(permission) ?? false;
}
