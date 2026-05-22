import { supabase } from '@/lib/supabase';
import type { Tables, Enums } from '@/types/database';

export type Profile = Tables<'profiles'>;
export type AppRole = Enums<'app_role'>;
export type UserTier = Enums<'user_tier'>;

export const APP_ROLES: AppRole[] = ['master_admin', 'admin', 'editor', 'viewer'];
export const USER_TIERS: UserTier[] = ['Agent', 'Staff', 'Branch Manager', 'Branch Partner'];

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('display_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getProfile(user.id);
}

export async function updateMyProfile(patch: {
  display_name?: string;
  avatar_color?: string;
  avatar_url?: string | null;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
  if (error) throw error;
}

export async function adminSetUserRole(userId: string, role: AppRole): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_role', { p_user_id: userId, p_role: role });
  if (error) throw error;
}

export async function adminSetUserTier(userId: string, tier: UserTier): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_tier', { p_user_id: userId, p_tier: tier });
  if (error) throw error;
}

// Admin sub-panel keys — keep in sync with the DB validator.
export type AdminPanel = 'users' | 'sidebar_permissions' | 'prospect_hub_permissions';
export const ADMIN_PANELS: { key: AdminPanel; label: string }[] = [
  { key: 'users',                      label: 'User Setting' },
  { key: 'sidebar_permissions',        label: 'Sidebar Permissions' },
  { key: 'prospect_hub_permissions',   label: 'Prospect Hub Permissions' },
];

export async function adminSetAdminAccess(userId: string, access: AdminPanel[]): Promise<void> {
  const { error } = await supabase.rpc('admin_set_admin_access', { p_user_id: userId, p_access: access });
  if (error) throw error;
}

// Approve a pending user, assigning role + tier + admin_access atomically.
// approved_at + approved_by are set server-side; once it lands, the user's
// realtime profile sub fires and they immediately get full access.
export async function adminApproveUser(
  userId: string,
  role: AppRole,
  tier: UserTier,
  adminAccess: AdminPanel[],
): Promise<void> {
  const { error } = await supabase.rpc('admin_approve_user', {
    p_user_id: userId,
    p_role: role,
    p_tier: tier,
    p_admin_access: adminAccess,
  });
  if (error) throw error;
}

// Reject = hard delete from auth.users (the profile row cascades). After
// this, the rejected user trying to log in gets the same generic
// "invalid login credentials" error they'd see if they'd never signed up.
export async function adminRejectUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reject_user', { p_user_id: userId });
  if (error) throw error;
}

export async function adminUpdateProfile(userId: string, patch: {
  display_name?: string;
  avatar_color?: string;
  avatar_url?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}
