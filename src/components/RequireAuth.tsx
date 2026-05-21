import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth';
import { type Role, canDo, usePermsStore } from '@/lib/permissions';
import { ROUTE_PATHS } from '@/lib/index';

export default function RequireAuth({
  children,
  masterOnly = false,
  requireRoles,
  permission,
}: {
  children: React.ReactNode;
  masterOnly?: boolean;
  requireRoles?: Role[];
  /**
   * Permission key (e.g. 'nav.calendar') the current role must have. Falls
   * back to the LEADS landing page if missing so the user always has
   * somewhere to go. Re-evaluates whenever the admin matrix changes.
   */
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

  const role: Role = profile?.role ?? 'viewer';

  if (masterOnly && role !== 'master_admin') {
    return <Navigate to={ROUTE_PATHS.LEADS} replace />;
  }
  if (requireRoles && requireRoles.length > 0 && !requireRoles.includes(role)) {
    return <Navigate to={ROUTE_PATHS.LEADS} replace />;
  }
  if (permission && !canDo(role, permission)) {
    // If the user's own LEADS access was just revoked, fall through to HOME
    // so they don't end up in a redirect loop.
    const safeFallback = permission === 'nav.leads' ? ROUTE_PATHS.HOME : ROUTE_PATHS.LEADS;
    return <Navigate to={safeFallback} replace />;
  }
  return <>{children}</>;
}
