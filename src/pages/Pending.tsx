import { Clock, LogOut, Mail } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { signOutAndReset, useAuthStore } from '@/lib/auth';
import { ROUTE_PATHS } from '@/lib/index';

// Shown to a signed-in user whose profile.approved_at is still null. The
// realtime sub on the current user's profile in bootAuth() flips this
// screen off the moment an admin approves them — no F5 needed.
export default function Pending() {
  const ready   = useAuthStore((s) => s.ready);
  const user    = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading…</div>;
  }
  // No session → back to the landing page where they can sign in.
  if (!user) return <Navigate to={ROUTE_PATHS.HOME} replace />;
  // Already approved (e.g. admin approved them in another tab) → into the app.
  if (profile?.approved_at) return <Navigate to={ROUTE_PATHS.LEADS} replace />;

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #F0FFFE 0%, #FFFFFF 100%)' }}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-8 text-center"
        style={{ border: '1px solid #E5E7EB', boxShadow: '0 30px 80px rgba(15,23,42,0.10)' }}>
        <div
          className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-5"
          style={{ background: '#DAF3F2' }}>
          <Clock size={26} style={{ color: '#0F766E' }} strokeWidth={2.2} />
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ color: '#0F172A' }}>
          Waiting for approval
        </h1>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: '#64748B' }}>
          Your account is created. An admin needs to approve you before you can
          access the workspace. You'll be let in automatically the moment they do
          — no need to refresh.
        </p>

        <div
          className="rounded-xl px-4 py-3 mb-6 text-left flex items-center gap-3"
          style={{ background: '#F8FAFB', border: '1px solid #F1F5F9' }}>
          <Mail size={14} style={{ color: '#9CA3AF' }} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Signed in as</p>
            <p className="text-sm font-semibold truncate" style={{ color: '#374151' }}>
              {profile?.display_name || user?.name || user?.email}
            </p>
            <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{user?.email}</p>
          </div>
        </div>

        <button
          onClick={() => { void signOutAndReset(); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border hover:bg-gray-50 transition-colors"
          style={{ borderColor: '#E5E7EB', color: '#374151' }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}
