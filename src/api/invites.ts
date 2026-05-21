import { supabase } from '@/lib/supabase';
import type { Tables, Enums } from '@/types/database';

export type Invite = Tables<'invites'>;
export type AppRole = Enums<'app_role'>;
export type UserTier = Enums<'user_tier'>;

function generateCode(): string {
  // 12-char base32-ish code, easy to read aloud.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  for (const b of buf) s += alphabet[b % alphabet.length];
  return s;
}

export async function listInvites(): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createInvite(input: { email: string; role: AppRole; tier?: UserTier }): Promise<Invite> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email');
  const code = generateCode();
  const { data, error } = await supabase
    .from('invites')
    .insert({ email, code, role: input.role, tier: input.tier ?? 'Agent' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function revokeInvite(id: string): Promise<void> {
  const { error } = await supabase.from('invites').delete().eq('id', id);
  if (error) throw error;
}

export async function redeemInvite(code: string): Promise<AppRole> {
  const { data, error } = await supabase.rpc('redeem_invite', { p_code: code });
  if (error) throw error;
  return data as AppRole;
}
