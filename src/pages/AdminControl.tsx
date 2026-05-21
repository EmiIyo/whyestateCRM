import { useMemo, useState, useEffect } from 'react';
import {
  ShieldCheck, Check, RotateCcw, Save, ChevronLeft, ChevronRight, Settings2, Search, Users as UsersIcon,
  Eye, EyeOff, KeyRound, UserPlus, X, AlertCircle, Pencil,
} from 'lucide-react';
import {
  PERMISSIONS, PERMISSION_GROUPS, ROLES,
  loadRolePerms, saveRolePerms, resetRolePerms,
  getUserRole, setUserRole,
  type Role, type RolePerms,
} from '@/lib/permissions';
import {
  getCurrentUser, listAllUsers, removeUserFromDirectory, createUser, setPassword, setUserName,
  getAvatarColor, getAvatarImage, getUserTier, setUserTier, USER_TIERS,
  type DirectoryUser, type UserTier,
} from '@/lib/auth';

const MASTER_ADMIN_EMAIL = 'linux@whyestate.com';

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
            <p className="text-sm font-bold" style={{ color: '#1A202C' }}>Prospect Hub Setting</p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Configure permissions for each role</p>
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
// Source of truth: the user directory (every signup is recorded by auth.signIn).
// We also merge in board owners / members from CRM state so legacy accounts that
// pre-date the directory still appear.
function listKnownUsers(): DirectoryUser[] {
  const byEmail = new Map<string, DirectoryUser>();
  for (const u of listAllUsers()) {
    byEmail.set(u.email.toLowerCase(), u);
  }

  const stamp = new Date().toISOString();
  const me = getCurrentUser();
  if (me && !byEmail.has(me.email.toLowerCase())) {
    byEmail.set(me.email.toLowerCase(), { email: me.email, name: me.name, firstSeen: stamp, lastSeen: stamp });
  }

  try {
    const raw = localStorage.getItem('we.crm.state');
    if (raw) {
      const crm = JSON.parse(raw) as {
        boards?:  Array<{ ownerEmail?: string; ownerName?: string }>;
        members?: Record<string, Array<{ email: string }>>;
      };
      for (const b of crm.boards ?? []) {
        if (b.ownerEmail) {
          const k = b.ownerEmail.toLowerCase();
          if (!byEmail.has(k)) byEmail.set(k, { email: b.ownerEmail, name: b.ownerName ?? b.ownerEmail.split('@')[0], firstSeen: stamp, lastSeen: stamp });
        }
      }
      for (const list of Object.values(crm.members ?? {})) {
        for (const m of list) {
          const k = m.email.toLowerCase();
          if (!byEmail.has(k)) byEmail.set(k, { email: m.email, name: m.email.split('@')[0], firstSeen: stamp, lastSeen: stamp });
        }
      }
    }
  } catch { /* ignore */ }

  return Array.from(byEmail.values()).sort((a, b) => a.email.localeCompare(b.email));
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

  const users = useMemo(() => listKnownUsers(), [tick]);
  const filtered = users.filter((u) => {
    if (!q) return true;
    const lower = q.toLowerCase();
    return u.email.toLowerCase().includes(lower) || (u.name ?? '').toLowerCase().includes(lower);
  });

  const handleRoleChange = (email: string, role: Role) => {
    setUserRole(email, role);
    setTick((t) => t + 1); // force re-render so dropdowns reflect saved state
  };
  const handleTierChange = (email: string, tier: UserTier) => {
    setUserTier(email, tier);
    setTick((t) => t + 1);
  };

  const startEdit = (u: DirectoryUser) => { setEditingEmail(u.email); setDraftName(u.name || ''); };
  const cancelEdit = () => { setEditingEmail(null); setDraftName(''); };
  const saveEdit = (u: DirectoryUser) => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== u.name) {
      setUserName(u.email, trimmed);
      // If the renamed user is currently signed in on this browser, reload so
      // every avatar / name pill (sidebar, topbar, prospect agent column, etc.)
      // picks up the change. Otherwise the table re-render is enough.
      if (u.email.toLowerCase() === myEmail) {
        window.location.reload();
        return;
      }
      setTick((t) => t + 1);
    }
    setEditingEmail(null);
    setDraftName('');
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
          onClick={() => window.location.reload()}
          title="Reload to make every avatar, name, tier, and permission across the app reflect the latest changes"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-gray-50 transition-colors"
          style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}>
          <Save size={13} /> Save & Reload
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
                        onClick={() => {
                          if (window.confirm(`Remove ${u.email} from the user directory?\n\nThey can sign up again with the secret code.`)) {
                            removeUserFromDirectory(u.email);
                            setTick((t) => t + 1);
                          }
                        }}
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

// ─── Add User modal ─────────────────────────────────────────────────────────
function AddUserModal({ existingEmails, onClose, onCreated }: {
  existingEmails: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail]   = useState('');
  const [name,  setName]    = useState('');
  const [pwd,   setPwd]     = useState('');
  const [role,  setRole]    = useState<Role>('viewer');
  const [tier,  setTier]    = useState<UserTier>('Agent');
  const [showPwd, setShow]  = useState(false);
  const [busy,  setBusy]    = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const existingSet = useMemo(() => new Set(existingEmails.map((e) => e.toLowerCase())), [existingEmails]);

  const submit = async () => {
    setError(null);
    if (!validEmail(email))            { setError('Please enter a valid email.'); return; }
    if (existingSet.has(email.toLowerCase())) { setError('A user with this email already exists.'); return; }
    if (!name.trim())                  { setError('Please enter a display name.'); return; }
    if (!pwd)                          { setError('Please set a password.'); return; }

    setBusy(true);
    const ok = createUser(email.trim(), name.trim());
    if (!ok) { setBusy(false); setError('Could not create user.'); return; }
    await setPassword(email.trim(), pwd);
    setUserRole(email.trim(), role);
    setUserTier(email.trim(), tier);
    setBusy(false);
    onCreated();
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
              <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>Add user</h3>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create an account and set the initial password</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="px-6 pb-5 space-y-4">
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@whyestate.com" type="email"
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
              style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
          </Field>
          <Field label="Display name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe"
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
              style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
          </Field>
          <Field label="Password">
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={pwd} onChange={(e) => setPwd(e.target.value)}
                placeholder="Initial password" autoComplete="new-password"
                className="w-full px-3 py-2 pr-10 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
              <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
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

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={busy}
            className="px-5 py-1.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#1EC9C4' }}>
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reset password modal ───────────────────────────────────────────────────
function ResetPasswordModal({ target, onClose }: { target: DirectoryUser; onClose: () => void }) {
  const [pwd, setPwd]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShow]  = useState(false);
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
    if (!pwd) { setError('Please enter a new password.'); return; }
    if (pwd !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    await setPassword(target.email, pwd);
    setBusy(false);
    setDone(true);
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
          <Field label="New password">
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={pwd} onChange={(e) => setPwd(e.target.value)}
                placeholder="Enter new password" autoComplete="new-password"
                className="w-full px-3 py-2 pr-10 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
              <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
          <Field label="Confirm new password">
            <input type={showPwd ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter new password" autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
              style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
          </Field>
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#991B1B' }}>
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> <span>{error}</span>
            </div>
          )}
          {done && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#DCFCE7', color: '#166534' }}>
              <Check size={13} className="mt-0.5 flex-shrink-0" />
              <span>Password updated. Share the new password with {target.name || target.email}.</span>
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
              style={{ background: '#9C1F2D' }}>
              {busy ? 'Saving…' : 'Reset password'}
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
function ProspectHubSettings({ onBack }: { onBack: () => void }) {
  const [perms, setPerms]     = useState<RolePerms>(() => loadRolePerms());
  const [saved, setSaved]     = useState<RolePerms>(perms);
  const dirty = JSON.stringify(perms) !== JSON.stringify(saved);

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

  const save = () => { saveRolePerms(perms); setSaved(perms); };

  const reset = () => {
    if (!window.confirm('Reset all role permissions back to their factory defaults?')) return;
    resetRolePerms();
    const fresh = loadRolePerms();
    setPerms(fresh);
    setSaved(fresh);
  };

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
            <h2 className="text-2xl font-bold" style={{ color: '#1A202C' }}>Prospect Hub Setting</h2>
          </div>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
            Configure what each role can do inside Prospect Hub. Master Admin always has full access.
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
        Changes save to <code style={{ background: '#F3F4F6', padding: '1px 4px', borderRadius: 4 }}>localStorage</code> on this browser.
        Wiring buttons in Prospect Hub to actually respect these permissions comes in the next step.
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
