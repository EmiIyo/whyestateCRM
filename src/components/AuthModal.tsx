import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mail, Lock, User as UserIcon, Loader2, KeyRound, ArrowLeft, Check, AlertCircle, Copy } from 'lucide-react';

// Anyone signing up must provide this invite/secret code. Change as needed.
const SIGNUP_SECRET = 'whyestate2026';
import { signIn, setPassword, verifyPassword, hasPasswordSet, listAllUsers } from '@/lib/auth';
import { ROUTE_PATHS } from '@/lib/index';

type Mode = 'signin' | 'signup' | 'forgot';

// ─── Mock email / password-reset helpers ────────────────────────────────────
// Generates a 6-digit code, stamps it with a 30-minute expiry, and stores
// it under `we.reset_codes`. In production this is replaced by an emailed
// link (Supabase auth.resetPasswordForEmail).
const RESET_KEY = 'we.reset_codes';
interface ResetEntry { code: string; expiresAt: number; }

function loadResetCodes(): Record<string, ResetEntry> {
  try {
    const raw = localStorage.getItem(RESET_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed as Record<string, ResetEntry> : {};
  } catch { return {}; }
}
function saveResetCodes(map: Record<string, ResetEntry>): void {
  try { localStorage.setItem(RESET_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}
function issueResetCode(email: string): string {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const all = loadResetCodes();
  all[email.toLowerCase()] = { code, expiresAt: Date.now() + 30 * 60_000 };
  saveResetCodes(all);
  return code;
}
function verifyResetCode(email: string, code: string): boolean {
  const all = loadResetCodes();
  const entry = all[email.toLowerCase()];
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) return false;
  return entry.code === code.trim();
}
function consumeResetCode(email: string): void {
  const all = loadResetCodes();
  delete all[email.toLowerCase()];
  saveResetCodes(all);
}

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
    const cleanEmail = email.trim();
    if (mode === 'signup') {
      await setPassword(cleanEmail, password);
    } else if (hasPasswordSet(cleanEmail)) {
      // Existing account with a stored password — must match.
      const ok = await verifyPassword(cleanEmail, password);
      if (!ok) { setBusy(false); setError('Incorrect password.'); return; }
    } else {
      // Legacy account without a stored password — treat first sign-in as a soft set.
      await setPassword(cleanEmail, password);
    }
    signIn(cleanEmail, mode === 'signup' ? name.trim() : undefined);
    setBusy(false);
    onClose();
    navigate(ROUTE_PATHS.LEADS, { replace: true });
  };

  const title = mode === 'signin' ? 'Why Estate Login'
              : mode === 'signup' ? 'Create your account'
              : 'Reset your password';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img src="/logo-icon.png" alt="whyEstate" className="h-8 w-8 select-none" draggable={false} />
            <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        {/* Tabs (sign-in / sign-up only) */}
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

        {/* Form */}
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
        )}
      </div>
    </div>
  );
}

// ─── Forgot Password panel — 3 steps: email → code → new password ─────────
type ResetStep = 'request' | 'verify' | 'done';

function ForgotPasswordPanel({ initialEmail, onBackToSignIn }: {
  initialEmail: string;
  onBackToSignIn: () => void;
}) {
  const [step, setStep]     = useState<ResetStep>('request');
  const [email, setEmail]   = useState(initialEmail);
  const [code, setCode]     = useState('');
  const [pwd, setPwd]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [issuedCode, setIssuedCode] = useState('');
  const [error, setError]   = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);
  const [copied, setCopied] = useState(false);

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const sendCode = async () => {
    setError(null);
    if (!validEmail(email)) { setError('Please enter a valid email.'); return; }
    // Only let known accounts request a reset.
    const exists = listAllUsers().some((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!exists) { setError('No account found for this email.'); return; }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 400));
    const issued = issueResetCode(email.trim());
    setIssuedCode(issued);
    setBusy(false);
    setStep('verify');
  };

  const resetPwd = async () => {
    setError(null);
    if (!verifyResetCode(email.trim(), code)) { setError('Invalid or expired code.'); return; }
    if (pwd.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (pwd !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    await setPassword(email.trim(), pwd);
    consumeResetCode(email.trim());
    setBusy(false);
    setStep('done');
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(issuedCode); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
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
            Enter the email you signed up with — we'll send a reset code.
          </p>
          <Field label="Email" icon={<Mail size={14} />}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@whyestate.com" type="email" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') sendCode(); }}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
              style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
          </Field>
          {error && <p className="text-xs flex items-center gap-1.5" style={{ color: '#DC2626' }}><AlertCircle size={12} /> {error}</p>}
          <button onClick={sendCode} disabled={busy}
            className="w-full px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#1EC9C4' }}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            Send reset code
          </button>
        </>
      )}

      {step === 'verify' && (
        <>
          {/* Simulated email — in production this becomes an actual email. */}
          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: '#FEF3C7', background: '#FFFBEB' }}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#92400E' }}>📧 Reset email (preview)</p>
            <p className="text-xs mb-2" style={{ color: '#78350F' }}>Sent to <strong>{email}</strong>. The 6-digit code is:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-base font-mono font-bold tracking-[0.3em] text-center py-2 rounded-lg"
                style={{ background: 'white', color: '#92400E', border: '1px solid #FDE68A' }}>{issuedCode}</code>
              <button onClick={copyCode}
                className="px-2.5 py-2 rounded-lg text-[11px] font-semibold flex items-center gap-1 hover:bg-yellow-100 transition-colors"
                style={{ color: '#92400E', border: '1px solid #FDE68A', background: 'white' }}>
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-[10px] mt-2 italic" style={{ color: '#9CA3AF' }}>
              Local-mode preview — a real email will arrive when the Supabase backend is wired.
            </p>
          </div>

          <Field label="Reset Code" icon={<KeyRound size={14} />}>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" autoComplete="one-time-code"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm font-mono tracking-widest focus:border-[#1EC9C4]"
              style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
          </Field>
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

          <button onClick={resetPwd} disabled={busy}
            className="w-full px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#1EC9C4' }}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            Reset password
          </button>

          <p className="text-[11px] text-center" style={{ color: '#9CA3AF' }}>
            Didn't get a code?{' '}
            <button onClick={() => setStep('request')}
              className="font-semibold hover:underline" style={{ color: '#1EC9C4' }}>
              Try a different email
            </button>
          </p>
        </>
      )}

      {step === 'done' && (
        <div className="text-center py-6 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center" style={{ background: '#DCFCE7' }}>
            <Check size={24} style={{ color: '#16A34A' }} strokeWidth={3} />
          </div>
          <h4 className="text-base font-bold" style={{ color: '#1A202C' }}>Password reset</h4>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            You can now sign in with your new password.
          </p>
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
