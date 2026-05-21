// Documents / Drive module — Supabase Storage backed.
// File contents live in the private `drive` bucket under
// `{owner_id}/{file_id}-{filename}`; metadata lives in public.drive_items.

import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, Enums } from '@/types/database';

export type DriveKind = Enums<'drive_kind'>;
export type DbDriveItem = Tables<'drive_items'>;

export interface DriveItem {
  id: string;
  name: string;
  parentId: string | null;
  kind: DriveKind;
  size?: number | null;
  mime?: string | null;
  storagePath?: string | null;
  createdAt: string;
  ownerId: string;
  googleDriveId?: string | null;
  syncedAt?: string | null;
}

// 25 MB — matches the per-file limit in the drive Storage bucket policy.
export const DRIVE_MAX_FILE_BYTES = 25 * 1024 * 1024;
const BUCKET = 'drive';

function fromDb(r: DbDriveItem): DriveItem {
  return {
    id: r.id,
    name: r.name,
    parentId: r.parent_id,
    kind: r.kind,
    size: r.size_bytes,
    mime: r.mime,
    storagePath: r.storage_path,
    createdAt: r.created_at,
    ownerId: r.owner_id,
    googleDriveId: r.google_drive_id,
    syncedAt: r.synced_at,
  };
}

// ─── Items ────────────────────────────────────────────────────────────────
export async function listItems(): Promise<DriveItem[]> {
  const { data, error } = await supabase
    .from('drive_items')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDb);
}

export async function createFolder(name: string, parentId: string | null): Promise<DriveItem> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Folder name required');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const insert: TablesInsert<'drive_items'> = {
    owner_id: user.id,
    parent_id: parentId,
    kind: 'folder',
    name: trimmed,
  };
  const { data, error } = await supabase.from('drive_items').insert(insert).select('*').single();
  if (error) throw error;
  return fromDb(data);
}

export async function addFile(file: File, parentId: string | null): Promise<DriveItem> {
  if (file.size > DRIVE_MAX_FILE_BYTES) {
    throw new Error(`${file.name} is too large (${formatBytes(file.size)}). Max ${formatBytes(DRIVE_MAX_FILE_BYTES)}.`);
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Two-phase commit: upload to Storage first, then insert metadata. If the
  // metadata insert fails we clean up the orphan blob.
  const fileId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const storagePath = `${user.id}/${fileId}-${safeName}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  if (upErr) throw upErr;

  const insert: TablesInsert<'drive_items'> = {
    id: fileId,
    owner_id: user.id,
    parent_id: parentId,
    kind: 'file',
    name: file.name,
    size_bytes: file.size,
    mime: file.type || 'application/octet-stream',
    storage_path: storagePath,
  };
  const { data, error } = await supabase.from('drive_items').insert(insert).select('*').single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    throw error;
  }
  return fromDb(data);
}

export async function renameItem(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const { error } = await supabase.from('drive_items').update({ name: trimmed }).eq('id', id);
  if (error) throw error;
}

export async function deleteItem(id: string): Promise<void> {
  // Recursively delete the subtree. drive_items has ON DELETE CASCADE on
  // parent_id, but we also need to remove the Storage blobs ourselves.
  const all = await listItems();
  const toDrop = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const it of all) {
      if (it.parentId && toDrop.has(it.parentId) && !toDrop.has(it.id)) {
        toDrop.add(it.id);
        changed = true;
      }
    }
  }
  const blobPaths = all
    .filter((i) => toDrop.has(i.id) && i.kind === 'file' && i.storagePath)
    .map((i) => i.storagePath as string);
  if (blobPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(blobPaths);
  }
  // FK ON DELETE CASCADE handles children; deleting the root row is enough.
  const { error } = await supabase.from('drive_items').delete().eq('id', id);
  if (error) throw error;
}

export async function moveItem(id: string, newParentId: string | null): Promise<void> {
  const { error } = await supabase.from('drive_items').update({ parent_id: newParentId }).eq('id', id);
  if (error) throw error;
}

// Generates a short-lived signed URL for downloading or previewing a file.
export async function getDownloadUrl(item: DriveItem, expiresIn = 60 * 10): Promise<string | null> {
  if (item.kind !== 'file' || !item.storagePath) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(item.storagePath, expiresIn);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
export function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
export function ancestorChain(items: DriveItem[], folderId: string | null): DriveItem[] {
  if (!folderId) return [];
  const map = new Map(items.map((i) => [i.id, i]));
  const chain: DriveItem[] = [];
  let cur: DriveItem | undefined = map.get(folderId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return chain;
}
export function fileKindOf(name: string, mime?: string | null): { label: string; color: string } {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if ((mime ?? '').startsWith('image/'))                                return { label: 'Image',  color: '#EC4899' };
  if ((mime ?? '').startsWith('video/'))                                return { label: 'Video',  color: '#EF4444' };
  if ((mime ?? '').startsWith('audio/'))                                return { label: 'Audio',  color: '#F59E0B' };
  if (['pdf'].includes(ext) || mime === 'application/pdf')              return { label: 'PDF',    color: '#DC2626' };
  if (['xls', 'xlsx', 'csv'].includes(ext))                             return { label: 'Sheet',  color: '#16A34A' };
  if (['doc', 'docx'].includes(ext))                                    return { label: 'Doc',    color: '#2563EB' };
  if (['ppt', 'pptx'].includes(ext))                                    return { label: 'Slides', color: '#EA580C' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))                  return { label: 'Archive',color: '#7C3AED' };
  if (['txt', 'md', 'json', 'xml', 'log'].includes(ext))                return { label: 'Text',   color: '#374151' };
  return { label: 'File', color: '#6B7280' };
}
