// ─── Roles & Permissions for Prospect Hub ───────────────────────────────────

export type Role = 'master_admin' | 'admin' | 'editor' | 'viewer';

export const ROLES: { id: Role; label: string; locked: boolean; tone: { bg: string; text: string } }[] = [
  { id: 'master_admin', label: 'Master Admin', locked: true,  tone: { bg: '#FEF3C7', text: '#92400E' } },
  { id: 'admin',        label: 'Admin',        locked: false, tone: { bg: '#DAF3F2', text: '#0F766E' } },
  { id: 'editor',       label: 'Editor',       locked: false, tone: { bg: '#E0F2FE', text: '#0369A1' } },
  { id: 'viewer',       label: 'Viewer',       locked: false, tone: { bg: '#F3F4F6', text: '#374151' } },
];

export interface PermissionDef {
  key:   string;
  label: string;
  group: string;
}

// Each permission corresponds to a clickable action / control inside Prospect Hub.
export const PERMISSIONS: PermissionDef[] = [
  // Boards
  { key: 'boards.create',         label: 'Create new board',                group: 'Boards' },
  { key: 'boards.edit',           label: 'Edit board settings',             group: 'Boards' },
  { key: 'boards.delete',         label: 'Delete board (and its data)',     group: 'Boards' },
  { key: 'boards.reorder',        label: 'Rearrange boards (Manage mode)',  group: 'Boards' },
  { key: 'boards.invite_members', label: 'Invite members to a board',       group: 'Boards' },
  { key: 'boards.remove_members', label: 'Remove members from a board',     group: 'Boards' },

  // Folders
  { key: 'folders.create',        label: 'Create folder',                   group: 'Folders' },
  { key: 'folders.edit',          label: 'Rename folder',                   group: 'Folders' },
  { key: 'folders.delete',        label: 'Delete folder',                   group: 'Folders' },
  { key: 'folders.assign_boards', label: 'Move boards into folders',        group: 'Folders' },
  { key: 'folders.view_combined', label: 'Open combined folder view',       group: 'Folders' },

  // Prospect rows (data)
  { key: 'rows.create',           label: 'Add new prospect row',            group: 'Prospects' },
  { key: 'rows.edit',             label: 'Edit cell values',                group: 'Prospects' },
  { key: 'rows.delete',           label: 'Delete prospect row',             group: 'Prospects' },
  { key: 'rows.duplicate',        label: 'Duplicate prospect row',          group: 'Prospects' },
  { key: 'rows.bulk_delete',      label: 'Bulk delete (multi-select)',      group: 'Prospects' },

  // Columns (custom fields)
  { key: 'columns.create',        label: 'Add custom column',               group: 'Columns' },
  { key: 'columns.edit',          label: 'Rename column',                   group: 'Columns' },
  { key: 'columns.delete',        label: 'Delete column',                   group: 'Columns' },

  // Data
  { key: 'data.import',           label: 'Import CSV',                      group: 'Data' },
  { key: 'data.export',           label: 'Export CSV',                      group: 'Data' },
  { key: 'data.demo',             label: 'Load / Unload demo dataset',      group: 'Data' },

  // Filtering / search
  { key: 'view.filter',           label: 'Use filters and search',          group: 'View' },
  { key: 'view.quick_tabs',       label: 'Use quick-view tabs (All / Rent / Sale)', group: 'View' },
];

export const PERMISSION_GROUPS = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

// ─── Default role → permissions mapping ─────────────────────────────────────
const ALL_KEYS = PERMISSIONS.map((p) => p.key);

// Keys an editor can do (can edit row/column data but not delete boards/folders/columns)
const EDITOR_KEYS: string[] = [
  'folders.view_combined',
  'rows.create', 'rows.edit', 'rows.duplicate',
  'columns.create', 'columns.edit',
  'data.import', 'data.export',
  'view.filter', 'view.quick_tabs',
];

// Viewer: read-only — can only filter/search the data, no writes
const VIEWER_KEYS: string[] = [
  'folders.view_combined',
  'data.export',
  'view.filter', 'view.quick_tabs',
];

const DEFAULTS: Record<Role, string[]> = {
  master_admin: ALL_KEYS,
  admin:        ALL_KEYS,            // by default same as master, locked-master can change this
  editor:       EDITOR_KEYS,
  viewer:       VIEWER_KEYS,
};

// ─── Persistence ────────────────────────────────────────────────────────────
const KEY = 'we.roles';

export type RolePerms = Record<Role, string[]>;

export function loadRolePerms(): RolePerms {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RolePerms>;
      // Merge with defaults so newly added permissions get a sane fallback.
      return {
        master_admin: ALL_KEYS, // always all
        admin:  parsed.admin  ?? DEFAULTS.admin,
        editor: parsed.editor ?? DEFAULTS.editor,
        viewer: parsed.viewer ?? DEFAULTS.viewer,
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveRolePerms(perms: RolePerms): void {
  try {
    // Don't bother persisting the master_admin column — it's always all.
    const { master_admin: _drop, ...rest } = perms;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch { /* ignore */ }
}

export function resetRolePerms(): void {
  localStorage.removeItem(KEY);
}

// ─── Runtime permission check ──────────────────────────────────────────────
export function canDo(role: Role, permission: string): boolean {
  if (role === 'master_admin') return true;
  const perms = loadRolePerms();
  return (perms[role] ?? []).includes(permission);
}

// ─── User → role assignment ────────────────────────────────────────────────
const USER_ROLES_KEY = 'we.user_roles';

type UserRoleMap = Record<string, Role>;

function loadUserRoles(): UserRoleMap {
  try {
    const raw = localStorage.getItem(USER_ROLES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed as UserRoleMap : {};
  } catch { return {}; }
}

function saveUserRoles(map: UserRoleMap): void {
  try { localStorage.setItem(USER_ROLES_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

export function getUserRole(email: string): Role {
  const lower = email.toLowerCase();
  const map = loadUserRoles();
  return map[lower] ?? 'admin';
}

export function setUserRole(email: string, role: Role): void {
  const lower = email.toLowerCase();
  const map = loadUserRoles();
  map[lower] = role;
  saveUserRoles(map);
}

export function getAllUserRoles(): UserRoleMap {
  return loadUserRoles();
}
