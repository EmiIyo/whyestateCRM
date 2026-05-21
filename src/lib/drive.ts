// Documents / Drive module — local storage backed with a stubbed Google Drive
// connection. Replace `connectGoogleDriveMock` + `syncItemToGoogleDrive` with
// real `gapi.client.drive` calls once the OAuth client id is set.

const KEY_ITEMS  = 'we.drive.items';
const KEY_GOOGLE = 'we.drive.google';

// Max single-file size (bytes) we'll accept into localStorage. Beyond ~5 MB the
// browser blows the quota. Real Drive would stream upload — this guards local mode.
export const DRIVE_MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface DriveItem {
  id: string;
  name: string;
  parentId: string | null;   // null = root
  kind: 'folder' | 'file';
  size?: number;             // bytes — files only
  mime?: string;             // MIME — files only
  dataUrl?: string;          // base64 data URL — files only
  createdAt: string;         // ISO
  ownerEmail: string;
  googleDriveId?: string;
  syncedAt?: string;
}

export interface DriveGoogleState {
  connected: boolean;
  email?: string;
  connectedAt?: string;
  mockToken?: string;
}

// ─── Items ──────────────────────────────────────────────────────────────────
export function listItems(): DriveItem[] {
  try {
    const raw = localStorage.getItem(KEY_ITEMS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveItems(items: DriveItem[]): void {
  try { localStorage.setItem(KEY_ITEMS, JSON.stringify(items)); } catch (e) {
    // Most likely quota exceeded — surface a sensible error for the UI.
    throw new Error('Storage quota exceeded. Try removing some files first.');
  }
}

export function createFolder(name: string, parentId: string | null, ownerEmail: string): DriveItem {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Folder name required.');
  const folder: DriveItem = {
    id: `fld_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: trimmed,
    parentId,
    kind: 'folder',
    createdAt: new Date().toISOString(),
    ownerEmail,
  };
  saveItems([...listItems(), folder]);
  return folder;
}

export async function addFile(file: File, parentId: string | null, ownerEmail: string): Promise<DriveItem> {
  if (file.size > DRIVE_MAX_FILE_BYTES) {
    throw new Error(`${file.name} is too large (${formatBytes(file.size)}). Local storage allows up to ${formatBytes(DRIVE_MAX_FILE_BYTES)}.`);
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (ev) => resolve(ev.target?.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
  const item: DriveItem = {
    id: `fil_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: file.name,
    parentId,
    kind: 'file',
    size: file.size,
    mime: file.type || 'application/octet-stream',
    dataUrl,
    createdAt: new Date().toISOString(),
    ownerEmail,
  };
  saveItems([...listItems(), item]);
  return item;
}

export function renameItem(id: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  saveItems(listItems().map((i) => (i.id === id ? { ...i, name: trimmed } : i)));
}

// Delete an item and all its descendants (folders recursively).
export function deleteItem(id: string): void {
  const all = listItems();
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
  saveItems(all.filter((i) => !toDrop.has(i.id)));
}

export function moveItem(id: string, newParentId: string | null): void {
  saveItems(listItems().map((i) => (i.id === id ? { ...i, parentId: newParentId } : i)));
}

// ─── Google Drive connection (mock) ─────────────────────────────────────────
export function getDriveGoogleState(): DriveGoogleState {
  try {
    const raw = localStorage.getItem(KEY_GOOGLE);
    if (!raw) return { connected: false };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as DriveGoogleState : { connected: false };
  } catch { return { connected: false }; }
}
function saveDriveGoogleState(s: DriveGoogleState): void {
  try { localStorage.setItem(KEY_GOOGLE, JSON.stringify(s)); } catch { /* ignore */ }
}
export async function connectGoogleDriveMock(email: string): Promise<DriveGoogleState> {
  await new Promise((r) => setTimeout(r, 600));
  const next: DriveGoogleState = {
    connected: true,
    email,
    connectedAt: new Date().toISOString(),
    mockToken: `mock_${Date.now()}`,
  };
  saveDriveGoogleState(next);
  return next;
}
export function disconnectGoogleDrive(): void {
  saveDriveGoogleState({ connected: false });
}

// Mock — real path: `gapi.client.drive.files.create({ name, mimeType, parents })`
// then upload the body in a follow-up request.
export async function syncItemToGoogleDrive(itemId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 400));
  const all = listItems();
  saveItems(all.map((i) => i.id === itemId
    ? { ...i, googleDriveId: `gdrive_${Date.now()}`, syncedAt: new Date().toISOString() }
    : i));
}

// ─── Helpers ────────────────────────────────────────────────────────────────
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
// Resolve a chain of ancestors from root → folder, for the breadcrumb.
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
// Loose categorisation by extension/MIME → icon color tint.
export function fileKindOf(name: string, mime?: string): { label: string; color: string } {
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
