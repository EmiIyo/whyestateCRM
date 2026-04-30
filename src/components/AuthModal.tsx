import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mail, Lock, User as UserIcon, Loader2, KeyRound } from 'lucide-react';

// Anyone signing up must provide this invite/secret code. Change as needed.
const SIGNUP_SECRET = 'whyestate2026';
import { signIn } from '@/lib/auth';
import { ROUTE_PATHS } from '@/lib/index';

type Mode = 'signin' | 'signup';

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
  const [secretCode, setSecretCode] = useState('');
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
      if (!name.trim())      { setError('Please enter your name.'); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      if (secretCode.trim().toLowerCase() !== SIGNUP_SECRET) { setError('Invalid secret code.'); return; }
    }

    setBusy(true);
    // Simulated network call — swap for supabase.auth.signIn / signUp later.
    await new Promise((r) => setTimeout(r, 500));
    signIn(email.trim(), mode === 'signup' ? name.trim() : undefined);
    setBusy(false);
    onClose();
    navigate(ROUTE_PATHS.LEADS, { replace: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img src="/logo-icon.png" alt="whyEstate" className="h-8 w-8 select-none" draggable={false} />
            <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        {/* Tabs */}
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

        {/* Form */}
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

          <Field label="Password" icon={<Lock size={14} />}>
            <input value={password} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
              style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
          </Field>

          {mode === 'signup' && (
            <Field label="Confirm Password" icon={<Lock size={14} />}>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" type="password" autoComplete="new-password"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
            </Field>
          )}

          {mode === 'signup' && (
            <Field label="Secret Code" icon={<KeyRound size={14} />}>
              <input value={secretCode} onChange={(e) => setSecretCode(e.target.value)} placeholder="Invite code"
                autoComplete="off" autoCapitalize="off" spellCheck={false}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
            </Field>
          )}

          {error && (
            <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
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
      </div>
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
