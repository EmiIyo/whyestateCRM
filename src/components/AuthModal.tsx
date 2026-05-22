import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mail, Lock, User as UserIcon, Loader2, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { signIn, signUp, requestPasswordReset, setPassword, useAuthStore } from '@/lib/auth';
import { getMyProfile } from '@/api/profiles';
import { refreshPermissions } from '@/lib/permissions';
import { ROUTE_PATHS } from '@/lib/index';

type Mode = 'signin' | 'signup' | 'forgot';

export default function AuthModal({
  open,
  initialMode = 'signin',
  onClose,
}: {
  open: boolean;
  initialMode?: Mode;
  onClose: () => void;
}) {
  const [mode, setMode]     = useState<Mode>(initialMode);
  const [email, setEmail]   = useState('');
  const [password, setPwd]  = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName]     = useState('');
  const [error, setError]   = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);
  const navigate = useNavigate();

  if (!open) return null;

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validEmail(email)) { setError('Please enter a valid email.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    if (mode === 'signup') {
      if (!name.trim())            { setError('Please enter your name.'); return; }
      if (password !== confirm)    { setError('Passwords do not match.'); return; }
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password, name);
      } else {
        await signIn(email, password);
      }

      // `bootAuth`'s onAuthStateChange listener populates the store async.
      // Poll briefly so the next steps see a user with a session — without
      // this we can navigate while the store still has user=null, causing
      // the "flash, bounce back" jitter.
      for (let i = 0; i < 30; i++) {
        if (useAuthStore.getState().user) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      // Pull the freshest profile so the routing branch below sees the
      // current approved_at (the very first master sign-up is auto-approved
      // by the handle_new_user trigger — others land pending).
      try {
        const fresh = await getMyProfile();
        if (fresh) useAuthStore.getState().setProfile(fresh);
      } catch { /* non-fatal */ }
      // Pull the permission matrix so canDo() works on first render.
      await refreshPermissions().catch(() => { /* non-fatal */ });

      onClose();
      const approved = !!useAuthStore.getState().profile?.approved_at;
      navigate(approved ? ROUTE_PATHS.LEADS : ROUTE_PATHS.PENDING, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'signin' ? 'Why Estate Login'
              : mode === 'signup' ? 'Create your account'
              : 'Reset your password';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.25)' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img src="/logo-icon.png" alt="whyEstate" className="h-8 w-8 select-none" draggable={false} />
            <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        {mode !== 'forgot' && (
          <div className="flex border-b border-gray-100 flex-shrink-0">
            {[
              { id: 'signin' as Mode, label: 'Sign In' },
              { id: 'signup' as Mode, label: 'Sign Up' },
            ].map((t) => (
              <button key={t.id}
                onClick={() => { setMode(t.id); setError(null); }}
                className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${mode === t.id ? '' : 'text-gray-400 hover:text-gray-600'}`}
                style={{ color: mode === t.id ? '#1EC9C4' : undefined }}>
                {t.label}
                {mode === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#1EC9C4' }} />
                )}
              </button>
            ))}
          </div>
        )}

        {mode === 'forgot' ? (
          <ForgotPasswordPanel
            initialEmail={email}
            onBackToSignIn={() => { setMode('signin'); setError(null); }}
          />
        ) : (
          <form onSubmit={submit} className="px-6 py-5 space-y-3.5">
            {mode === 'signup' && (
              <Field label="Full Name" icon={<UserIcon size={14} />}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                  style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
              </Field>
            )}

            <Field label="Email" icon={<Mail size={14} />}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@whyestate.com" type="email" autoComplete="email"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
            </Field>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold" style={{ color: '#374151' }}>Password</label>
                {mode === 'signin' && (
                  <button type="button"
                    onClick={() => { setMode('forgot'); setError(null); }}
                    className="text-xs font-semibold hover:underline" style={{ color: '#1EC9C4' }}>
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={14} /></span>
                <input value={password} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                  style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
              </div>
            </div>

            {mode === 'signup' && (
              <>
                <Field label="Confirm Password" icon={<Lock size={14} />}>
                  <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" type="password" autoComplete="new-password"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                    style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
                </Field>
                <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
                  An admin will review your account and grant access after sign-up.
                </p>
              </>
            )}

            {error && (
              <p className="text-xs flex items-center gap-1.5" style={{ color: '#DC2626' }}>
                <AlertCircle size={12} /> {error}
              </p>
            )}

            <button type="submit" disabled={busy}
              className="w-full px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              style={{ background: '#1EC9C4' }}>
              {busy && <Loader2 size={14} className="animate-spin" />}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>

            <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
              {mode === 'signin' ? (
                <>Don't have an account?{' '}
                  <button type="button" onClick={() => { setMode('signup'); setError(null); }}
                    className="font-semibold hover:underline" style={{ color: '#1EC9C4' }}>
                    Sign up
                  </button>
                </>
              ) : (
                <>Already have an account?{' '}
                  <button type="button" onClick={() => { setMode('signin'); setError(null); }}
                    className="font-semibold hover:underline" style={{ color: '#1EC9C4' }}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Forgot Password panel ─────────────────────────────────────────────────
function ForgotPasswordPanel({ initialEmail, onBackToSignIn }: {
  initialEmail: string;
  onBackToSignIn: () => void;
}) {
  const [email, setEmail]   = useState(initialEmail);
  const [pwd, setPwd]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep]     = useState<'request' | 'set-new' | 'done'>('request');
  const [error, setError]   = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const sendEmail = async () => {
    setError(null);
    if (!validEmail(email)) { setError('Please enter a valid email.'); return; }
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setStep('set-new');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setBusy(false);
    }
  };

  const applyNewPassword = async () => {
    setError(null);
    if (pwd.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (pwd !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      // Works only when the user has clicked the recovery link from their inbox
      // (Supabase Auth puts the recovery token in the URL hash).
      await setPassword(pwd);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password — open the reset link from your email first.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-6 py-5 space-y-4">
      <button onClick={onBackToSignIn}
        className="flex items-center gap-1.5 text-xs font-semibold hover:text-[#1EC9C4] transition-colors"
        style={{ color: '#6B7280' }}>
        <ArrowLeft size={12} /> Back to sign in
      </button>

      {step === 'request' && (
        <>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            Enter the email you signed up with — we'll send a reset link.
          </p>
          <Field label="Email" icon={<Mail size={14} />}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@whyestate.com" type="email" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') sendEmail(); }}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
              style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
          </Field>
          {error && <p className="text-xs flex items-center gap-1.5" style={{ color: '#DC2626' }}><AlertCircle size={12} /> {error}</p>}
          <button onClick={sendEmail} disabled={busy}
            className="w-full px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#1EC9C4' }}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            Send reset email
          </button>
        </>
      )}

      {step === 'set-new' && (
        <>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            Open the link we sent to <strong>{email}</strong>. Once you're back here you can set a new password below.
          </p>
          <Field label="New Password" icon={<Lock size={14} />}>
            <input value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" type="password" autoComplete="new-password"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
              style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
          </Field>
          <Field label="Confirm New Password" icon={<Lock size={14} />}>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" type="password" autoComplete="new-password"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
              style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
          </Field>
          {error && <p className="text-xs flex items-center gap-1.5" style={{ color: '#DC2626' }}><AlertCircle size={12} /> {error}</p>}
          <button onClick={applyNewPassword} disabled={busy}
            className="w-full px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#1EC9C4' }}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            Update password
          </button>
        </>
      )}

      {step === 'done' && (
        <div className="text-center py-6 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center" style={{ background: '#DCFCE7' }}>
            <Check size={24} style={{ color: '#16A34A' }} strokeWidth={3} />
          </div>
          <h4 className="text-base font-bold" style={{ color: '#1A202C' }}>Password updated</h4>
          <p className="text-xs" style={{ color: '#6B7280' }}>You can sign in with your new password.</p>
          <button onClick={onBackToSignIn}
            className="w-full px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ background: '#1EC9C4' }}>
            Back to sign in
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold mb-1 block" style={{ color: '#374151' }}>{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
        {children}
      </div>
    </div>
  );
}
