// Mock Google connection state — kept in DB so it survives device switches.
// Real OAuth wiring will replace `connectMock` with a redirect flow.

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type GoogleConnection = Tables<'google_connections'>;

export async function getMyConnection(): Promise<GoogleConnection | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('google_connections')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function connectMock(opts: { calendar?: boolean; drive?: boolean } = {}): Promise<GoogleConnection> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  await new Promise((r) => setTimeout(r, 500));
  const row = {
    user_id: user.id,
    email: user.email ?? '',
    mock_token: `mock_${Date.now()}`,
    calendar_connected: !!opts.calendar,
    drive_connected: !!opts.drive,
  };
  const { data, error } = await supabase
    .from('google_connections')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function disconnect(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('google_connections').delete().eq('user_id', user.id);
  if (error) throw error;
}
