import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Calendar, Clock, Pencil, Check, X, LogOut, Shield,
  Eye, EyeOff, KeyRound, AlertCircle, Camera, Trash2,
} from 'lucide-react';
import {
  getCurrentUser, signOutAndReset, setNickname, getAvatarColor, setAvatarColor,
  listAllUsers, setPassword,
  getAvatarImage, setAvatarImage, clearAvatarImage, getUserTier,
} from '@/lib/auth';
import { getUserRole, ROLES, type Role } from '@/lib/permissions';
import { ROUTE_PATHS } from '@/lib/index';

// Role is now derived from the profiles table (Supabase Auth backed); the old
// hard-coded master email is gone, the trigger handle_new_user promotes the
// first signup to master_admin automatically.

// Saturated palette matching BoardCard colors — used for avatar fill.
const AVATAR_COLORS = [
  '#1EC9C4', '#F97316', '#8B5CF6', '#EF4444', '#22C55E',
  '#F59E0B', '#3B82F6', '#EC4899', '#7C3AED', '#06B6D4',
];


function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}
function fmtRelative(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.round(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
    return fmtDate(iso);
  } catch { return '—'; }
}

function resolveRole(email: string | undefined): Role {
  if (!email) return 'viewer';
  return getUserRole(email);
}

type Tab = 'profile' | 'security';

export default function MyProfile() {
  const navigate = useNavigate();
  const me = getCurrentUser();
  const [tab, setTab] = useState<Tab>('profile');

  if (!me) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <p className="text-sm" style={{ color: '#9CA3AF' }}>Not signed in.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-6" style={{ background: '#F5F7FA' }}>
      <div className="max-w-[860px] mx-auto">
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A202C' }}>Settings</h1>
        <p className="text-sm mb-5" style={{ color: '#9CA3AF' }}>Manage how you appear across the workspace</p>

        {/* Tab nav */}
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#F1F5F9' }}>
          <div className="flex items-center gap-1 px-4 pt-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <TabButton active={tab === 'profile'}  onClick={() => setTab('profile')}>Profile</TabButton>
            <TabButton active={tab === 'security'} onClick={() => setTab('security')}>Security</TabButton>
          </div>

          <div className="p-6">
            {tab === 'profile'  && <ProfileTab navigate={navigate} signOut={() => { void signOutAndReset(); }} email={me.email} name={me.name} />}
            {tab === 'security' && <SecurityTab email={me.email} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab button ─────────────────────────────────────────────────────────────
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="relative px-4 py-2 text-sm font-semibold transition-colors"
      style={{
        color: active ? '#1A202C' : '#6B7280',
        background: active ? '#F0FBFA' : 'transparent',
        borderRadius: '8px 8px 0 0',
        border: active ? '1px solid #D1F2EF' : '1px solid transparent',
        borderBottomColor: active ? '#F0FBFA' : 'transparent',
        marginBottom: -1,
      }}>
      {children}
    </button>
  );
}

// ─── Profile tab ────────────────────────────────────────────────────────────
function ProfileTab({ navigate, signOut, email, name }: {
  navigate: ReturnType<typeof useNavigate>;
  signOut: () => void;
  email: string;
  name: string;
}) {
  const role = resolveRole(email);
  const roleDef = ROLES.find((r) => r.id === role);
  const tier = getUserTier(email);
  const tierTone = (t: string): { bg: string; text: string } => {
    switch (t) {
      case 'Agent':          return { bg: '#E0F2FE', text: '#0369A1' };
      case 'Staff':          return { bg: '#F3F4F6', text: '#374151' };
      case 'Branch Manager': return { bg: '#FEF3C7', text: '#92400E' };
      case 'Branch Partner': return { bg: '#EDE9FE', text: '#7C3AED' };
      default:               return { bg: '#F3F4F6', text: '#374151' };
    }
  };
  const tierStyle = tierTone(tier);

  const [nickname, setNick] = useState(name);
  const [editing,  setEditing] = useState(false);
  const [avatar,   setAvatar]  = useState(getAvatarColor());
  const [avatarImg, setAvatarImg] = useState<string | null>(getAvatarImage());
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = (nickname || email).split(' ').map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';

  const dir = useMemo(() => listAllUsers().find((u) => u.email.toLowerCase() === email.toLowerCase()), [email]);

  const dirty =
    (nickname.trim() && nickname.trim() !== name) ||
    avatar !== getAvatarColor() ||
    pendingFile !== null ||
    (avatarImg === null && getAvatarImage() !== null);

  const save = async () => {
    try {
      const next = nickname.trim();
      if (next && next !== name) await setNickname(next);
      if (avatar !== getAvatarColor()) await setAvatarColor(avatar);
      if (pendingFile) await setAvatarImage(pendingFile);
      else if (avatarImg === null && getAvatarImage() !== null) await clearAvatarImage();
      // Optimistic update already wrote through to the auth store —
      // exit edit mode and trust realtime/store subscribers to repaint.
      setPendingFile(null);
      setEditing(false);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Save failed');
    }
  };
  const cancel = () => {
    setNick(name);
    setAvatar(getAvatarColor());
    setAvatarImg(getAvatarImage());
    setPendingFile(null);
    setUploadError(null);
    setEditing(false);
  };

  // Resize uploaded image to keep transfer size reasonable (256px square, JPEG q=0.85).
  const onPickFile = (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) { setUploadError('Please pick an image file.'); return; }
    if (file.size > 5 * 1024 * 1024)     { setUploadError('Image must be under 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const SIZE = 256;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setAvatarImg(dataUrl); setPendingFile(file); return; }
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
        canvas.toBlob((blob) => {
          if (!blob) { setUploadError('Could not encode image.'); return; }
          const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
          setPendingFile(new File([blob], `avatar.${ext}`, { type: 'image/jpeg' }));
          setAvatarImg(canvas.toDataURL('image/jpeg', 0.85));
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => setUploadError('Could not read this image.');
      img.src = dataUrl;
    };
    reader.onerror = () => setUploadError('Could not read this file.');
    reader.readAsDataURL(file);
  };

  return (
    <>
      {/* Header card */}
      <div className="flex items-start gap-5 mb-5">
        <div className="relative flex-shrink-0">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center transition-colors overflow-hidden"
            style={{ background: avatar }}>
            {avatarImg
              ? <img src={avatarImg} alt="" className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-white">{initials}</span>}
          </div>
          {editing && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                title="Upload picture"
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                style={{ background: '#1EC9C4', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                <Camera size={13} />
              </button>
              {avatarImg && (
                <button
                  onClick={() => setAvatarImg(null)}
                  title="Remove picture"
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                  style={{ background: '#DC2626', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                  <Trash2 size={11} />
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickFile(f);
                  e.target.value = '';
                }}
              />
            </>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={nickname}
              onChange={(e) => setNick(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
              autoFocus
              className="text-xl font-bold w-full border-b-2 outline-none pb-1"
              style={{ color: '#1A202C', borderColor: '#1EC9C4' }}
            />
          ) : (
            <h2 className="text-xl font-bold truncate" style={{ color: '#1A202C' }}>{name}</h2>
          )}
          <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: '#6B7280' }}>
            <Mail size={13} className="text-gray-400" /> {email}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
              style={{ background: tierStyle.bg, color: tierStyle.text }}>
              {tier}
            </span>
            {dir?.firstSeen && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                Joined {fmtDate(dir.firstSeen)}
              </span>
            )}
          </div>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:border-[#1EC9C4] hover:text-[#1EC9C4] transition-colors flex-shrink-0"
            style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>
            <Pencil size={12} /> Edit
          </button>
        ) : (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={cancel} className="p-2 rounded-lg border text-gray-500 hover:bg-gray-50" style={{ borderColor: '#E5E7EB' }}>
              <X size={13} />
            </button>
            <button onClick={save} disabled={!dirty}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#1EC9C4' }}>
              <Check size={12} strokeWidth={3} /> Save
            </button>
          </div>
        )}
      </div>

      {editing && uploadError && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#991B1B' }}>
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> <span>{uploadError}</span>
        </div>
      )}

      {editing && (
        <div className="mb-5 pb-5 border-b" style={{ borderColor: '#F1F5F9' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: '#9CA3AF' }}>
            Avatar Color {avatarImg && <span className="font-normal text-gray-400 normal-case">(hidden behind your picture)</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {AVATAR_COLORS.map((c) => {
              const picked = avatar.toLowerCase() === c.toLowerCase();
              return (
                <button key={c} onClick={() => setAvatar(c)} title={c}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ background: c, boxShadow: picked ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none' }}>
                  {picked && <Check size={12} className="text-white" strokeWidth={3} />}
                </button>
              );
            })}
            <label title="Custom colour"
              className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 relative"
              style={{
                background: AVATAR_COLORS.includes(avatar) ? 'transparent' : avatar,
                border: AVATAR_COLORS.includes(avatar) ? '1.5px dashed #C7CCD6' : 'none',
                boxShadow: AVATAR_COLORS.includes(avatar) ? 'none' : `0 0 0 2px white, 0 0 0 4px ${avatar}`,
              }}>
              {AVATAR_COLORS.includes(avatar)
                ? <span className="text-xs font-bold" style={{ color: '#7C8AA0' }}>+</span>
                : <Check size={12} className="text-white" strokeWidth={3} />}
              <input type="color" value={avatar} onChange={(e) => setAvatar(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
            </label>
          </div>
        </div>
      )}

      {/* Account details */}
      <div className="rounded-xl border mb-5" style={{ borderColor: '#F1F5F9' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: '#F1F5F9' }}>
          <h3 className="text-sm font-bold" style={{ color: '#1A202C' }}>Account</h3>
        </div>
        <div className="px-4 py-3 space-y-3">
          <Detail icon={<Mail size={13} />}      label="Email"     value={email} />
          <Detail icon={<Shield size={13} />}    label="Tier"      value={tier} />
          <Detail icon={<Calendar size={13} />}  label="Joined"    value={fmtDate(dir?.firstSeen)} />
          <Detail icon={<Clock size={13} />}     label="Last seen" value={fmtRelative(dir?.lastSeen)} />
        </div>
      </div>

      {/* Sign out */}
      <div className="rounded-xl border p-4 flex items-center justify-between" style={{ borderColor: '#F1F5F9' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#FEE2E2' }}>
            <LogOut size={15} style={{ color: '#DC2626' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1A202C' }}>Sign out</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>End your session on this browser.</p>
          </div>
        </div>
        <button onClick={signOut}
          className="px-4 py-1.5 rounded-xl text-sm font-semibold border hover:bg-red-50 transition-colors"
          style={{ borderColor: '#FECACA', color: '#DC2626' }}>
          Sign out
        </button>
      </div>

      <p className="text-[10px] mt-5 text-center" style={{ color: '#9CA3AF' }}>
        Need a different role? Ask a master admin to update it in <button onClick={() => navigate(ROUTE_PATHS.ADMIN)} className="underline hover:text-[#1EC9C4]">Admin Control</button>.
      </p>
    </>
  );
}

// ─── Security tab ───────────────────────────────────────────────────────────
// Supabase Auth's updateUser() rotates the password using the current session
// token — there is no separate "current password" check available client-side.
// Surfacing a current-password field would imply a verification that doesn't
// actually happen, so we drop it.
function SecurityTab({ email: _email }: { email: string }) {
  const [next,      setNext]      = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  const submit = async () => {
    setError(null); setSuccess(false);
    if (!next)                 { setError('Please enter a new password.'); return; }
    if (next.length < 6)       { setError('Password must be at least 6 characters.'); return; }
    if (next !== confirm)      { setError('New passwords do not match.'); return; }

    setBusy(true);
    try {
      await setPassword(next);
      setSuccess(true);
      setNext(''); setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setNext(''); setConfirm(''); setError(null); setSuccess(false);
  };

  return (
    <div>
      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#DAF3F2' }}>
          <KeyRound size={15} style={{ color: '#0F766E' }} />
        </div>
        <div>
          <h3 className="text-sm font-bold" style={{ color: '#1A202C' }}>Change password</h3>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
            You'll be asked for the new password next time you sign in. If you forgot your current one, sign out and use "Forgot password?" instead.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <PasswordField
          label="New Password"
          value={next}
          onChange={setNext}
          placeholder="Enter new password"
        />
        <PasswordField
          label="Confirm New Password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Enter confirm password"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 mt-5 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#991B1B' }}>
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 mt-5 px-3 py-2 rounded-lg text-xs" style={{ background: '#DCFCE7', color: '#166534' }}>
          <Check size={13} className="mt-0.5 flex-shrink-0" /> <span>Password updated.</span>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <button onClick={cancel}
          className="px-5 py-1.5 rounded-lg text-sm font-medium border hover:bg-gray-50 transition-colors"
          style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>
          Cancel
        </button>
        <button onClick={submit} disabled={busy || !next || !confirm}
          className="px-6 py-1.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{ background: '#9C1F2D' }}>
          {busy ? 'Saving…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-sm font-semibold mb-2 block" style={{ color: '#1A202C' }}>{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          className="w-full px-3 py-2.5 pr-10 rounded-lg border outline-none text-sm focus:border-[#1EC9C4] transition-colors"
          style={{ borderColor: '#E5E7EB', background: '#F8FAFB' }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
          aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function Detail({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: '#F3F4F6', color: '#6B7280' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#9CA3AF' }}>{label}</p>
        <p className="text-sm font-medium truncate" style={{ color: '#374151' }}>{value}</p>
        {hint && <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>{hint}</p>}
      </div>
    </div>
  );
}
