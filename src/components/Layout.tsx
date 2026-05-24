import { useState, useRef, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOutAndReset, setNickname, useAuthStore, DEFAULT_AVATAR_COLOR } from '@/lib/auth';
import { ROLES, type Role, canDo, usePermsStore } from '@/lib/permissions';
import type { Enums } from '@/types/database';

type UserTier = Enums<'user_tier'>;
import {
  LayoutDashboard,
  Target,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Shield,
  Settings,
  Calendar,
  Folder,
  Building2,
  Users,
  Pencil,
  Check as CheckIcon,
  X,
} from 'lucide-react';
import { ROUTE_PATHS } from '@/lib/index';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ─── Nav definition ──────────────────────────────────────────────────────────
// Each item carries the `nav.*` permission key it requires. Admins can
// toggle these keys on/off per-role in Admin Control → Permission Matrix.
// `permission` is optional — main nav items use it for matrix-driven
// visibility, secondary items (Admin Control, Settings) gate themselves
// independently (master-only / always-on).
type NavDef = { label: string; icon: React.ElementType; path: string; badge: string | null; permission?: string };

const navItems: NavDef[] = [
  { label: 'Dashboard',     icon: LayoutDashboard, path: ROUTE_PATHS.DASHBOARD, badge: null, permission: 'nav.dashboard' },
  { label: 'Prospect Hub',  icon: Target,          path: ROUTE_PATHS.LEADS,     badge: null, permission: 'nav.leads' },
  { label: 'Clients',       icon: Users,           path: ROUTE_PATHS.CLIENTS,   badge: null, permission: 'nav.clients' },
  { label: 'Calendar',      icon: Calendar,        path: ROUTE_PATHS.CALENDAR,  badge: null, permission: 'nav.calendar' },
  { label: 'Documents',     icon: Folder,          path: ROUTE_PATHS.DOCUMENTS, badge: null, permission: 'nav.documents' },
  { label: 'Listing',       icon: Building2,       path: ROUTE_PATHS.LISTING,   badge: null, permission: 'nav.listing' },
];

const secondaryNavItems: NavDef[] = [
  { label: 'Admin Control', icon: Shield,   path: ROUTE_PATHS.ADMIN,    badge: null },
  { label: 'Settings',      icon: Settings, path: ROUTE_PATHS.SETTINGS, badge: null },
];

function tierTone(tier: UserTier | undefined): { bg: string; text: string } {
  switch (tier) {
    case 'Staff':          return { bg: '#F3F4F6', text: '#374151' };
    case 'Branch Manager': return { bg: '#FEF3C7', text: '#92400E' };
    case 'Branch Partner': return { bg: '#EDE9FE', text: '#7C3AED' };
    case 'Agent':
    default:               return { bg: '#E0F2FE', text: '#0369A1' };
  }
}

function roleTone(role: Role): { bg: string; text: string } {
  return ROLES.find((r) => r.id === role)?.tone ?? { bg: '#F3F4F6', text: '#374151' };
}

function roleLabel(role: Role): string {
  return ROLES.find((r) => r.id === role)?.label ?? 'Member';
}

// ─── Sidebar width states ─────────────────────────────────────────────────────
// 'expanded' = 256px, 'collapsed' = 64px (icon rail), 'hidden' = 0px
type SidebarState = 'expanded' | 'collapsed' | 'hidden';

function sidebarPx(state: SidebarState): number {
  if (state === 'expanded') return 256;
  if (state === 'collapsed') return 64;
  return 0;
}

// ─── Sidebar Nav Item ─────────────────────────────────────────────────────────
function NavItem({
  item,
  collapsed,
}: {
  item: NavDef;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  const inner = (isActive: boolean) => {
    if (collapsed) {
      return (
        <span
          className="flex items-center justify-center mx-auto w-10 h-10 rounded-xl transition-all duration-150 cursor-pointer"
          style={
            isActive
              ? { background: '#DAF3F2', boxShadow: '0 2px 8px rgba(30,201,196,0.12)' }
              : {}
          }
        >
          <Icon
            size={18}
            className="flex-shrink-0"
            style={{ color: isActive ? '#1EC9C4' : '#4B4F55' }}
          />
        </span>
      );
    }

    return (
      <span
        style={
          isActive
            ? {
                background: '#1EC9C4',
                color: 'white',
                boxShadow: '0 4px 14px rgba(30,201,196,0.35)',
              }
            : {}
        }
        className={[
          'flex items-center gap-3 px-3 py-2.5 transition-all duration-150 cursor-pointer rounded-full',
          isActive ? '' : 'text-[#4B4F55] hover:text-[#1EC9C4] hover:bg-[#F5F7FA]',
        ].join(' ')}
      >
        <Icon
          size={17}
          className="flex-shrink-0"
          style={{ color: isActive ? 'white' : undefined }}
        />

        <span
          className="text-sm font-semibold flex-1 whitespace-nowrap"
          style={{ color: isActive ? 'white' : '#4B4F55' }}
        >
          {item.label}
        </span>

        {item.badge && !isActive && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: '#E3F2FC', color: '#3D8FF4' }}
          >
            {item.badge}
          </span>
        )}

        {isActive && (
          <ChevronRight size={14} strokeWidth={2.5} className="flex-shrink-0 text-white" />
        )}
      </span>
    );
  };

  const link = (
    <NavLink to={item.path} className={collapsed ? 'block w-full' : 'block w-full px-3'}>
      {({ isActive }) => inner(isActive)}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }
  return link;
}

// ─── User Profile Card ────────────────────────────────────────────────────────
function UserCard({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  // Subscribe to the auth store so name/tier/avatar changes re-render this
  // card immediately — no more "press refresh to see the new tag".
  const profile = useAuthStore((s) => s.profile);
  const user    = useAuthStore((s) => s.user);
  const userName     = profile?.display_name || user?.name || user?.email?.split('@')[0] || 'User';
  const userInitials = userName.split(' ').map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase() || 'U';
  const userTier     = profile?.tier ?? 'Agent';
  const avatarColor  = profile?.avatar_color || DEFAULT_AVATAR_COLOR;
  const avatarUrl    = profile?.avatar_url || null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(userName);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const handleSignOut = async () => {
    // Hard-reload through signOutAndReset — closes realtime subscriptions,
    // clears zustand stores, and drops per-tab sessionStorage state.
    await signOutAndReset();
  };

  const startEdit = () => { setDraft(userName); setEditing(true); };
  const cancelEdit = () => { setDraft(userName); setEditing(false); };
  const saveEdit = async () => {
    const next = draft.trim();
    if (!next || next === userName) { cancelEdit(); return; }
    try { await setNickname(next); }
    catch (e) { console.error('setNickname', e); }
    setEditing(false);
  };

  if (collapsed) {
    return (
      <div className="px-2 pb-4 space-y-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center mx-auto cursor-default overflow-hidden"
              style={{ background: avatarColor }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                : <span className="text-xs font-bold text-white">{userInitials}</span>}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">{userName} · {userTier}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleSignOut} className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto hover:bg-[#F5F7FA] transition-colors">
              <LogOut size={15} style={{ color: '#A1A9B6' }} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign Out</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-3 pb-4 pt-3 border-t" style={{ borderColor: '#E8EBEF' }}>
      {/* User identity (click name to edit nickname) */}
      <div className="flex items-center gap-2.5 px-1 py-2 group">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: avatarColor }}
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            : <span className="text-xs font-bold text-white">{userInitials}</span>}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              maxLength={32}
              className="w-full text-sm font-bold border-b outline-none bg-transparent"
              style={{ color: '#2B3340', borderColor: '#1EC9C4' }}
            />
          ) : (
            <button
              onClick={startEdit}
              title="Click to edit nickname"
              className="text-sm font-bold truncate text-left w-full hover:text-[#1EC9C4] transition-colors flex items-center gap-1.5"
              style={{ color: '#2B3340' }}
            >
              <span className="truncate">{userName}</span>
              <Pencil size={11} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: '#A1A9B6' }} />
            </button>
          )}
          <p className="text-xs truncate" style={{ color: '#A1A9B6' }}>{userTier}</p>
        </div>
        {editing && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onMouseDown={(e) => { e.preventDefault(); saveEdit(); }} title="Save" className="p-1 rounded hover:bg-gray-100">
              <CheckIcon size={12} style={{ color: '#1EC9C4' }} strokeWidth={3} />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }} title="Cancel" className="p-1 rounded hover:bg-gray-100">
              <X size={12} style={{ color: '#A1A9B6' }} />
            </button>
          </div>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 w-full px-1 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors mt-1">
        <LogOut size={15} style={{ color: '#A1A9B6' }} />
        <span className="text-sm" style={{ color: '#A1A9B6' }}>Sign Out</span>
      </button>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({
  state,
  onToggle,
}: {
  state: SidebarState;
  onToggle: () => void;
}) {
  const collapsed = state === 'collapsed';
  const width = sidebarPx(state);

  // Reactive: re-render when the user's role changes (master_admin gated)
  // OR when an admin tweaks the permission matrix.
  const profile = useAuthStore((s) => s.profile);
  const meRole: Role = profile?.role ?? 'viewer';
  // Subscribing to `perms` keeps the sidebar in sync the moment Admin Control
  // saves a change — no refresh required, even for the affected user.
  const perms = usePermsStore((s) => s.perms);

  // Admin Control visible when: master_admin OR any sub-panel granted.
  const adminAccess = profile?.admin_access ?? [];
  const canSeeAdmin = meRole === 'master_admin' || adminAccess.length > 0;
  const visibleSecondary = useMemo(() => secondaryNavItems.filter((item) =>
    item.path === ROUTE_PATHS.ADMIN ? canSeeAdmin : true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [meRole, canSeeAdmin]);

  const visibleNav = useMemo(
    () => navItems.filter((item) => !item.permission || canDo(meRole, item.permission)),
    // `perms` participates so re-render fires when the matrix shifts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meRole, perms],
  );

  return (
    <>
      {/* Sidebar panel */}
      <aside
        style={{
          width,
          transition: 'width 0.25s cubic-bezier(.4,0,.2,1)',
          background: '#FFFFFF',
          borderRight: width > 0 ? '1px solid #E8EBEF' : 'none',
        }}
        className="flex flex-col h-screen fixed left-0 top-0 z-40 overflow-hidden"
      >
        {/* Logo row */}
        <div
          className={[
            'h-16 flex items-center flex-shrink-0',
            collapsed ? 'justify-center px-0' : 'justify-start px-4',
          ].join(' ')}
          style={{ borderBottom: '1px solid #E8EBEF' }}
        >
          {collapsed ? (
            <img src="/logo-icon.png" alt="whyEstate" className="h-8 w-8 select-none" draggable={false} />
          ) : (
            <img src="/logo-wordmark.png" alt="whyEstate" className="h-12 w-auto select-none" draggable={false} />
          )}
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden pt-3 pb-1 space-y-0.5">
          {visibleNav.map((item) => (
            <NavItem key={item.path} item={item} collapsed={collapsed} />
          ))}
        </nav>

        {/* Secondary nav (admin / settings) — admin shown only to master admin */}
        <div className="pt-2 pb-1 space-y-0.5 border-t" style={{ borderColor: '#E8EBEF' }}>
          {visibleSecondary.map((item) => (
            <NavItem key={item.path} item={item} collapsed={collapsed} />
          ))}
        </div>

        {/* User card */}
        <UserCard collapsed={collapsed} />
      </aside>

      {/* Floating toggle button on the sidebar edge */}
      {state !== 'hidden' && (
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            position: 'fixed',
            left: width - 14,
            top: 28,
            zIndex: 50,
            transition: 'left 0.25s cubic-bezier(.4,0,.2,1)',
            width: 28,
            height: 28,
            background: '#FFFFFF',
            border: '1px solid #E8EBEF',
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#A1A9B6',
          }}
          className="hover:border-[#1EC9C4] hover:text-[#1EC9C4] transition-colors"
        >
          {collapsed
            ? <ChevronRight size={14} strokeWidth={2.5} />
            : <ChevronLeft  size={14} strokeWidth={2.5} />
          }
        </button>
      )}
    </>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────
function TopBar({
  sidebarWidth,
  sidebarHidden,
  onShowSidebar,
}: {
  sidebarWidth: number;
  sidebarHidden: boolean;
  onShowSidebar: () => void;
}) {
  const navigate = useNavigate();
  // Subscribe to the store — every tier/avatar/name change re-renders the topbar.
  const profile = useAuthStore((s) => s.profile);
  const user    = useAuthStore((s) => s.user);
  const userName     = profile?.display_name || user?.name || user?.email?.split('@')[0] || 'User';
  const userEmail    = profile?.email || user?.email || '';
  const userTier     = profile?.tier ?? 'Agent';
  const userRole     = profile?.role ?? 'viewer';
  const userRoleLbl   = userTier;
  const userRoleStyle = tierTone(userTier);
  const userInitials = userName.split(' ').map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase() || 'U';
  const avatarColor  = profile?.avatar_color || DEFAULT_AVATAR_COLOR;
  const avatarUrl    = profile?.avatar_url || null;
  const isMaster     = userRole === 'master_admin';
  // Topbar dropdown shows Admin Control for master + any delegated admin.
  const topbarAdminAccess = profile?.admin_access ?? [];
  const showAdminLink     = isMaster || topbarAdminAccess.length > 0;
  void roleTone; void roleLabel; // kept for future role-badge use

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const handleSignOut = async () => {
    await signOutAndReset();
  };

  return (
    <header
      className="fixed top-0 right-0 z-30 h-16 flex items-center px-6 gap-4"
      style={{
        left: sidebarWidth,
        transition: 'left 0.25s cubic-bezier(.4,0,.2,1)',
        background: '#FFFFFF',
        borderBottom: '1px solid #E8EBEF',
      }}
    >
      {/* Hamburger — only when sidebar is hidden */}
      {sidebarHidden && (
        <button
          onClick={onShowSidebar}
          title="Show sidebar"
          className="p-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors mr-1 flex-shrink-0"
          style={{ color: '#A1A9B6' }}
        >
          <Menu size={20} />
        </button>
      )}

      <div className="flex-1" />

      {/* User profile button + dropdown */}
      <div ref={menuRef} className="relative flex-shrink-0">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-[#F5F7FA] transition-colors">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: avatarColor }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : <span className="text-xs font-bold text-white">{userInitials}</span>}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-semibold leading-tight" style={{ color: '#4B4F55' }}>{userName}</p>
            <p className="text-xs leading-tight" style={{ color: '#A1A9B6' }}>{userRoleLbl}</p>
          </div>
          <ChevronDown size={14} style={{ color: '#A1A9B6' }} />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1 min-w-[220px] bg-white rounded-xl border border-gray-100 py-1 z-50"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            <div className="px-3 py-2.5 border-b border-gray-100">
              <p className="text-sm font-bold truncate" style={{ color: '#2B3340' }}>{userName}</p>
              <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{userEmail}</p>
              <span className="inline-block mt-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: userRoleStyle.bg, color: userRoleStyle.text }}>
                {userRoleLbl}
              </span>
            </div>
            {showAdminLink && (
              <button onClick={() => { setMenuOpen(false); navigate(ROUTE_PATHS.ADMIN); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors text-left"
                style={{ color: '#374151' }}>
                <Shield size={13} className="text-gray-400" /> Admin Control
              </button>
            )}
            <button onClick={() => { setMenuOpen(false); navigate(ROUTE_PATHS.SETTINGS); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors text-left"
              style={{ color: '#374151' }}>
              <Settings size={13} className="text-gray-400" /> My Profile
            </button>
            <div className="my-1 border-t border-gray-100" />
            <button onClick={() => { setMenuOpen(false); handleSignOut(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-red-50 transition-colors text-left"
              style={{ color: '#DC2626' }}>
              <LogOut size={13} /> Sign Out
            </button>
          </div>
        )}
      </div>

    </header>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
const SIDEBAR_STORAGE_KEY = 'we.sidebar_state';

function loadSidebarState(): SidebarState {
  if (typeof window === 'undefined') return 'expanded';
  try {
    const v = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (v === 'collapsed' || v === 'expanded' || v === 'hidden') return v;
  } catch { /* ignore */ }
  return 'expanded';
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarState, setSidebarState] = useState<SidebarState>(loadSidebarState);

  // Persist sidebar preference across refreshes.
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarState); }
    catch { /* ignore quota */ }
  }, [sidebarState]);

  // The previous cycle was expanded → collapsed → hidden, which surprised
  // users — once hidden, the only way back was the topbar hamburger. The new
  // cycle stays inside the two visible states (expanded ↔ collapsed); use
  // the topbar hamburger to actually hide.
  const toggleSidebar = () => {
    setSidebarState((s) => (s === 'expanded' ? 'collapsed' : 'expanded'));
  };

  const showSidebar = () => setSidebarState('expanded');

  const sw = sidebarPx(sidebarState);

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Sidebar state={sidebarState} onToggle={toggleSidebar} />
      <TopBar sidebarWidth={sw} sidebarHidden={sidebarState === 'hidden'} onShowSidebar={showSidebar} />
      <main
        className="pt-16 min-h-screen"
        style={{ marginLeft: sw, transition: 'margin-left 0.25s cubic-bezier(.4,0,.2,1)' }}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
