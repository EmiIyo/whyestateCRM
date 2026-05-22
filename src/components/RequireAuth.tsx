import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth';
import { type Role, canDo, usePermsStore } from '@/lib/permissions';
import { ROUTE_PATHS } from '@/lib/index';

export default function RequireAuth({
  children,
  masterOnly = false,
  adminPanel = false,
  requireRoles,
  permission,
}: {
  children: React.ReactNode;
  masterOnly?: boolean;
  /**
   * Admin Control gate — master_admin OR any non-empty `admin_access`.
   * Use this for the /admin route so delegated admins can reach the panel.
   */
  adminPanel?: boolean;
  requireRoles?: Role[];
  permission?: string;
}) {
  const ready   = useAuthStore((s) => s.ready);
  const user    = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  // Subscribing keeps the route reactive to live matrix edits.
  usePermsStore((s) => s.perms);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;

  // Pending user — admin hasn't approved them yet. Every protected route
  // funnels here. The realtime sub on the user's own profile flips them
  // off this screen automatically the moment approved_at lands.
  if (!profile?.approved_at) {
    return <Navigate to={ROUTE_PATHS.PENDING} replace />;
  }

  const role: Role = profile?.role ?? 'viewer';
  const access = profile?.admin_access ?? [];

  if (masterOnly && role !== 'master_admin') {
    return <Navigate to={ROUTE_PATHS.LEADS} replace />;
  }
  if (adminPanel && role !== 'master_admin' && access.length === 0) {
    return <Navigate to={ROUTE_PATHS.LEADS} replace />;
  }
  if (requireRoles && requireRoles.length > 0 && !requireRoles.includes(role)) {
    return <Navigate to={ROUTE_PATHS.LEADS} replace />;
  }
  if (permission && !canDo(role, permission)) {
    const safeFallback = permission === 'nav.leads' ? ROUTE_PATHS.HOME : ROUTE_PATHS.LEADS;
    return <Navigate to={safeFallback} replace />;
  }
  return <>{children}</>;
}
