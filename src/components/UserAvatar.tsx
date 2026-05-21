// Single avatar component — handles fallback initials, custom colour, and
// uploaded image lookup from the auth store directory. Subscribes to the
// store so realtime changes (admin renames a user, user changes their colour)
// re-render every avatar everywhere immediately.

import { useAuthStore, DEFAULT_AVATAR_COLOR } from '@/lib/auth';

interface UserAvatarProps {
  /** Look up by user_id (preferred — stable). */
  userId?: string | null;
  /** Look up by email when user_id isn't on hand. */
  email?: string | null;
  /** Explicit override for the colour ring (e.g. agent preset). */
  color?: string;
  /** Pixel size (h/w both). */
  size?: number;
  /** Render only initials, no remote image. */
  noImage?: boolean;
  className?: string;
  title?: string;
}

function initialsOf(name: string | undefined, email: string | undefined): string {
  const source = (name || email?.split('@')[0] || '?').trim();
  return source.split(/\s+/).map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
}

export function UserAvatar({ userId, email, color, size = 32, noImage, className, title }: UserAvatarProps): React.ReactElement {
  const profile = useAuthStore((s) => {
    if (userId) return s.directory.find((p) => p.id === userId);
    if (email)  return s.directory.find((p) => p.email.toLowerCase() === email.toLowerCase());
    return s.profile;
  });

  const bg = color ?? profile?.avatar_color ?? DEFAULT_AVATAR_COLOR;
  const img = noImage ? null : profile?.avatar_url ?? null;
  const initials = initialsOf(profile?.display_name, profile?.email ?? email ?? undefined);

  return (
    <div
      title={title ?? profile?.display_name ?? profile?.email ?? ''}
      className={`rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${className ?? ''}`}
      style={{ background: bg, width: size, height: size }}
    >
      {img
        ? <img src={img} alt="" className="w-full h-full object-cover" />
        : <span className="font-bold text-white" style={{ fontSize: Math.max(10, size * 0.36) }}>{initials}</span>}
    </div>
  );
}
