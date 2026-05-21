import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth';
import { type Role } from '@/lib/permissions';
import { ROUTE_PATHS } from '@/lib/index';

export default function RequireAuth({
  children,
  masterOnly = false,
  requireRoles,
}: {
  children: React.ReactNode;
  masterOnly?: boolean;
  requireRoles?: Role[];
}) {
  const ready   = useAuthStore((s) => s.ready);
  const user    = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;

  const role: Role = profile?.role ?? 'viewer';

  if (masterOnly && role !== 'master_admin') {
    return <Navigate to={ROUTE_PATHS.LEADS} replace />;
  }
  if (requireRoles && requireRoles.length > 0 && !requireRoles.includes(role)) {
    return <Navigate to={ROUTE_PATHS.LEADS} replace />;
  }
  return <>{children}</>;
}
