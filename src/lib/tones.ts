// One source of truth for tier + role badge colour pairs. Used by the sidebar,
// top bar, profile page, admin control, and the prospect hub member lists.

import type { Enums } from '@/types/database';

export type UserTier = Enums<'user_tier'>;
export type AppRole  = Enums<'app_role'>;

interface Tone { bg: string; text: string }

export const TIER_TONES: Record<UserTier, Tone> = {
  'Agent':          { bg: '#E0F2FE', text: '#0369A1' },
  'Staff':          { bg: '#F3F4F6', text: '#374151' },
  'Branch Manager': { bg: '#FEF3C7', text: '#92400E' },
  'Branch Partner': { bg: '#EDE9FE', text: '#7C3AED' },
};

export const ROLE_TONES: Record<AppRole, Tone> = {
  master_admin: { bg: '#FEF3C7', text: '#92400E' },
  admin:        { bg: '#DAF3F2', text: '#0F766E' },
  editor:       { bg: '#E0F2FE', text: '#0369A1' },
  viewer:       { bg: '#F3F4F6', text: '#374151' },
};

export const ROLE_LABELS: Record<AppRole, string> = {
  master_admin: 'Master Admin',
  admin:        'Admin',
  editor:       'Editor',
  viewer:       'Viewer',
};

export function tierTone(tier: UserTier | string | undefined): Tone {
  if (!tier) return TIER_TONES['Agent'];
  return TIER_TONES[tier as UserTier] ?? TIER_TONES['Agent'];
}

export function roleTone(role: AppRole | string | undefined): Tone {
  if (!role) return ROLE_TONES.viewer;
  return ROLE_TONES[role as AppRole] ?? ROLE_TONES.viewer;
}

export function roleLabel(role: AppRole | string | undefined): string {
  if (!role) return 'Member';
  return ROLE_LABELS[role as AppRole] ?? 'Member';
}
