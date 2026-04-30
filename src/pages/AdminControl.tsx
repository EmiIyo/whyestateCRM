import { useMemo, useState } from 'react';
import {
  ShieldCheck, Check, RotateCcw, Save, ChevronLeft, ChevronRight, Settings2, Search, Users as UsersIcon,
} from 'lucide-react';
import {
  PERMISSIONS, PERMISSION_GROUPS, ROLES,
  loadRolePerms, saveRolePerms, resetRolePerms,
  getUserRole, setUserRole,
  type Role, type RolePerms,
} from '@/lib/permissions';
import { getCurrentUser, listAllUsers, removeUserFromDirectory, type DirectoryUser } from '@/lib/auth';

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

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Users</p>
        <div className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1.5 bg-white flex-1 max-w-xs focus-within:border-[#1EC9C4]">
          <Search size={13} style={{ color: '#A1A9B6' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email or name…"
            className="flex-1 text-xs outline-none bg-transparent placeholder:text-gray-300" />
        </div>
        <span className="text-xs ml-auto" style={{ color: '#9CA3AF' }}>{filtered.length} of {users.length}</span>
      </div>

      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E5E7EB', background: 'white' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead style={{ background: '#F8FAFB', borderBottom: '1px solid #E5E7EB' }}>
            <tr style={{ color: '#6B7280', fontSize: 11, fontWeight: 600 }}>
              <th style={{ textAlign: 'left',  padding: '10px 12px' }}>User</th>
              <th style={{ textAlign: 'left',  padding: '10px 12px' }}>Email</th>
              <th style={{ textAlign: 'left',  padding: '10px 12px' }}>Joined</th>
              <th style={{ textAlign: 'left',  padding: '10px 12px', width: 200 }}>Role</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-xs" style={{ color: '#9CA3AF' }}>No users yet.</td></tr>
            ) : filtered.map((u) => {
              const role = getUserRole(u.email);
              const isMe = u.email.toLowerCase() === myEmail;
              const initials = (u.name || u.email).split(' ').map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase();
              return (
                <tr key={u.email} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#1EC9C4' }}>
                        <span className="text-[10px] font-bold text-white">{initials}</span>
                      </div>
                      <span className="font-semibold" style={{ color: '#374151' }}>{u.name || '—'}</span>
                      {isMe && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ background: '#DAF3F2', color: '#0F766E' }}>You</span>
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
                    <RolePicker value={role} onChange={(r) => handleRoleChange(u.email, r)} />
                  </td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle', textAlign: 'right' }}>
                    <button
                      disabled={isMe}
                      onClick={() => {
                        if (window.confirm(`Remove ${u.email} from the user directory?\n\nThey can sign up again with the secret code.`)) {
                          removeUserFromDirectory(u.email);
                          setTick((t) => t + 1);
                        }
                      }}
                      className="text-xs px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                      style={{ color: '#DC2626' }}
                      title={isMe ? "You can't remove yourself" : 'Remove user'}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
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
            {r.label}{r.locked && ' · locked'}
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
                    <div className="text-[9px] font-medium normal-case tracking-normal mt-0.5" style={{ color: '#9CA3AF', visibility: r.locked ? 'visible' : 'hidden' }}>
                      always all
                    </div>
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
