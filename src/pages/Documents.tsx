import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Folder as FolderIcon, FolderPlus, Upload, Search, ChevronRight, Home, Trash2,
  Pencil, MoreHorizontal, X, Check, Loader2, AlertCircle, FileText, Image as ImageIcon,
  Grid3x3, List, Mail, Link as LinkIcon,
} from 'lucide-react';
import {
  listItems, createFolder, addFile, renameItem, deleteItem,
  ancestorChain, fileKindOf, formatBytes, fmtDate, getDownloadUrl,
  type DriveItem,
} from '@/api/drive';
import { getMyConnection, type GoogleConnection } from '@/api/google';
import { notifyComingSoon, notifyError, notifySuccess } from '@/lib/notify';
import { getCurrentUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Compatibility shape — mirrors the old DriveGoogleState exposed by lib/drive.
interface DriveGoogleState {
  connected: boolean;
  email?: string;
  connectedAt?: string;
}
function toGoogleState(c: GoogleConnection | null): DriveGoogleState {
  if (!c) return { connected: false };
  return { connected: c.drive_connected, email: c.email, connectedAt: c.connected_at };
}

type ViewMode = 'grid' | 'list';

export default function DocumentsPage() {
  const me = getCurrentUser();
  const myEmail = me?.email ?? '';

  const [currentFolder, setCurrent]   = useState<string | null>(null);
  const [view, setView]               = useState<ViewMode>('grid');
  const [query, setQuery]             = useState('');
  const [renaming, setRenaming]       = useState<DriveItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DriveItem | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [busy, setBusy]               = useState(false);

  const [items, setItems]   = useState<DriveItem[]>([]);
  const [google, setGoogle] = useState<DriveGoogleState>({ connected: false });

  const refresh = useCallback(async () => {
    try {
      const [its, conn] = await Promise.all([listItems(), getMyConnection()]);
      setItems(its);
      setGoogle(toGoogleState(conn));
    } catch (e) { console.error('drive refresh failed', e); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const ch = supabase.channel('drive-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drive_items' }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [refresh]);

  const breadcrumb = useMemo(() => ancestorChain(items, currentFolder), [items, currentFolder]);

  const visible = useMemo(() => {
    const inFolder = items.filter((i) => i.parentId === currentFolder);
    const q = query.trim().toLowerCase();
    const filtered = q ? inFolder.filter((i) => i.name.toLowerCase().includes(q)) : inFolder;
    // Folders first, then files; both alphabetical
    return [...filtered].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [items, currentFolder, query]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        await addFile(f, currentFolder);
      }
      await refresh();
      notifySuccess(files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload file.');
      notifyError('Upload failed', e);
    }
    setBusy(false);
  };

  const onNewFolder = async () => {
    const name = window.prompt('Folder name');
    if (!name?.trim()) return;
    try {
      await createFolder(name.trim(), currentFolder);
      await refresh();
      notifySuccess('Folder created');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create folder.');
      notifyError('Could not create folder', e);
    }
  };

  const handleSync = async (_id: string) => {
    notifyComingSoon('Google Drive sync');
  };

  const downloadFile = async (it: DriveItem) => {
    try {
      const url = await getDownloadUrl(it);
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = it.name;
      a.target = '_blank';
      a.click();
    } catch (e) {
      notifyError('Could not download the file', e);
    }
  };

  const openFolder = (id: string) => { setCurrent(id); setQuery(''); };

  // Total size summary for footer
  const totals = useMemo(() => {
    let files = 0; let folders = 0; let bytes = 0;
    for (const i of items) {
      if (i.kind === 'file') { files++; bytes += i.size ?? 0; } else folders++;
    }
    return { files, folders, bytes };
  }, [items]);

  return (
    <div className="flex-1 overflow-auto" style={{ background: '#F5F7FA' }}>
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1A202C' }}>Documents</h1>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Files, folders, and Google Drive sync</p>
          </div>
          <div className="flex items-center gap-2">
            {google.connected ? (
              <button onClick={() => notifyComingSoon('Google Drive sync')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors hover:bg-gray-50"
                style={{ borderColor: '#D1F2EF', color: '#0F766E', background: '#F0FBFA' }}>
                <GoogleDot /> Connected · {google.email}
              </button>
            ) : (
              <button onClick={() => notifyComingSoon('Google Drive sync')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors hover:border-[#1EC9C4] hover:text-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}>
                <GoogleDot /> Connect Google Drive
              </button>
            )}
            <button onClick={onNewFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold text-gray-600 hover:border-[#1EC9C4] hover:text-[#1EC9C4] bg-white transition-colors"
              style={{ borderColor: '#E5E7EB' }}>
              <FolderPlus size={13} /> New Folder
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ background: '#1EC9C4' }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden"
              onChange={(e) => { onPickFiles(e.target.files); e.target.value = ''; }} />
          </div>
        </div>

        {/* Breadcrumb + search */}
        <div className="flex items-center justify-between bg-white rounded-2xl border px-4 py-3 mb-4" style={{ borderColor: '#F1F5F9' }}>
          <div className="flex items-center gap-1.5 text-sm font-medium overflow-hidden">
            <button onClick={() => setCurrent(null)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors ${currentFolder === null ? 'text-[#1A202C] font-bold' : 'text-gray-500'}`}>
              <Home size={13} /> My Drive
            </button>
            {breadcrumb.map((b, idx) => (
              <span key={b.id} className="flex items-center gap-1">
                <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
                <button onClick={() => setCurrent(b.id)}
                  className={`px-2 py-1 rounded-md hover:bg-gray-100 truncate transition-colors ${idx === breadcrumb.length - 1 ? 'text-[#1A202C] font-bold' : 'text-gray-500'}`}>
                  {b.name}
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 border rounded-full px-3 py-1.5 bg-white focus-within:border-[#1EC9C4]" style={{ borderColor: '#E5E7EB' }}>
              <Search size={13} style={{ color: '#A1A9B6' }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this folder…"
                className="text-xs outline-none bg-transparent placeholder:text-gray-300 w-44" />
              {query && <button onClick={() => setQuery('')}><X size={11} className="text-gray-300 hover:text-gray-500" /></button>}
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded-lg border" style={{ borderColor: '#E5E7EB', background: '#F8FAFB' }}>
              {(['grid', 'list'] as ViewMode[]).map((v) => (
                <button key={v} onClick={() => setView(v)} title={v}
                  className={`px-2 py-1 rounded-md transition-colors ${view === v ? 'bg-white shadow-sm' : 'hover:bg-white/60'}`}
                  style={{ color: view === v ? '#1A202C' : '#9CA3AF' }}>
                  {v === 'grid' ? <Grid3x3 size={12} /> : <List size={12} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#991B1B' }}>
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
          </div>
        )}

        {/* Body */}
        {visible.length === 0 ? (
          <EmptyState
            inSearch={!!query.trim()}
            onUpload={() => fileInputRef.current?.click()}
            onNewFolder={onNewFolder}
          />
        ) : view === 'grid' ? (
          <GridView
            items={visible}
            onOpen={(it) => it.kind === 'folder' ? openFolder(it.id) : downloadFile(it)}
            onRename={(it) => setRenaming(it)}
            onDelete={(it) => setConfirmDelete(it)}
            onSync={(it) => handleSync(it.id)}
            onDownload={downloadFile}
            googleConnected={google.connected}
          />
        ) : (
          <ListView
            items={visible}
            onOpen={(it) => it.kind === 'folder' ? openFolder(it.id) : downloadFile(it)}
            onRename={(it) => setRenaming(it)}
            onDelete={(it) => setConfirmDelete(it)}
            onSync={(it) => handleSync(it.id)}
            onDownload={downloadFile}
            googleConnected={google.connected}
          />
        )}

        {/* Footer summary */}
        <div className="mt-4 flex items-center justify-between text-[11px]" style={{ color: '#9CA3AF' }}>
          <span>{totals.folders} folders · {totals.files} files · {formatBytes(totals.bytes)} used</span>
          <span>Local storage limited to ~5 MB per file. Connect Drive to sync larger ones.</span>
        </div>
      </div>

      {renaming && (
        <RenameModal item={renaming}
          onClose={() => setRenaming(null)}
          onSaved={() => { setRenaming(null); void refresh(); notifySuccess('Renamed'); }} />
      )}
      {confirmDelete && (
        <ConfirmDeleteModal item={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={async () => {
            try {
              await deleteItem(confirmDelete.id);
              notifySuccess(confirmDelete.kind === 'folder' ? 'Folder deleted' : 'File deleted');
            } catch (e) {
              notifyError('Delete failed', e);
            }
            setConfirmDelete(null);
            await refresh();
          }} />
      )}
      {/* ConnectDriveModal kept for the day real OAuth lands — coming-soon
          toast is fired instead from the connect buttons today. */}
    </div>
  );
}

// ─── Grid view ───────────────────────────────────────────────────────────────
function GridView({ items, onOpen, onRename, onDelete, onSync, onDownload, googleConnected }: {
  items: DriveItem[];
  onOpen: (it: DriveItem) => void;
  onRename: (it: DriveItem) => void;
  onDelete: (it: DriveItem) => void;
  onSync: (it: DriveItem) => void;
  onDownload: (it: DriveItem) => void;
  googleConnected: boolean;
}) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
      {items.map((it) => (
        <ItemCard key={it.id} item={it}
          onOpen={() => onOpen(it)} onRename={() => onRename(it)} onDelete={() => onDelete(it)}
          onSync={() => onSync(it)} onDownload={() => onDownload(it)} googleConnected={googleConnected} />
      ))}
    </div>
  );
}

function ItemCard({ item, onOpen, onRename, onDelete, onSync, onDownload, googleConnected }: {
  item: DriveItem;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSync: () => void;
  onDownload: () => void;
  googleConnected: boolean;
}) {
  const isImage = item.mime?.startsWith('image/');
  const kind = item.kind === 'folder'
    ? { label: 'Folder', color: '#0F766E' }
    : fileKindOf(item.name, item.mime);

  return (
    <div onDoubleClick={onOpen}
      className="relative group bg-white border rounded-2xl overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
      style={{ borderColor: '#F1F5F9' }}>
      {/* Preview */}
      <div className="aspect-square w-full flex items-center justify-center"
        style={{ background: item.kind === 'folder' ? '#F0FBFA' : isImage ? 'white' : kind.color + '11' }}>
        {item.kind === 'folder' ? (
          <FolderIcon size={44} style={{ color: '#0F766E' }} strokeWidth={1.5} />
        ) : isImage ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-14 rounded-lg flex items-center justify-center" style={{ background: kind.color + '22' }}>
              <ImageIcon size={22} style={{ color: kind.color }} strokeWidth={1.5} />
            </div>
            <span className="mt-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: kind.color }}>{kind.label}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-12 h-14 rounded-lg flex items-center justify-center" style={{ background: kind.color + '22' }}>
              <FileText size={22} style={{ color: kind.color }} strokeWidth={1.5} />
            </div>
            <span className="mt-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: kind.color }}>{kind.label}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 border-t" style={{ borderColor: '#F1F5F9' }}>
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold truncate flex-1" style={{ color: '#1A202C' }} title={item.name}>{item.name}</p>
          {item.googleDriveId && <GoogleDot small />}
        </div>
        <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>
          {item.kind === 'file' ? `${formatBytes(item.size ?? 0)} · ` : ''}{fmtDate(item.createdAt)}
        </p>
      </div>

      {/* Hover actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ItemMenu item={item} onRename={onRename} onDelete={onDelete} onSync={onSync} onDownload={onDownload} onOpen={onOpen} googleConnected={googleConnected} />
      </div>
    </div>
  );
}

// ─── List view ───────────────────────────────────────────────────────────────
function ListView({ items, onOpen, onRename, onDelete, onSync, onDownload, googleConnected }: {
  items: DriveItem[];
  onOpen: (it: DriveItem) => void;
  onRename: (it: DriveItem) => void;
  onDelete: (it: DriveItem) => void;
  onSync: (it: DriveItem) => void;
  onDownload: (it: DriveItem) => void;
  googleConnected: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#F1F5F9' }}>
      <div className="grid px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: '#F8FAFB', color: '#6B7280', gridTemplateColumns: '1fr 100px 120px 60px' }}>
        <span>Name</span>
        <span className="text-right">Size</span>
        <span>Modified</span>
        <span />
      </div>
      <ul>
        {items.map((it) => {
          const kind = it.kind === 'folder' ? { label: 'Folder', color: '#0F766E' } : fileKindOf(it.name, it.mime);
          const isImage = it.mime?.startsWith('image/');
          return (
            <li key={it.id} className="border-t hover:bg-gray-50 transition-colors group" style={{ borderColor: '#F1F5F9' }}>
              <div className="grid items-center px-4 py-2.5 gap-3" style={{ gridTemplateColumns: '1fr 100px 120px 60px' }}>
                <button onClick={() => onOpen(it)}
                  className="flex items-center gap-3 min-w-0 text-left">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ background: it.kind === 'folder' ? '#F0FBFA' : kind.color + '22' }}>
                    {it.kind === 'folder' ? (
                      <FolderIcon size={16} style={{ color: '#0F766E' }} />
                    ) : isImage ? (
                      <ImageIcon size={14} style={{ color: kind.color }} />
                    ) : (
                      <FileText size={14} style={{ color: kind.color }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1A202C' }}>{it.name}</p>
                    <p className="text-[10px] truncate" style={{ color: '#9CA3AF' }}>{kind.label}</p>
                  </div>
                  {it.googleDriveId && <GoogleDot small />}
                </button>
                <span className="text-xs text-right tabular-nums" style={{ color: '#6B7280' }}>
                  {it.kind === 'file' ? formatBytes(it.size ?? 0) : '—'}
                </span>
                <span className="text-xs" style={{ color: '#6B7280' }}>{fmtDate(it.createdAt)}</span>
                <div className="flex justify-end">
                  <ItemMenu item={it} onRename={() => onRename(it)} onDelete={() => onDelete(it)}
                    onSync={() => onSync(it)} onDownload={() => onDownload(it)} onOpen={() => onOpen(it)}
                    googleConnected={googleConnected} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Per-item action menu ────────────────────────────────────────────────────
function ItemMenu({ item, onOpen, onRename, onDelete, onSync, onDownload, googleConnected }: {
  item: DriveItem;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSync: () => void;
  onDownload: () => void;
  googleConnected: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
        style={{ background: 'rgba(255,255,255,0.9)' }}
        title="More">
        <MoreHorizontal size={14} className="text-gray-500" />
      </button>
      {open && (
        <div className="absolute z-50 right-0 top-full mt-1 min-w-[180px] bg-white rounded-xl border border-gray-100 py-1"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <MenuButton icon={item.kind === 'folder' ? <FolderIcon size={12} /> : <ImageIcon size={12} />}
            label={item.kind === 'folder' ? 'Open' : 'Download'}
            onClick={() => { setOpen(false); if (item.kind === 'folder') onOpen(); else onDownload(); }} />
          {item.kind === 'file' && (
            <MenuButton icon={<GoogleDot small />}
              label={item.googleDriveId ? 'Re-sync to Drive' : 'Sync to Drive'}
              onClick={() => { setOpen(false); onSync(); }}
              disabled={!googleConnected}
              hint={googleConnected ? undefined : 'Connect Drive first'} />
          )}
          <MenuButton icon={<Pencil size={12} />} label="Rename" onClick={() => { setOpen(false); onRename(); }} />
          <div className="my-1 border-t border-gray-100" />
          <MenuButton icon={<Trash2 size={12} />} label="Delete" onClick={() => { setOpen(false); onDelete(); }} danger />
        </div>
      )}
    </div>
  );
}
function MenuButton({ icon, label, onClick, danger, disabled, hint }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean; hint?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={hint}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-colors"
      style={{ color: danger ? '#DC2626' : '#374151' }}>
      {icon}<span>{label}</span>
    </button>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ inSearch, onUpload, onNewFolder }: { inSearch: boolean; onUpload: () => void; onNewFolder: () => void }) {
  if (inSearch) {
    return (
      <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: '#F1F5F9' }}>
        <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: '#F3F4F6' }}>
          <Search size={20} className="text-gray-300" />
        </div>
        <p className="text-sm font-medium" style={{ color: '#6B7280' }}>No matches</p>
        <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Try a different search term.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: '#F1F5F9' }}>
      <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ background: '#F0FBFA' }}>
        <FolderIcon size={26} style={{ color: '#0F766E' }} />
      </div>
      <h3 className="text-sm font-bold" style={{ color: '#1A202C' }}>This folder is empty</h3>
      <p className="text-xs mt-1 mb-4" style={{ color: '#9CA3AF' }}>Drop files here or use the buttons below.</p>
      <div className="flex items-center justify-center gap-2">
        <button onClick={onNewFolder}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold text-gray-600 hover:border-[#1EC9C4] hover:text-[#1EC9C4] bg-white"
          style={{ borderColor: '#E5E7EB' }}>
          <FolderPlus size={13} /> New Folder
        </button>
        <button onClick={onUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90"
          style={{ background: '#1EC9C4' }}>
          <Upload size={13} /> Upload File
        </button>
      </div>
    </div>
  );
}

// ─── Rename modal ────────────────────────────────────────────────────────────
function RenameModal({ item, onClose, onSaved }: { item: DriveItem; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item.name);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const submit = async () => {
    const v = name.trim();
    if (!v || v === item.name) { onClose(); return; }
    try { await renameItem(item.id, v); } catch (e) { console.error(e); }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-[400px] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F0FBFA' }}>
              <Pencil size={14} style={{ color: '#0F766E' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>Rename {item.kind}</h3>
              <p className="text-xs mt-0.5 truncate max-w-[260px]" style={{ color: '#9CA3AF' }}>{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>
        <div className="px-6 pb-5">
          <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: '#6B7280' }}>Name</label>
          <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
            style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={!name.trim() || name.trim() === item.name}
            className="px-5 py-1.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            style={{ background: '#1EC9C4' }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm-delete modal ────────────────────────────────────────────────────
function ConfirmDeleteModal({ item, onClose, onConfirm }: { item: DriveItem; onClose: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter') onConfirm(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, onConfirm]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-[400px] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-start gap-3 px-6 pt-5 pb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FEE2E2' }}>
            <AlertCircle size={17} style={{ color: '#DC2626' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>Delete {item.kind}?</h3>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6B7280' }}>
              <strong className="font-semibold truncate" style={{ color: '#1A202C' }}>{item.name}</strong>
              {item.kind === 'folder' ? ' and everything inside it' : ''} will be permanently removed.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm}
            className="px-5 py-1.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ background: '#DC2626' }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ConnectDriveModal removed — Google Drive integration now fires a
// "coming soon" toast directly from the connect button. The real OAuth modal
// will live here once the Drive API client id is provisioned.

// ─── Helpers ─────────────────────────────────────────────────────────────────
function GoogleDot({ small = false, inverted = false }: { small?: boolean; inverted?: boolean }) {
  const size = small ? 11 : 14;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="flex-shrink-0">
      <path fill={inverted ? 'white' : '#4285F4'} d="M21.35 11.1H12v3.2h5.35c-.23 1.49-1.66 4.36-5.35 4.36-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.56-2.46C16.7 4.27 14.55 3.3 12 3.3 6.92 3.3 2.8 7.42 2.8 12.5s4.12 9.2 9.2 9.2c5.32 0 8.85-3.73 8.85-8.99 0-.6-.06-1.06-.15-1.61z" />
    </svg>
  );
}

