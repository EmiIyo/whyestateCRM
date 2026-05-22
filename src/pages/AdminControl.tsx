import { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck, Check, RotateCcw, Save, ChevronLeft, ChevronRight, Settings2, Search, Users as UsersIcon,
  KeyRound, X, AlertCircle, Pencil, ChevronDown, Clock,
} from 'lucide-react';
import {
  PERMISSIONS, PERMISSION_GROUPS, ROLES,
  resetRolePerms,
  saveRolePerms as saveRolePermsToStore,
  getUserRole, setUserRole,
  type Role, type RolePerms,
} from '@/lib/permissions';
import {
  getCurrentUser, listAllUsers, refreshDirectory, useAuthStore, requestPasswordReset,
  getAvatarColor, getAvatarImage, getUserTier, USER_TIERS,
  type DirectoryUser, type UserTier,
} from '@/lib/auth';
import { loadRolePerms } from '@/api/permissions';
import {
  adminUpdateProfile, adminSetUserTier, adminApproveUser, adminRejectUser,
  adminSetAdminAccess, ADMIN_PANELS, type AdminPanel,
} from '@/api/profiles';
import { supabase } from '@/lib/supabase';
import { confirm } from '@/components/ConfirmDialog';
import { notifySuccess, notifyError } from '@/lib/notify';

type Section = 'main' | 'prospect-hub' | 'user-setting' | 'sidebar-permissions';

export default function AdminControl() {
  const [section, setSection] = useState<Section>('main');
  // Subscribe to the auth store so admin_access changes (matrix saves,
  // realtime updates) re-render this guard immediately.
  const profile = useAuthStore((s) => s.profile);
  const isMaster = profile?.role === 'master_admin';
  const access = profile?.admin_access ?? [];

  const canUsers           = isMaster || access.includes('users');
  const canSidebarPerms    = isMaster || access.includes('sidebar_permissions');
  const canProspectHubPerms= isMaster || access.includes('prospect_hub_permissions');

  // If the user lost access to the sub-page they're on (e.g. admin
  // un-checked the box mid-session), drop them back to the landing.
  useEffect(() => {
    if (section === 'user-setting'        && !canUsers)            setSection('main');
    if (section === 'sidebar-permissions' && !canSidebarPerms)     setSection('main');
    if (section === 'prospect-hub'        && !canProspectHubPerms) setSection('main');
  }, [section, canUsers, canSidebarPerms, canProspectHubPerms]);

  if (section === 'prospect-hub' && canProspectHubPerms) {
    return <ProspectHubSettings onBack={() => setSection('main')} />;
  }
  if (section === 'user-setting' && canUsers) {
    return <UserSetting onBack={() => setSection('main')} />;
  }
  if (section === 'sidebar-permissions' && canSidebarPerms) {
    return <SidebarPermissionsSettings onBack={() => setSection('main')} />;
  }
  return (
    <AdminMain
      onOpenProspectHub={() => setSection('prospect-hub')}
      onOpenUserSetting={() => setSection('user-setting')}
      onOpenSidebarPermissions={() => setSection('sidebar-permissions')}
      canUsers={canUsers}
      canSidebarPerms={canSidebarPerms}
      canProspectHubPerms={canProspectHubPerms}
    />
  );
}

// ─── Main admin landing ─────────────────────────────────────────────────────
function AdminMain({ onOpenProspectHub, onOpenUserSetting, onOpenSidebarPermissions, canUsers, canSidebarPerms, canProspectHubPerms }: {
  onOpenProspectHub: () => void;
  onOpenUserSetting: () => void;
  onOpenSidebarPermissions: () => void;
  canUsers: boolean;
  canSidebarPerms: boolean;
  canProspectHubPerms: boolean;
}) {
  return (
    <div className="flex-1 px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} style={{ color: '#1EC9C4' }} />
            <h2 className="text-2xl font-bold" style={{ color: '#1A202C' }}>Admin Control</h2>
          </div>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
            Manage modules, assign roles to users, and control what each role can do.
          </p>
        </div>
      </div>

      {/* All three cards always render so every admin sees the full landscape.
          Cards the current user can't open are disabled with a "Locked" badge
          — they can see what exists without being able to navigate in. */}
      <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Modules</p>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <AdminCard
          accessible={canUsers}
          onOpen={onOpenUserSetting}
          iconBg="#FEF3C7"
          icon={<UsersIcon size={18} style={{ color: '#92400E' }} />}
          title="User Setting"
          description="Assign a role to each user"
        />
        <AdminCard
          accessible={canProspectHubPerms}
          onOpen={onOpenProspectHub}
          iconBg="#DAF3F2"
          icon={<Settings2 size={18} style={{ color: '#0F766E' }} />}
          title="Prospect Hub Permissions"
          description="What each role can do inside Prospect Hub"
        />
        <AdminCard
          accessible={canSidebarPerms}
          onOpen={onOpenSidebarPermissions}
          iconBg="#E0F2FE"
          icon={<ChevronRight size={18} style={{ color: '#0369A1' }} />}
          title="Sidebar Permissions"
          description="Which modules each role can see in the sidebar"
        />
      </div>
    </div>
  );
}

// ─── Single landing card — same shape whether the user can open it or not.
// `accessible=false` dims the card and disables click; this way a delegated
// admin can still see the full set of panels that exist in the workspace,
// they just can't navigate into the ones they weren't granted. The route
// guard inside `AdminControl` enforces access at the navigation level, so
// disabling the button is purely a UX shortcut to avoid the bounce-back.
function AdminCard({ accessible, onOpen, icon, iconBg, title, description }: {
  accessible: boolean;
  onOpen: () => void;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <button
      disabled={!accessible}
      onClick={onOpen}
      title={accessible ? undefined : 'You do not have access to this panel'}
      className="text-left rounded-2xl border bg-white p-5 transition-all flex items-start gap-3 enabled:hover:-translate-y-0.5 enabled:hover:shadow-lg disabled:opacity-55 disabled:cursor-not-allowed"
      style={{ borderColor: '#E5E7EB' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: '#1A202C' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{description}</p>
      </div>
      {accessible ? (
        <ChevronRight size={16} style={{ color: '#9CA3AF' }} />
      ) : (
        <span
          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
          Locked
        </span>
      )}
    </button>
  );
}

// ─── User Setting sub-page ──────────────────────────────────────────────────
function UserSetting({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 px-6 py-6">
      <button onClick={onBack}
        className="flex items-center gap-1 text-xs font-medium mb-3 hover:text-[#1EC9C4] transition-colors"
        style={{ color: '#6B7280' }}>
        <ChevronLeft size={14} /> Admin Control
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <UsersIcon size={20} style={{ color: '#1EC9C4' }} />
            <h2 className="text-2xl font-bold" style={{ color: '#1A202C' }}>User Setting</h2>
          </div>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
            Assign a role to each user — Master Admin, Admin, Editor, or Viewer.
          </p>
        </div>
      </div>

      <UsersTable />
    </div>
  );
}

// ─── Users table — assign roles ─────────────────────────────────────────────
// Source of truth: the profiles table via the auth store. The legacy
// localStorage `we.crm.state` merge is gone — every user is now a real
// Supabase Auth account, and the trigger handle_new_user keeps profiles in
// sync on every signup.
// Sort pending users (approved_at IS NULL) to the top so admins see fresh
// signup requests first; within each group keep alphabetical-by-email so the
// list doesn't reshuffle on every realtime tick.
function listKnownUsers(directory: ReturnType<typeof useAuthStore.getState>['directory']): DirectoryUser[] {
  const pendingEmails = new Set(
    directory.filter((p) => !p.approved_at).map((p) => p.email.toLowerCase()),
  );
  return [...listAllUsers()].sort((a, b) => {
    const ap = pendingEmails.has(a.email.toLowerCase()) ? 0 : 1;
    const bp = pendingEmails.has(b.email.toLowerCase()) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.email.localeCompare(b.email);
  });
}

function UsersTable() {
  const me = getCurrentUser();
  const myEmail = (me?.email ?? '').toLowerCase();
  // Subscribe so admin_access edits made elsewhere (or this row's own
  // dropdown) re-render the table immediately — directory is the source of
  // truth for both the row identity (id), the access array, and the
  // approved_at timestamp that drives pending vs active rendering.
  const directory = useAuthStore((s) => s.directory);
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);
  const [pwdTarget, setPwdTarget] = useState<DirectoryUser | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  // Live updates when any admin (including on another device) edits roles,
  // tiers, names, or removes users. The auth store directory is the source of
  // truth — refetch + bump tick to re-render derived rows.
  useEffect(() => {
    void refreshDirectory();
    const ch = supabase.channel('admin-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => {
        await refreshDirectory();
        setTick((t) => t + 1);
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const users = useMemo(() => listKnownUsers(directory), [tick, directory]);
  const pendingCount = useMemo(
    () => directory.filter((p) => !p.approved_at).length,
    [directory],
  );
  const filtered = users.filter((u) => {
    if (!q) return true;
    const lower = q.toLowerCase();
    return u.email.toLowerCase().includes(lower) || (u.name ?? '').toLowerCase().includes(lower);
  });

  // Resolve a directory user → underlying profile row via the auth store.
  const profileFor = (email: string) => {
    const lower = email.toLowerCase();
    return directory.find((p) => p.email.toLowerCase() === lower) ?? null;
  };
  const profileIdFor = (email: string): string | null => profileFor(email)?.id ?? null;

  const handleRoleChange = async (email: string, role: Role) => {
    try { await setUserRole(email, role); await refreshDirectory(); setTick((t) => t + 1); }
    catch (e) { notifyError('Could not change role', e); }
  };
  const handleTierChange = async (email: string, tier: UserTier) => {
    const id = profileIdFor(email);
    if (!id) return;
    try { await adminSetUserTier(id, tier); await refreshDirectory(); setTick((t) => t + 1); }
    catch (e) { notifyError('Could not change tier', e); }
  };
  const handleAdminAccessChange = async (email: string, next: AdminPanel[]) => {
    const id = profileIdFor(email);
    if (!id) return;
    try { await adminSetAdminAccess(id, next); await refreshDirectory(); setTick((t) => t + 1); }
    catch (e) { notifyError('Could not update admin access', e); }
  };

  const startEdit = (u: DirectoryUser) => { setEditingEmail(u.email); setDraftName(u.name || ''); };
  const cancelEdit = () => { setEditingEmail(null); setDraftName(''); };
  const saveEdit = async (u: DirectoryUser) => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== u.name) {
      try {
        const id = profileIdFor(u.email);
        if (id) {
          await adminUpdateProfile(id, { display_name: trimmed });
          await refreshDirectory();
        }
        setTick((t) => t + 1);
      } catch (e) { notifyError('Could not rename user', e); }
    }
    setEditingEmail(null);
    setDraftName('');
  };

  // Approve uses whatever role / tier / admin_access the admin set via the
  // row pickers (defaults: viewer + Agent + []), then flips approved_at +
  // approved_by atomically. Realtime sub on the target user's profile flips
  // them off the /pending screen the moment this lands.
  const handleApprove = async (u: DirectoryUser) => {
    const p = profileFor(u.email);
    if (!p) return;
    try {
      await adminApproveUser(
        p.id,
        p.role,
        p.tier,
        (p.admin_access ?? []) as AdminPanel[],
      );
      await refreshDirectory();
      setTick((t) => t + 1);
      notifySuccess(`${u.name || u.email} approved`);
    } catch (e) {
      notifyError('Could not approve user', e);
    }
  };

  // Reject = full hard delete from auth.users + cascade-deleted profile.
  // From the user's perspective their account simply "doesn't exist" — next
  // login attempt with the same email gets the generic invalid-credentials
  // error, exactly as if they'd never signed up. Same RPC backs the
  // "Remove" action on already-approved users so the behaviour is uniform.
  const handleReject = async (u: DirectoryUser, isPending: boolean) => {
    const ok = await confirm({
      title: isPending ? `Reject ${u.name || u.email}?` : `Remove ${u.name || u.email}?`,
      description: isPending
        ? `Their account will be permanently deleted. They can sign up again later if needed.`
        : `Their account, boards, clients, calendar events, and files will be permanently deleted. This cannot be undone.`,
      confirmLabel: isPending ? 'Reject' : 'Remove user',
      destructive: true,
    });
    if (!ok) return;
    const id = profileIdFor(u.email);
    if (!id) return;
    try {
      await adminRejectUser(id);
      await refreshDirectory();
      setTick((t) => t + 1);
      notifySuccess(isPending ? `${u.name || u.email} rejected` : `${u.name || u.email} removed`);
    } catch (e) {
      notifyError(isPending ? 'Could not reject user' : 'Could not remove user', e);
    }
  };

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Users</p>
        <div className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1.5 bg-white flex-1 max-w-xs focus-within:border-[#1EC9C4]">
          <Search size={13} style={{ color: '#A1A9B6' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email or name…"
            className="flex-1 text-xs outline-none bg-transparent placeholder:text-gray-300" />
        </div>
        {pendingCount > 0 && (
          <span
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md"
            style={{ background: '#FEF3C7', color: '#92400E' }}
            title="New signups waiting for an admin to approve them">
            <Clock size={10} /> {pendingCount} pending
          </span>
        )}
        <button
          onClick={async () => { await refreshDirectory(); setTick((t) => t + 1); }}
          title="Re-fetch the latest directory state from Supabase"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-gray-50 transition-colors"
          style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}>
          <Save size={13} /> Refresh
        </button>
        <span className="text-xs" style={{ color: '#9CA3AF' }}>{filtered.length} of {users.length}</span>
      </div>

      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E5E7EB', background: 'white' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead style={{ background: '#F8FAFB', borderBottom: '1px solid #E5E7EB' }}>
            <tr style={{ color: '#6B7280', fontSize: 11, fontWeight: 600 }}>
              <th style={{ textAlign: 'left',  padding: '10px 12px' }}>User</th>
              <th style={{ textAlign: 'left',  padding: '10px 12px' }}>Email</th>
              <th style={{ textAlign: 'left',  padding: '10px 12px' }}>Joined</th>
              <th style={{ textAlign: 'left',  padding: '10px 12px', width: 170 }}>Admin Access</th>
              <th style={{ textAlign: 'left',  padding: '10px 12px', width: 180 }}>Tier</th>
              <th style={{ textAlign: 'left',  padding: '10px 12px', width: 180 }}>Permission</th>
              <th style={{ textAlign: 'center', padding: '10px 12px', width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-xs" style={{ color: '#9CA3AF' }}>No users yet.</td></tr>
            ) : filtered.map((u) => {
              const role = getUserRole(u.email);
              const tier = getUserTier(u.email);
              const isMe = u.email.toLowerCase() === myEmail;
              const initials = (u.name || u.email).split(' ').map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase();
              const prof = profileFor(u.email);
              const isPending = !prof?.approved_at;
              return (
                <tr
                  key={u.email}
                  style={{
                    borderBottom: '1px solid #F1F5F9',
                    background: isPending ? '#FFFBEB' : undefined,
                  }}>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                    <div className="flex items-center gap-2.5 group/name">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                        style={{ background: getAvatarColor(u.email) }}>
                        {getAvatarImage(u.email)
                          ? <img src={getAvatarImage(u.email) as string} alt="" className="w-full h-full object-cover" />
                          : <span className="text-[10px] font-bold text-white">{initials}</span>}
                      </div>
                      {editingEmail === u.email ? (
                        <>
                          <input
                            autoFocus
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(u); if (e.key === 'Escape') cancelEdit(); }}
                            className="text-sm font-semibold border-b outline-none px-0 py-0.5 min-w-0"
                            style={{ color: '#374151', borderColor: '#1EC9C4', background: 'transparent' }}
                          />
                          <button onClick={() => saveEdit(u)}
                            className="p-1 rounded hover:bg-[#DAF3F2] flex-shrink-0"
                            title="Save"><Check size={12} className="text-[#0F766E]" strokeWidth={3} /></button>
                          <button onClick={cancelEdit}
                            className="p-1 rounded hover:bg-gray-100 flex-shrink-0"
                            title="Cancel"><X size={12} className="text-gray-400" /></button>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold" style={{ color: '#374151' }}>{u.name || '—'}</span>
                          <button onClick={() => startEdit(u)}
                            className="opacity-0 group-hover/name:opacity-100 p-1 rounded hover:bg-gray-100 transition-all flex-shrink-0"
                            title="Rename user"><Pencil size={11} className="text-gray-400" /></button>
                          {isPending && (
                            <span
                              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ background: '#FEF3C7', color: '#92400E' }}>
                              <Clock size={9} /> Pending
                            </span>
                          )}
                          {isMe && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ background: '#DAF3F2', color: '#0F766E' }}>You</span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                    <span className="font-mono text-xs" style={{ color: '#6B7280' }}>{u.email}</span>
                  </td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>{fmtDate(u.firstSeen)}</span>
                  </td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                    <AdminAccessPicker
                      access={(profileFor(u.email)?.admin_access ?? []) as AdminPanel[]}
                      // Master Admin has inherent full access through the role
                      // bypass, so the `admin_access` array is meaningless for
                      // them — surface that as an "All" lock instead of a
                      // misleading "0 permissions" count.
                      role={role}
                      onChange={(next) => handleAdminAccessChange(u.email, next)}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                    <TierPicker value={tier} onChange={(t) => handleTierChange(u.email, t)} />
                  </td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                    <RolePicker value={role} onChange={(r) => handleRoleChange(u.email, r)} />
                  </td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-center gap-2">
                      {isPending ? (
                        <>
                          <button
                            disabled={isMe}
                            onClick={() => handleApprove(u)}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white hover:opacity-90 disabled:opacity-30 transition-opacity text-center"
                            style={{ background: '#1EC9C4', minWidth: 78 }}
                            title={isMe ? "You can't approve yourself" : 'Approve this user with the role / tier / admin access shown'}>
                            Approve
                          </button>
                          <button
                            disabled={isMe}
                            onClick={() => handleReject(u, true)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg border hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-center"
                            style={{ color: '#DC2626', borderColor: '#FECACA', minWidth: 72 }}
                            title={isMe ? "You can't reject yourself" : 'Permanently delete this pending account'}>
                            Reject
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setPwdTarget(u)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg border hover:bg-gray-50 transition-colors text-center"
                            style={{ color: '#6B7280', borderColor: '#E5E7EB', minWidth: 78 }}
                            title="Reset password for this user">
                            Reset PW
                          </button>
                          <button
                            disabled={isMe}
                            onClick={() => handleReject(u, false)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg border hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-center"
                            style={{ color: '#DC2626', borderColor: '#FECACA', minWidth: 72 }}
                            title={isMe ? "You can't remove yourself" : 'Remove user'}>
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pwdTarget && (
        <ResetPasswordModal
          target={pwdTarget}
          onClose={() => setPwdTarget(null)}
        />
      )}
    </section>
  );
}

// ─── Reset password modal ───────────────────────────────────────────────────
// Supabase Auth handles password resets via email links — admins trigger the
// flow but the user clicks through the recovery link to set their own password.
function ResetPasswordModal({ target, onClose }: { target: DirectoryUser; onClose: () => void }) {
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [done, setDone]     = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(target.email);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-[420px] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FEF3C7' }}>
              <KeyRound size={15} style={{ color: '#B45309' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>Reset password</h3>
              <p className="text-xs mt-0.5 truncate max-w-[280px]" style={{ color: '#9CA3AF' }}>for {target.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="px-6 pb-5 space-y-4">
          <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
            Supabase will send a secure reset link to <strong>{target.email}</strong>. They'll click the link to choose a new password. Admins can't set passwords directly — keeps the user's credentials private.
          </p>
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#991B1B' }}>
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> <span>{error}</span>
            </div>
          )}
          {done && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#DCFCE7', color: '#166534' }}>
              <Check size={13} className="mt-0.5 flex-shrink-0" />
              <span>Reset link sent. {target.name || target.email} should check their inbox.</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button onClick={submit} disabled={busy}
              className="px-5 py-1.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#1EC9C4' }}>
              {busy ? 'Sending…' : 'Send reset email'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const tone = ROLES.find((r) => r.id === value)?.tone ?? { bg: '#F3F4F6', text: '#374151' };
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Role)}
      className="text-xs font-semibold border rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:border-[#1EC9C4]"
      style={{ background: tone.bg, color: tone.text, borderColor: 'transparent', minWidth: 150 }}>
      {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
    </select>
  );
}

const TIER_TONES: Record<UserTier, { bg: string; text: string }> = {
  'Agent':          { bg: '#E0F2FE', text: '#0369A1' },
  'Staff':          { bg: '#F3F4F6', text: '#374151' },
  'Branch Manager': { bg: '#FEF3C7', text: '#92400E' },
  'Branch Partner': { bg: '#EDE9FE', text: '#7C3AED' },
};

function TierPicker({ value, onChange }: { value: UserTier; onChange: (t: UserTier) => void }) {
  const tone = TIER_TONES[value] ?? TIER_TONES['Agent'];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as UserTier)}
      className="text-xs font-semibold border rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:border-[#1EC9C4]"
      style={{ background: tone.bg, color: tone.text, borderColor: 'transparent', minWidth: 150 }}>
      {USER_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

// ─── Admin Access picker — compact dropdown with one checkbox per sub-panel.
// Per-user delegation of which Admin Control panels they can open. A user
// with zero entries here does not see the Admin Control sidebar item at all.
// Identical UI for every row, including master_admin — the master role gets
// inherent full access via role checks elsewhere, so what's stored here is
// purely informational for them, but stays editable for consistency.
//
// The dropdown is portal-rendered to `document.body` (so the table wrapper's
// `overflow-hidden` — needed for the rounded corners — doesn't clip it on
// rows near the bottom of the page) and always opens downward, exactly as
// requested.
function AdminAccessPicker({ access, role, onChange }: {
  access: AdminPanel[];
  role: Role;
  onChange: (next: AdminPanel[]) => Promise<void> | void;
}) {
  // Master Admin always has full access through the role bypass. The pill
  // shows "All" locked so it doesn't look like they were granted 0 panels.
  const isMaster = role === 'master_admin';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const ddRef  = useRef<HTMLDivElement   | null>(null);

  const place = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setCoords({
      top:   rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  };

  // Open/close handlers — recompute position every open so it follows the
  // current scroll offset.
  const handleOpen = () => { place(); setOpen(true); };
  const handleClose = () => setOpen(false);

  // Close on outside click, Escape, scroll, or resize.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (ddRef.current?.contains(t))  return;
      setOpen(false);
    };
    const onKey    = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown',   onKey);
    // useCapture so we catch scrolls on inner scroll containers too.
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown',   onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const toggle = async (key: AdminPanel) => {
    if (busy) return;
    const set = new Set(access);
    if (set.has(key)) set.delete(key); else set.add(key);
    setBusy(true);
    try { await onChange(Array.from(set)); }
    finally { setBusy(false); }
  };

  const count  = access.length;
  const active = isMaster || count > 0;
  const label  = isMaster ? 'All' : `${count} permission${count === 1 ? '' : 's'}`;

  const ddStyle: React.CSSProperties = coords
    ? {
        position: 'fixed',
        top:   coords.top,
        right: coords.right,
        borderColor: '#E5E7EB',
        background:  'white',
        boxShadow:   '0 10px 30px rgba(0,0,0,0.12)',
      }
    : { display: 'none' };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={isMaster}
        onClick={() => (open ? handleClose() : handleOpen())}
        title={isMaster
          ? 'Master Admin has full access through their role — no explicit grants needed'
          : 'Choose which Admin Control panels this user can open'}
        className="text-xs font-semibold border rounded-lg px-2.5 py-1.5 outline-none focus:border-[#1EC9C4] inline-flex items-center gap-1.5 disabled:cursor-not-allowed enabled:cursor-pointer"
        style={{
          background: active ? '#DAF3F2' : '#F3F4F6',
          color:      active ? '#0F766E' : '#6B7280',
          borderColor: 'transparent',
          minWidth: 140,
          opacity: isMaster ? 0.85 : 1,
        }}>
        <span className="flex-1 text-left">{label}</span>
        {!isMaster && <ChevronDown size={12} />}
      </button>
      {open && coords && !isMaster && createPortal(
        <div ref={ddRef} className="z-50 w-64 rounded-xl border overflow-hidden" style={ddStyle}>
          <div
            className="px-3 py-2 border-b text-[10px] font-bold uppercase tracking-wider"
            style={{ color: '#9CA3AF', borderColor: '#F1F5F9', background: '#FAFBFC' }}>
            Admin Control sub-panels
          </div>
          <div className="py-1">
            {ADMIN_PANELS.map((p) => {
              const checked = access.includes(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={busy}
                  onClick={() => { void toggle(p.key); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed">
                  <span
                    className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: checked ? '#1EC9C4' : '#D1D5DB',
                      background:  checked ? '#1EC9C4' : 'white',
                    }}>
                    {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>
                  <span style={{ color: '#374151' }}>{p.label}</span>
                </button>
              );
            })}
          </div>
          <div
            className="px-3 py-2 border-t text-[11px]"
            style={{ color: '#9CA3AF', borderColor: '#F1F5F9', background: '#FAFBFC' }}>
            User sees Admin Control if at least one box is checked.
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Shared permission-matrix page ──────────────────────────────────────────
// Reused by ProspectHubSettings (everything except Navigation) and
// SidebarPermissionsSettings (only Navigation). Pass the group whitelist + the
// page header strings, the rest is identical.
const EMPTY_PERMS: RolePerms = { master_admin: [], admin: [], editor: [], viewer: [] };

interface MatrixPageProps {
  onBack: () => void;
  title: string;
  description: string;
  groups: string[];
  icon: React.ElementType;
}

function PermissionMatrixPage({ onBack, title, description, groups, icon: HeaderIcon }: MatrixPageProps) {
  const [perms, setPerms]     = useState<RolePerms>(EMPTY_PERMS);
  const [saved, setSaved]     = useState<RolePerms>(EMPTY_PERMS);
  const [loading, setLoading] = useState(true);
  const dirty = JSON.stringify(perms) !== JSON.stringify(saved);

  useEffect(() => {
    let alive = true;
    loadRolePerms().then((p) => {
      if (!alive) return;
      setPerms(p); setSaved(p); setLoading(false);
    }).catch((e) => {
      notifyError('Could not load permissions', e); setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const isChecked = (role: Role, key: string): boolean => {
    if (role === 'master_admin') return true;
    return (perms[role] ?? []).includes(key);
  };

  const toggle = (role: Role, key: string) => {
    if (role === 'master_admin') return;
    setPerms((prev) => {
      const list = new Set(prev[role] ?? []);
      if (list.has(key)) list.delete(key);
      else list.add(key);
      return { ...prev, [role]: Array.from(list) };
    });
  };

  const save = async () => {
    try {
      // Save through the lib helper — it writes to DB AND updates
      // `usePermsStore` in one go, so every page (sidebar, ProspectHub
      // buttons, modals) reflects the change instantly without a refresh.
      await saveRolePermsToStore(perms);
      setSaved(perms);
      notifySuccess('Permissions saved');
    } catch (e) { notifyError('Could not save permissions', e); }
  };

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset role permissions?',
      description: 'Admin, Editor and Viewer permissions revert to factory defaults. Custom changes you made will be lost.',
      confirmLabel: 'Reset',
      destructive: true,
    });
    if (!ok) return;
    try {
      await resetRolePerms();
      const fresh = await loadRolePerms();
      setPerms(fresh);
      setSaved(fresh);
      notifySuccess('Permissions reset to defaults');
    } catch (e) { notifyError('Could not reset permissions', e); }
  };

  if (loading) {
    return (
      <div className="flex-1 px-6 py-6">
        <p className="text-sm text-gray-400">Loading permissions…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 px-6 py-6">
      {/* Back link */}
      <button onClick={onBack}
        className="flex items-center gap-1 text-xs font-medium mb-3 hover:text-[#1EC9C4] transition-colors"
        style={{ color: '#6B7280' }}>
        <ChevronLeft size={14} /> Admin Control
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <HeaderIcon size={20} style={{ color: '#1EC9C4' }} />
            <h2 className="text-2xl font-bold" style={{ color: '#1A202C' }}>{title}</h2>
          </div>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>{description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={reset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            <RotateCcw size={13} /> Reset to defaults
          </button>
          <button onClick={save} disabled={!dirty}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#1EC9C4' }}>
            <Save size={14} /> {dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Role legend */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {ROLES.map((r) => (
          <span key={r.id}
            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md"
            style={{ background: r.tone.bg, color: r.tone.text }}>
            {r.label}
          </span>
        ))}
      </div>

      {/* Matrix */}
      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E5E7EB', background: 'white' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col />
              {ROLES.map((r) => <col key={r.id} style={{ width: 140 }} />)}
            </colgroup>
            <thead style={{ background: '#F8FAFB', borderBottom: '2px solid #E5E7EB' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: '#6B7280', whiteSpace: 'nowrap' }}>
                  Permission
                </th>
                {ROLES.map((r) => (
                  <th key={r.id}
                    style={{ textAlign: 'center', padding: '12px 8px', fontSize: 11, fontWeight: 700, color: r.tone.text, whiteSpace: 'nowrap' }}>
                    <div>{r.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <RowGroup key={group} group={group} perms={perms} isChecked={isChecked} toggle={toggle} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs mt-3" style={{ color: '#9CA3AF' }}>
        Changes save to Supabase (<code style={{ background: '#F3F4F6', padding: '1px 4px', borderRadius: 4 }}>role_permissions</code>) and propagate live to every signed-in member.
      </p>
    </div>
  );
}

// ─── Sidebar Permissions sub-page (Navigation group only) ───────────────────
function SidebarPermissionsSettings({ onBack }: { onBack: () => void }) {
  return (
    <PermissionMatrixPage
      onBack={onBack}
      title="Sidebar Permissions"
      description="Control which top-level modules each role sees in the sidebar. Master Admin always sees everything."
      groups={['Navigation']}
      icon={ChevronRight}
    />
  );
}

// ─── Prospect Hub Permissions sub-page (everything except Navigation) ───────
function ProspectHubSettings({ onBack }: { onBack: () => void }) {
  // Filter out the Navigation group — that lives on its own page now so the
  // two concerns (which modules a role sees vs. what they can do inside a
  // module) don't get tangled in one giant table.
  const groups = PERMISSION_GROUPS.filter((g) => g !== 'Navigation');
  return (
    <PermissionMatrixPage
      onBack={onBack}
      title="Prospect Hub Permissions"
      description="Toggle what each role can do inside Prospect Hub. Master Admin always has full access."
      groups={groups}
      icon={Settings2}
    />
  );
}

// ─── Permission group + matrix row ──────────────────────────────────────────
function RowGroup({ group, perms, isChecked, toggle }: {
  group: string;
  perms: RolePerms;
  isChecked: (role: Role, key: string) => boolean;
  toggle:    (role: Role, key: string) => void;
}) {
  const items = PERMISSIONS.filter((p) => p.group === group);

  const allCheckedFor = (role: Role) => {
    if (role === 'master_admin') return true;
    return items.every((it) => (perms[role] ?? []).includes(it.key));
  };

  return (
    <>
      <tr style={{ background: '#FAFBFC', borderTop: '1px solid #E5E7EB' }}>
        <td style={{ padding: '8px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF' }}>
          {group}
        </td>
        {ROLES.map((r) => {
          const all = allCheckedFor(r.id);
          return (
            <td key={r.id} style={{ textAlign: 'center', padding: '8px 8px', verticalAlign: 'middle' }}>
              <button
                disabled={r.locked}
                onClick={() => {
                  for (const it of items) {
                    const has = (perms[r.id] ?? []).includes(it.key);
                    if (all && has) toggle(r.id, it.key);
                    else if (!all && !has) toggle(r.id, it.key);
                  }
                }}
                className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md transition-colors disabled:cursor-not-allowed inline-flex items-center justify-center"
                style={{
                  background: all ? '#DAF3F2' : '#F3F4F6',
                  color: all ? '#0F766E' : '#9CA3AF',
                  opacity: r.locked ? 0.4 : 1,
                  minWidth: 44,
                }}>
                {all ? 'All' : 'Some'}
              </button>
            </td>
          );
        })}
      </tr>
      {items.map((p) => (
        <tr key={p.key} style={{ borderTop: '1px solid #F1F5F9', height: 44 }}>
          <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>{p.label}</td>
          {ROLES.map((r) => (
            <td key={r.id} style={{ textAlign: 'center', padding: '8px 8px', verticalAlign: 'middle' }}>
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={isChecked(r.id, p.key)}
                  disabled={r.locked}
                  onClick={() => toggle(r.id, p.key)}
                />
              </div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function Checkbox({ checked, onClick, disabled }: { checked: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={checked}
      className="w-5 h-5 rounded-md border flex items-center justify-center transition-all disabled:cursor-not-allowed"
      style={{
        borderColor: checked ? '#1EC9C4' : '#D1D5DB',
        background:  checked ? '#1EC9C4' : 'white',
        opacity: disabled ? 0.55 : 1,
      }}>
      {checked && <Check size={12} className="text-white" strokeWidth={3} />}
    </button>
  );
}
