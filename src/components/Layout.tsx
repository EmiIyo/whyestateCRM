import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Target,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Plus,
  Menu,
} from 'lucide-react';
import { ROUTE_PATHS } from '@/lib/index';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ─── Nav definition ──────────────────────────────────────────────────────────
const navItems: Array<{
  label: string;
  icon: React.ElementType;
  path: string;
  badge: string | null;
}> = [
  { label: 'Dashboard',    icon: LayoutDashboard, path: ROUTE_PATHS.DASHBOARD, badge: null },
  { label: 'Prospect Hub', icon: Target,          path: ROUTE_PATHS.LEADS,     badge: '20' },
];

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
  item: typeof navItems[0];
  collapsed: boolean;
}) {
  const Icon = item.icon;

  const inner = (isActive: boolean) => (
    <span
      style={
        isActive
          ? {
              background: '#DAF3F2',
              borderRadius: '0 10px 10px 0',
              color: '#1EC9C4',
              boxShadow: '0 2px 8px rgba(30,201,196,0.12)',
            }
          : {}
      }
      className={[
        'flex items-center gap-3 py-2.5 pr-3 transition-all duration-150 cursor-pointer relative',
        isActive ? 'pl-3' : 'pl-3 text-[#4B4F55] hover:text-[#1EC9C4] hover:bg-[#F5F7FA] rounded-r-[10px]',
      ].join(' ')}
    >
      {/* Active left bar */}
      {isActive && (
        <span
          className="absolute left-0 top-1 bottom-1 w-1 rounded-r-full"
          style={{ background: '#1EC9C4' }}
        />
      )}

      <Icon
        size={17}
        className="flex-shrink-0"
        style={{ color: isActive ? '#1EC9C4' : undefined }}
      />

      {!collapsed && (
        <span
          className="text-sm font-medium flex-1 whitespace-nowrap"
          style={{ color: isActive ? '#1EC9C4' : '#4B4F55' }}
        >
          {item.label}
        </span>
      )}

      {!collapsed && item.badge && (
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: '#E3F2FC', color: '#3D8FF4' }}
        >
          {item.badge}
        </span>
      )}
    </span>
  );

  const link = (
    <NavLink to={item.path} className="block w-full pr-3">
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
  if (collapsed) {
    return (
      <div className="px-2 pb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center mx-auto cursor-default"
              style={{ background: '#DAF3F2' }}
            >
              <span className="text-xs font-bold" style={{ color: '#1EC9C4' }}>AZ</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">Ahmad Zulkifli · Senior Agent</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-3 pb-4 space-y-3">
      {/* Card */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'linear-gradient(135deg, #27B1AD 0%, #1EC9C4 100%)' }}
      >
        {/* Avatar + name */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.25)' }}
          >
            <span className="text-sm font-bold text-white">AZ</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">Ahmad Zulkifli</p>
            <p className="text-xs text-white/70 leading-tight">REN: 12345 · Senior</p>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/80">April Target</span>
            <span className="text-xs font-bold text-white">72% reached</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: '72%', background: 'rgba(255,255,255,0.85)' }}
            />
          </div>
          <p className="text-xs text-white/60 mt-1">RM 210K / 291K</p>
        </div>
      </div>

      {/* Sign out */}
      <button className="flex items-center gap-2 w-full px-1 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors">
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
        <div className="h-16 flex items-center px-4 flex-shrink-0" style={{ borderBottom: '1px solid #E8EBEF' }}>
          {collapsed ? (
            <span className="text-lg font-black" style={{ color: '#1EC9C4' }}>W</span>
          ) : (
            <span className="flex items-baseline gap-0.5 select-none">
              <span className="text-xl font-black" style={{ color: '#1EC9C4' }}>why</span>
              <span className="text-xl font-semibold" style={{ color: '#4B4F55' }}>Estate</span>
            </span>
          )}
        </div>

        {/* Menu label */}
        {!collapsed && (
          <p className="text-xs font-semibold uppercase tracking-widest px-4 pt-5 pb-2" style={{ color: '#A1A9B6' }}>
            Menu
          </p>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1 space-y-0.5">
          {navItems.map((item) => (
            <NavItem key={item.path} item={item} collapsed={collapsed} />
          ))}
        </nav>

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
  const today = new Date();
  const formatted = today.toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

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

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold truncate" style={{ color: '#4B4F55' }}>Dashboard</h1>
        <p className="text-xs truncate" style={{ color: '#A1A9B6' }}>{formatted} · KL &amp; Selangor Market</p>
      </div>

      {/* Bell */}
      <button className="relative p-2 rounded-lg hover:bg-[#F5F7FA] transition-colors flex-shrink-0">
        <Bell size={18} style={{ color: '#A1A9B6' }} />
        <span
          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white"
          style={{ background: '#FF4F6C' }}
        />
      </button>

      {/* User */}
      <button className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-[#F5F7FA] transition-colors flex-shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: '#DAF3F2' }}
        >
          <span className="text-xs font-bold" style={{ color: '#1EC9C4' }}>AZ</span>
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-semibold leading-tight" style={{ color: '#4B4F55' }}>Ahmad Zulkifli</p>
          <p className="text-xs leading-tight" style={{ color: '#A1A9B6' }}>Senior Agent</p>
        </div>
        <ChevronDown size={14} style={{ color: '#A1A9B6' }} />
      </button>

      {/* New Deal button */}
      <button
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 flex-shrink-0"
        style={{ background: '#1EC9C4' }}
      >
        <Plus size={15} strokeWidth={2.5} />
        New Deal
      </button>
    </header>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarState, setSidebarState] = useState<SidebarState>('expanded');

  // Cycle: expanded → collapsed → expanded
  // But from TopBar hamburger: hidden → expanded
  const toggleSidebar = () => {
    setSidebarState((s) => {
      if (s === 'expanded') return 'collapsed';
      if (s === 'collapsed') return 'hidden';
      return 'expanded'; // hidden → expanded (shouldn't hit, handled by TopBar)
    });
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
