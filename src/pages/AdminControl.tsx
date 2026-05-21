import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Check, RotateCcw, Save, ChevronLeft, ChevronRight, Settings2, Search, Users as UsersIcon,
  KeyRound, UserPlus, X, AlertCircle, Pencil, Copy,
} from 'lucide-react';
import {
  PERMISSIONS, PERMISSION_GROUPS, ROLES,
  resetRolePerms,
  getUserRole, setUserRole,
  type Role, type RolePerms,
} from '@/lib/permissions';
import {
  getCurrentUser, listAllUsers, refreshDirectory, useAuthStore, requestPasswordReset,
  getAvatarColor, getAvatarImage, getUserTier, USER_TIERS,
  type DirectoryUser, type UserTier,
} from '@/lib/auth';
import { loadRolePerms, saveRolePerms as saveRolePermsApi } from '@/api/permissions';
import { adminUpdateProfile, adminSetUserTier, deleteUser } from '@/api/profiles';
import { createInvite, listInvites, revokeInvite, type Invite } from '@/api/invites';
import { supabase } from '@/lib/supabase';
import { confirm } from '@/components/ConfirmDialog';
import { notifySuccess, notifyError } from '@/lib/notify';

type Section = 'main' | 'prospect-hub' | 'user-setting';

export default function AdminControl() {
  const [section, setSection] = useState<Section>('main');

  if (section === 'prospect-hub') {
    return <ProspectHubSettings onBack={() => setSection('main')} />;
  }
  if (section === 'user-setting') {
    return <UserSetting onBack={() => setSection('main')} />;
  }
  return (
    <AdminMain
      onOpenProspectHub={() => setSection('prospect-hub')}
      onOpenUserSetting={() => setSection('user-setting')}
    />
  );
}

// ─── Main admin landing ─────────────────────────────────────────────────────
function AdminMain({ onOpenProspectHub, onOpenUserSetting }: { onOpenProspectHub: () => void; onOpenUserSetting: () => void }) {
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

      {/* Module sections */}
      <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Modules</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <button onClick={onOpenUserSetting}
          className="text-left rounded-2xl border bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg flex items-start gap-3"
          style={{ borderColor: '#E5E7EB' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FEF3C7' }}>
            <UsersIcon size={18} style={{ color: '#92400E' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: '#1A202C' }}>User Setting</p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Assign a role to each user</p>
          </div>
          <ChevronRight size={16} style={{ color: '#9CA3AF' }} />
        </button>

        <button onClick={onOpenProspectHub}
          className="text-left rounded-2xl border bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg flex items-start gap-3"
          style={{ borderColor: '#E5E7EB' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#DAF3F2' }}>
            <Settings2 size={18} style={{ color: '#0F766E' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: '#1A202C' }}>Permission Matrix</p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Sidebar visibility + per-role Prospect Hub controls</p>
          </div>
          <ChevronRight size={16} style={{ color: '#9CA3AF' }} />
        </button>
      </div>
    </div>
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
function listKnownUsers(): DirectoryUser[] {
  return [...listAllUsers()].sort((a, b) => a.email.localeCompare(b.email));
}

function UsersTable() {
  const me = getCurrentUser();
  const myEmail = (me?.email ?? '').toLowerCase();
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);
  const [showAddUser, setShowAddUser] = useState(false);
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

  const users = useMemo(() => listKnownUsers(), [tick]);
  const filtered = users.filter((u) => {
    if (!q) return true;
    const lower = q.toLowerCase();
    return u.email.toLowerCase().includes(lower) || (u.name ?? '').toLowerCase().includes(lower);
  });

  // Resolve a directory user → underlying profile id via the auth store.
  const profileIdFor = (email: string): string | null => {
    const lower = email.toLowerCase();
    return useAuthStore.getState().directory.find((p) => p.email.toLowerCase() === lower)?.id ?? null;
  };

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

  const handleRemove = async (u: DirectoryUser) => {
    const ok = await confirm({
      title: `Remove ${u.name || u.email}?`,
      description: `Their boards, clients, calendar events, and files will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Remove user',
      destructive: true,
    });
    if (!ok) return;
    const id = profileIdFor(u.email);
    if (!id) return;
    try {
      await deleteUser(id);
      await refreshDirectory();
      setTick((t) => t + 1);
      notifySuccess(`${u.name || u.email} removed`);
    } catch (e) {
      notifyError('Could not remove user', e);
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
        <button
          onClick={async () => { await refreshDirectory(); setTick((t) => t + 1); }}
          title="Re-fetch the latest directory state from Supabase"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-gray-50 transition-colors"
          style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}>
          <Save size={13} /> Refresh
        </button>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: '#1EC9C4' }}>
          <UserPlus size={13} /> Add User
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
              <th style={{ textAlign: 'left',  padding: '10px 12px', width: 180 }}>Tier</th>
              <th style={{ textAlign: 'left',  padding: '10px 12px', width: 180 }}>Permission</th>
              <th style={{ textAlign: 'center', padding: '10px 12px', width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-xs" style={{ color: '#9CA3AF' }}>No users yet.</td></tr>
            ) : filtered.map((u) => {
              const role = getUserRole(u.email);
              const tier = getUserTier(u.email);
              const isMe = u.email.toLowerCase() === myEmail;
              const initials = (u.name || u.email).split(' ').map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase();
              return (
                <tr key={u.email} style={{ borderBottom: '1px solid #F1F5F9' }}>
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
                    <TierPicker value={tier} onChange={(t) => handleTierChange(u.email, t)} />
                  </td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                    <RolePicker value={role} onChange={(r) => handleRoleChange(u.email, r)} />
                  </td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setPwdTarget(u)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg border hover:bg-gray-50 transition-colors text-center"
                        style={{ color: '#6B7280', borderColor: '#E5E7EB', minWidth: 78 }}
                        title="Reset password for this user">
                        Reset PW
                      </button>
                      <button
                        disabled={isMe}
                        onClick={() => handleRemove(u)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg border hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-center"
                        style={{ color: '#DC2626', borderColor: '#FECACA', minWidth: 72 }}
                        title={isMe ? "You can't remove yourself" : 'Remove user'}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAddUser && (
        <AddUserModal
          existingEmails={users.map((u) => u.email)}
          onClose={() => setShowAddUser(false)}
          onCreated={() => { setShowAddUser(false); setTick((t) => t + 1); }}
        />
      )}
      {pwdTarget && (
        <ResetPasswordModal
          target={pwdTarget}
          onClose={() => setPwdTarget(null)}
        />
      )}
    </section>
  );
}

// ─── Add User modal — issues a single-use invite (real account is created
//     when the invitee signs up with the code on the public landing page).
function AddUserModal({ existingEmails, onClose, onCreated }: {
  existingEmails: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail]   = useState('');
  const [role,  setRole]    = useState<Role>('viewer');
  const [tier,  setTier]    = useState<UserTier>('Agent');
  const [busy,  setBusy]    = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [issued, setIssued] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const existingSet = useMemo(() => new Set(existingEmails.map((e) => e.toLowerCase())), [existingEmails]);

  const submit = async () => {
    setError(null);
    if (!validEmail(email))                    { setError('Please enter a valid email.'); return; }
    if (existingSet.has(email.toLowerCase()))  { setError('A user with this email already exists.'); return; }
    if (role === 'master_admin')               { setError('Master Admin cannot be granted via invite.'); return; }

    setBusy(true);
    try {
      const invite = await createInvite({ email: email.trim().toLowerCase(), role, tier });
      setIssued(invite);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invite');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!issued) return;
    try { await navigator.clipboard.writeText(issued.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* ignore */ }
  };

  // Master Admin can't be assigned via this form — it's gated to a single account.
  const invitableRoles = ROLES.filter((r) => r.id !== 'master_admin');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-[440px] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#DAF3F2' }}>
              <UserPlus size={15} style={{ color: '#0F766E' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>Invite user</h3>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                {issued ? 'Share the code below — it expires in 14 days' : 'Issue a one-time code; the invitee signs up themselves'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        {issued ? (
          <div className="px-6 pb-5 space-y-4">
            <div className="rounded-xl border px-3 py-3" style={{ borderColor: '#D1F2EF', background: '#F0FBFA' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#0F766E' }}>Invite code for {issued.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 text-lg font-mono font-bold tracking-[0.18em] text-center py-2 rounded-lg"
                  style={{ background: 'white', color: '#0F766E', border: '1px solid #D1F2EF' }}>{issued.code}</code>
                <button onClick={copy}
                  className="px-2.5 py-2 rounded-lg text-[11px] font-semibold flex items-center gap-1 hover:bg-[#DAF3F2]"
                  style={{ color: '#0F766E', border: '1px solid #D1F2EF', background: 'white' }}>
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <p className="text-[11px]" style={{ color: '#6B7280' }}>
              Send this to <strong>{issued.email}</strong> along with the sign-up URL. They'll be promoted to{' '}
              <strong>{ROLES.find((r) => r.id === issued.role)?.label}</strong> automatically once they redeem it.
            </p>
          </div>
        ) : (
          <div className="px-6 pb-5 space-y-4">
            <Field label="Email">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@whyestate.com" type="email"
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
            </Field>
            <Field label="Tier">
              <select value={tier} onChange={(e) => setTier(e.target.value as UserTier)}
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                style={{ borderColor: '#E5E7EB' }}>
                {USER_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Permission">
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                style={{ borderColor: '#E5E7EB' }}>
                {invitableRoles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </Field>
            {error && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> <span>{error}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
            {issued ? 'Done' : 'Cancel'}
          </button>
          {!issued && (
            <button onClick={submit} disabled={busy}
              className="px-5 py-1.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#1EC9C4' }}>
              {busy ? 'Issuing…' : 'Issue invite'}
            </button>
          )}
        </div>
      </div>
    </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: '#6B7280' }}>{label}</label>
      {children}
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

// ─── Prospect Hub Setting (permissions matrix) ──────────────────────────────
const EMPTY_PERMS: RolePerms = { master_admin: [], admin: [], editor: [], viewer: [] };

function ProspectHubSettings({ onBack }: { onBack: () => void }) {
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
      // Save only the editable rows.
      await Promise.all([
        saveRolePermsApi('admin',  perms.admin),
        saveRolePermsApi('editor', perms.editor),
        saveRolePermsApi('viewer', perms.viewer),
      ]);
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
            <Settings2 size={20} style={{ color: '#1EC9C4' }} />
            <h2 className="text-2xl font-bold" style={{ color: '#1A202C' }}>Permission Matrix</h2>
          </div>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
            Toggle which sidebar modules each role sees (Navigation group) and which actions they can take inside Prospect Hub. Master Admin always has full access.
          </p>
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
              {PERMISSION_GROUPS.map((group) => (
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
