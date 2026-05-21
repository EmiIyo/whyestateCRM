import { supabase } from '@/lib/supabase';
import type { Tables, Enums } from '@/types/database';

export type MemberRole = Enums<'member_role'>;
export type DbBoardMember = Tables<'board_members'>;
export type DbFolderMember = Tables<'folder_members'>;

export interface BoardMember {
  boardId: string;
  userId: string;
  role: MemberRole;
  invitedBy: string | null;
  invitedAt: string;
}

export interface FolderMember {
  folderId: string;
  userId: string;
  role: MemberRole;
  invitedBy: string | null;
  invitedAt: string;
}

const toBM = (r: DbBoardMember): BoardMember => ({
  boardId: r.board_id, userId: r.user_id, role: r.role,
  invitedBy: r.invited_by, invitedAt: r.invited_at,
});
const toFM = (r: DbFolderMember): FolderMember => ({
  folderId: r.folder_id, userId: r.user_id, role: r.role,
  invitedBy: r.invited_by, invitedAt: r.invited_at,
});

// ─── Board members ────────────────────────────────────────────────────────
export async function listBoardMembers(boardId: string): Promise<BoardMember[]> {
  const { data, error } = await supabase
    .from('board_members')
    .select('*')
    .eq('board_id', boardId);
  if (error) throw error;
  return (data ?? []).map(toBM);
}

export async function listAllBoardMembers(): Promise<BoardMember[]> {
  const { data, error } = await supabase.from('board_members').select('*');
  if (error) throw error;
  return (data ?? []).map(toBM);
}

export async function addBoardMember(boardId: string, userId: string, role: MemberRole): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('board_members')
    .insert({ board_id: boardId, user_id: userId, role, invited_by: user?.id ?? null });
  if (error) throw error;
}

export async function updateBoardMember(boardId: string, userId: string, role: MemberRole): Promise<void> {
  const { error } = await supabase
    .from('board_members')
    .update({ role })
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function removeBoardMember(boardId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('board_members')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Folder members ───────────────────────────────────────────────────────
export async function listFolderMembers(folderId: string): Promise<FolderMember[]> {
  const { data, error } = await supabase
    .from('folder_members')
    .select('*')
    .eq('folder_id', folderId);
  if (error) throw error;
  return (data ?? []).map(toFM);
}

export async function listAllFolderMembers(): Promise<FolderMember[]> {
  const { data, error } = await supabase.from('folder_members').select('*');
  if (error) throw error;
  return (data ?? []).map(toFM);
}

export async function addFolderMember(folderId: string, userId: string, role: MemberRole): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('folder_members')
    .insert({ folder_id: folderId, user_id: userId, role, invited_by: user?.id ?? null });
  if (error) throw error;
}

export async function updateFolderMember(folderId: string, userId: string, role: MemberRole): Promise<void> {
  const { error } = await supabase
    .from('folder_members')
    .update({ role })
    .eq('folder_id', folderId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function removeFolderMember(folderId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('folder_members')
    .delete()
    .eq('folder_id', folderId)
    .eq('user_id', userId);
  if (error) throw error;
}
