import { Navigate } from 'react-router-dom';
import { isAuthed, getCurrentUser } from '@/lib/auth';
import { ROUTE_PATHS } from '@/lib/index';

export default function RequireAuth({ children, masterOnly = false }: { children: React.ReactNode; masterOnly?: boolean }) {
  if (!isAuthed()) return <Navigate to="/" replace />;
  if (masterOnly) {
    const me = getCurrentUser();
    const ok = (me?.email ?? '').toLowerCase() === 'linux@whyestate.com';
    if (!ok) return <Navigate to={ROUTE_PATHS.LEADS} replace />;
  }
  return <>{children}</>;
}
