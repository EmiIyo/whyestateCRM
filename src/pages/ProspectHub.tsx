import { useState, useRef, useEffect, useMemo, MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx-js-style';
import {
  Plus, Search, Filter, Download, Upload, ChevronDown, ChevronLeft, ChevronRight, X, Check, Trash2, Copy,
  AlertCircle, CheckCircle2, Loader2, Users, UserPlus,
  GripVertical, Settings2, Mail, Folder as FolderIcon, FolderPlus, Layers,
  FileText, FileSpreadsheet, Eye,
} from 'lucide-react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { getCurrentUser, listAllUsers, getAvatarColor, getAvatarImage, getUserTier } from '@/lib/auth';
import { importFromProspect, listClients } from '@/lib/clients';

// Tier display tones — mirror Admin Control's TIER_TONES so badges match
// across User Setting, sidebar, topbar, and member lists.
const TIER_BADGE_TONES: Record<string, { bg: string; text: string }> = {
  'Agent':          { bg: '#E0F2FE', text: '#0369A1' },
  'Staff':          { bg: '#F3F4F6', text: '#374151' },
  'Branch Manager': { bg: '#FEF3C7', text: '#92400E' },
  'Branch Partner': { bg: '#EDE9FE', text: '#7C3AED' },
};

// ─── Board types ──────────────────────────────────────────────────────────────
interface Board {
  id: string;
  name: string;
  location: string;
  color: string;
  ownerEmail: string;
  ownerName: string;
  folderId: string | null;
}

interface Folder {
  id: string;
  name: string;
  ownerEmail: string;
  ownerName?: string;
}

const BOARD_COLORS = [
  '#F97316','#1EC9C4','#8B5CF6','#EF4444','#22C55E','#F59E0B',
  '#3B82F6','#EC4899','#7C3AED','#06B6D4',
];


const SEED_BOARDS_TEMPLATE: Omit<Board, 'ownerEmail' | 'ownerName' | 'folderId'>[] = [
  { id: 'board_1', name: 'Millerz Square',   location: 'Old Klang Road',      color: '#F97316' },
  { id: 'board_2', name: 'AKASA',            location: 'Cheras',              color: '#1EC9C4' },
  { id: 'board_3', name: 'The Rainz',        location: 'Bukit Jalil',         color: '#8B5CF6' },
  { id: 'board_4', name: 'Nidoz Residence',  location: 'Desa Petaling',       color: '#EF4444' },
  { id: 'board_5', name: "D'Nuri",           location: 'Desa Petaling',       color: '#22C55E' },
  { id: 'board_6', name: 'Solaris Parq',     location: 'Old Klang Road',      color: '#F59E0B' },
];

interface AgentPreset {
  id: string;
  name: string;
  color: string; // palette key — see AGENT_COLOR_PALETTE
}

// ─── Recycle Bin ────────────────────────────────────────────────────────────
// Soft-delete: every delete moves the entity into the bin instead of dropping
// it. Items can be restored or permanently purged from the Recycle Bin modal.
type RecycledItem =
  | { kind: 'board';    id: string; deletedAt: string; deletedBy: string; payload: { board: unknown; prospects: unknown; members: unknown } }
  | { kind: 'folder';   id: string; deletedAt: string; deletedBy: string; payload: { folder: unknown; members: unknown } }
  | { kind: 'prospect'; id: string; deletedAt: string; deletedBy: string; payload: { boardId: string; prospect: unknown; customValues: unknown } };

// Shared CRM data lives in localStorage so invitations work across users on the
// same browser. (Same model translates 1:1 to Supabase RLS when wired.)
const CRM_STORAGE_KEY = 'we.crm.state';
interface CrmState {
  boards:        Board[];
  prospects:     Record<string, Prospect[]>;
  members:       Record<string, BoardMember[]>;
  folders?:      Folder[];
  folderMembers?: Record<string, BoardMember[]>;
  agents?:       AgentPreset[];
  recycleBin?:   RecycledItem[];
}
function loadCrmState(): CrmState | null {
  try {
    const raw = localStorage.getItem(CRM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CrmState;
    if (!parsed || !Array.isArray(parsed.boards)) return null;
    return parsed;
  } catch { return null; }
}
function saveCrmState(state: CrmState): void {
  try { localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// ─── Demo data generator (50 boards × 300 prospects) ────────────────────────
const DEMO_PROJECT_NAMES = [
  'Millerz Square', 'AKASA Cheras', 'The Rainz', 'Nidoz Residence', "D'Nuri",
  'Solaris Parq', 'Setia Walk', 'Tropicana Gardens', 'Verve Suites', 'M City',
  'Vortex KLCC', 'Quill Residences', 'The Westside', 'Damansara Foresta', 'Tamarind Suites',
  'Pavilion Hilltop', 'Stonor 3', 'Trion @ KL', 'Sentul Point', 'United Point',
  'KL Eco City', 'Reizz Residence', 'Cendana Penthouse', 'Empire City', 'Atria SOFO',
  'Ativo Plaza', 'You Vista', 'You City', 'Aliya Sentul', 'Sentral Suites',
  'Kiara 9 Mont Kiara', 'The Hub SS2', 'Tropicana Avenue', 'Sunway Geo', 'Suasana Bukit Ceylon',
  'Dorsett Residences', 'Skyworld', 'Twin Tower Bandar', 'EkoCheras', 'Ascent Paradigm',
  'Selasih Bangi', 'Bukit OUG Condominium', 'Casa Indah', 'Plaza Damas 3', 'Maxim Residences',
  'Glomac Centro', 'Subang Olives', 'Pacific Star', 'Setia City Residences', 'Hartamas Heights',
];
const DEMO_LOCATIONS = [
  'Old Klang Road', 'Cheras', 'Bukit Jalil', 'Desa Petaling', 'Mont Kiara', 'Bangsar', 'KLCC', 'Damansara',
  'Subang', 'Petaling Jaya', 'Sentul', 'Brickfields', 'Setapak', 'Wangsa Maju', 'Ampang', 'Cyberjaya',
  'Puchong', 'Bandar Sunway', 'Shah Alam', 'Kajang', 'Bandar Kinrara', 'Sri Hartamas', 'Mid Valley', 'Bandar Utama',
];
const DEMO_FIRST_NAMES = [
  'Ahmad', 'Siti', 'Mohd', 'Nur', 'Wong', 'Lim', 'Tan', 'Lee', 'Chan', 'Goh', 'Cheong', 'Yap', 'Teh',
  'Raj', 'Kumar', 'Priya', 'Anand', 'Devi', 'Aisha', 'Hafiz', 'Zulkifli', 'Farah', 'Rosli', 'Iskandar',
  'Joel', 'Cheryl', 'Ian', 'Mei Ling', 'Chee Wei', 'Kim Min', 'Jun Hau', 'Yoo Sen', 'Chia Ling',
];
const DEMO_LAST_NAMES = [
  'bin Hassan', 'binti Ibrahim', 'Cheng', 'Ling', 'Kaur', 'Singh', 'Wei', 'Hong', 'Loh', 'Hoo',
  'Choon May', 'Chia Yen', "A/L Murugam", 'A/P Devi', 'Othman', 'Razak', 'Yusof', 'Bakar', 'Tan', 'Lim',
];
const DEMO_TYPES = ['A1', 'A1-B', 'A1-E', 'A1-F', 'A2', 'B1', 'B1-B', 'B2', 'B2-D', 'B3', 'C1', 'C2', 'D1', 'PH-A'];
const DEMO_SIZES = ['850', '900', '1100', '1219', '1300', '1403', '1500', '1700', '2100'];
const DEMO_PHONE_PREFIXES = ['012', '013', '014', '016', '017', '018', '019', '011'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(p: number): boolean { return Math.random() < p; }

function genPhone(): string {
  const prefix = pick(DEMO_PHONE_PREFIXES);
  const num = String(Math.floor(Math.random() * 9_000_000) + 1_000_000);
  return `${prefix}-${num}`;
}

function genUnitNo(floor: number, unit: number): string {
  const block = String.fromCharCode(65 + Math.floor(Math.random() * 4));
  return `${block}-${String(floor).padStart(2, '0')}-${String(unit).padStart(2, '0')}`;
}

function genProspect(seq: number): Prospect {
  const first = pick(DEMO_FIRST_NAMES);
  const last  = pick(DEMO_LAST_NAMES);
  const partner = chance(0.25) ? ` / ${pick(DEMO_FIRST_NAMES)} ${pick(DEMO_LAST_NAMES)}` : '';
  const filledIn = chance(0.7);
  const callingStatus = filledIn ? pick<CallingStatus>(['Positive', 'Negative', 'Neutral']) : '';
  const listingPick = filledIn ? pick(['Rent', 'Sale', 'Rent,Sale']) : '';
  const furnishing  = filledIn ? pick<Furnishing>(['Fully Furnished', 'Partly Furnished', 'Bare Unit']) : '';
  const availability= filledIn ? pick<Availability>(['Available', 'NOT Available']) : '';
  const phone1 = genPhone();
  const phone2 = chance(0.2) ? ` / ${genPhone()}` : '';
  return {
    id: `p_${Date.now().toString(36)}_${seq}_${Math.random().toString(36).slice(2, 8)}`,
    name: `${first} ${last}${partner}`,
    unitNo: genUnitNo(Math.floor(Math.random() * 30) + 1, Math.floor(Math.random() * 18) + 1),
    type: pick(DEMO_TYPES),
    size: pick(DEMO_SIZES),
    phone: `${phone1}${phone2}`,
    agent: '',
    lastUpdate: '',
    callingStatus,
    listingType: listingPick,
    furnishing,
    availability,
    askingRent:  filledIn && chance(0.7) ? String(1500 + Math.floor(Math.random() * 5000)) : '',
    askingPrice: filledIn && chance(0.5) ? String(450_000 + Math.floor(Math.random() * 1_500_000)) : '',
    remark: '',
  };
}

// Folders used by Load Demo — 5 location-named buckets, each holding 10 boards.
const DEMO_FOLDER_LOCATIONS = ['KLCC & Bukit Bintang', 'Mont Kiara & Damansara', 'Cheras & Bukit Jalil', 'Petaling Jaya & Subang', 'Sentul & Setapak'];

function generateDemoSeed(ownerEmail: string, ownerName: string, boardCount = 50, prospectsPerBoard = 300): {
  boards: Board[];
  prospects: Record<string, Prospect[]>;
  folders: Folder[];
} {
  // Build the 5 location folders
  const ts = Date.now().toString(36);
  const folders: Folder[] = DEMO_FOLDER_LOCATIONS.map((loc, i) => ({
    id: `demo_f_${ts}_${i}`,
    name: loc,
    ownerEmail,
  }));
  const folderCount = folders.length;
  const boardsPerFolder = Math.floor(boardCount / folderCount); // 10

  const boards: Board[] = [];
  const prospects: Record<string, Prospect[]> = {};
  let seq = 0;
  for (let i = 0; i < boardCount; i++) {
    const id = `demo_b_${ts}_${i}`;
    // First (folderCount * boardsPerFolder) boards get bucketed into folders, rest stay ungrouped.
    const folderIdx = Math.floor(i / boardsPerFolder);
    const folderId  = folderIdx < folderCount ? folders[folderIdx].id : null;
    const board: Board = {
      id,
      name:     DEMO_PROJECT_NAMES[i % DEMO_PROJECT_NAMES.length],
      location: pick(DEMO_LOCATIONS),
      color:    BOARD_COLORS[i % BOARD_COLORS.length],
      ownerEmail, ownerName, folderId,
    };
    boards.push(board);
    const arr: Prospect[] = [];
    for (let j = 0; j < prospectsPerBoard; j++) arr.push(genProspect(seq++));
    prospects[id] = arr;
  }
  return { boards, prospects, folders };
}

// ─── New Board Modal ──────────────────────────────────────────────────────────
function NewBoardModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (name: string, location: string, color: string) => void;
}) {
  const [name, setName]         = useState('');
  const [location, setLocation] = useState('');
  const [color, setColor]       = useState(BOARD_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const initials = name.trim()
    ? name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
    : 'BD';

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), location.trim(), color);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-[420px] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div>
            <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>New Board</h3>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create a project board</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="px-6 pb-5 space-y-4">
          {/* Project Name */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#374151' }}>Project Name</label>
            <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
              placeholder="e.g. Millerz Square"
              className="w-full text-sm border rounded-xl px-3 py-2.5 outline-none transition-all"
              style={{ borderColor: color, boxShadow: `0 0 0 3px ${color}22` }} />
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#374151' }}>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
              placeholder="e.g. Old Klang Road"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-gray-400 transition-all" />
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: '#374151' }}>Color</label>
            <div className="flex flex-nowrap items-center justify-center gap-1.5">
              {BOARD_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-6 h-6 shrink-0 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ background: c, boxShadow: color === c && BOARD_COLORS.includes(color) ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none' }}>
                  {color === c && BOARD_COLORS.includes(color) && <Check size={11} className="text-white" strokeWidth={3} />}
                </button>
              ))}

              {/* Custom color swatch */}
              <label
                className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 relative"
                title="Custom colour"
                style={{
                  background: !BOARD_COLORS.includes(color) ? color : 'transparent',
                  border: !BOARD_COLORS.includes(color) ? 'none' : '1.5px dashed #C7CCD6',
                  boxShadow: !BOARD_COLORS.includes(color) ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none',
                }}>
                {!BOARD_COLORS.includes(color) ? (
                  <Check size={11} className="text-white drop-shadow" strokeWidth={3} style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.6))' }} />
                ) : (
                  <Plus size={12} strokeWidth={2.5} style={{ color: '#7C8AA0' }} />
                )}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: color }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.22)', color: 'white' }}>{initials}</div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white opacity-70">{location.trim() || 'Location'}</p>
              <p className="text-sm font-bold text-white truncate">{name.trim() || 'Project Name'}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={!name.trim()}
            className="px-5 py-1.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            style={{ background: color }}>Create Board</button>
        </div>
      </div>
    </div>
  );
}

// ─── Board Card ───────────────────────────────────────────────────────────────
function BoardCard({ board, memberCount, updatedPct, onOpen, onManage, arrangeMode, dragHandlers, showManageGear = true }: {
  board: Board;
  memberCount: number;
  updatedPct: number;
  onOpen: () => void;
  onManage: () => void;
  arrangeMode?: boolean;
  showManageGear?: boolean;
  dragHandlers?: {
    draggable: boolean;
    onDragStart: () => void;
    onDragEnter: () => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent) => void;
  };
}) {
  return (
    <div
      onClick={arrangeMode ? undefined : onOpen}
      role={arrangeMode ? undefined : 'button'}
      tabIndex={arrangeMode ? -1 : 0}
      onKeyDown={(e) => { if (!arrangeMode && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); } }}
      draggable={dragHandlers?.draggable}
      onDragStart={dragHandlers?.onDragStart}
      onDragEnter={dragHandlers?.onDragEnter}
      onDragEnd={dragHandlers?.onDragEnd}
      onDragOver={dragHandlers?.onDragOver}
      className={[
        'relative rounded-2xl overflow-hidden flex flex-col text-left w-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
        arrangeMode ? 'cursor-grab active:cursor-grabbing wiggle' : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-xl',
      ].join(' ')}
      style={{ background: board.color, minHeight: 156, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}
    >
      {/* Top-right settings cog (hidden in arrange mode and when role can't manage) */}
      {!arrangeMode && showManageGear && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onManage(); }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Settings"
          aria-label="Open board settings"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/35 hover:scale-110"
          style={{ background: 'rgba(255,255,255,0.22)' }}
        >
          <Settings2 size={14} className="text-white" />
        </button>
      )}
      {arrangeMode && (
        <div className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(255,255,255,0.22)' }}>
          <GripVertical size={14} className="text-white" />
        </div>
      )}

      <div className="flex-1 p-5 flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/85">• PROJECT</span>
        <p className="text-lg font-bold text-white leading-tight pr-10">{board.name}</p>
        {board.location && (
          <p className="text-xs text-white/85 leading-tight -mt-1">{board.location}</p>
        )}

        <div className="mt-1">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-white"
            style={{ background: 'rgba(255,255,255,0.22)' }}
          >
            <Users size={11} />
            {memberCount} {memberCount === 1 ? 'members' : 'members'}
          </span>
        </div>
      </div>

      {/* Progress: % of prospects with a Last Update timestamp */}
      <div className="px-5 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/75">Status</span>
          <span className="text-[11px] font-bold text-white">{updatedPct}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.25)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${updatedPct}%`, background: 'rgba(255,255,255,0.9)' }} />
        </div>
      </div>

      <div className="px-5 pb-4 pt-1">
        <span className="text-xs font-medium text-white/90">Open →</span>
      </div>
    </div>
  );
}

// ─── Folder Prompt Modal (replaces window.prompt for create / rename) ────────
function FolderPromptModal({
  mode, initial, onSubmit, onClose,
}: {
  mode: 'create' | 'rename';
  initial: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  };

  const isRename = mode === 'rename';
  const title = isRename ? 'Rename folder' : 'New folder';
  const subtitle = isRename ? 'Update the folder name' : 'Group related boards together';
  const ctaLabel = isRename ? 'Save' : 'Create';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-[400px] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#DAF3F2' }}>
              <FolderIcon size={15} style={{ color: '#0F766E' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>{title}</h3>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="px-6 pb-5">
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#374151' }}>Folder name</label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
            placeholder="e.g. KLCC & Bukit Bintang"
            className="w-full text-sm border rounded-xl px-3 py-2.5 outline-none transition-all"
            style={{ borderColor: '#1EC9C4', boxShadow: '0 0 0 3px #1EC9C422' }}
          />
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={submit}
            disabled={!name.trim() || (isRename && name.trim() === initial.trim())}
            className="px-5 py-1.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#1EC9C4' }}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Modal (replaces window.confirm for destructive actions) ─────────
function ConfirmModal({
  title, message, confirmLabel = 'Delete', tone = 'danger', onConfirm, onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') { onConfirm(); onClose(); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onConfirm, onClose]);

  const accent = tone === 'danger' ? '#DC2626' : '#1EC9C4';
  const accentBg = tone === 'danger' ? '#FEE2E2' : '#DAF3F2';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-[400px] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-start gap-3 px-6 pt-5 pb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accentBg }}>
            <AlertCircle size={17} style={{ color: accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>{title}</h3>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6B7280' }}>{message}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="px-5 py-1.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ background: accent }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Recycle Bin Modal — restore or permanently delete soft-deleted items ───
function RecycleBinModal({
  items, canRestore, canPurge, onRestore, onPurge, onEmpty, onClose,
}: {
  items: RecycledItem[];
  canRestore: boolean;
  canPurge: boolean;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onEmpty: () => void;
  onClose: () => void;
}) {
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const labelOf = (it: RecycledItem): string => {
    if (it.kind === 'board')    return (it.payload as { board: Board }).board.name || 'Untitled board';
    if (it.kind === 'folder')   return (it.payload as { folder: Folder }).folder.name || 'Untitled folder';
    return (it.payload as { prospect: Prospect }).prospect.name || '(no name)';
  };
  const subOf = (it: RecycledItem): string => {
    if (it.kind === 'board')    return `Board · ${(it.payload as { prospects: Prospect[] }).prospects.length} prospects`;
    if (it.kind === 'folder')   return 'Folder';
    return 'Prospect row';
  };
  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-[520px] max-h-[85vh] flex flex-col overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FEE2E2' }}>
              <Trash2 size={15} style={{ color: '#DC2626' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>Recycle Bin</h3>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                {items.length} {items.length === 1 ? 'item' : 'items'} · restore or permanently delete
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 pb-2">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: '#F3F4F6' }}>
                <Trash2 size={20} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium" style={{ color: '#6B7280' }}>The bin is empty</p>
              <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Deleted boards, folders, and rows land here.</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border" style={{ borderColor: '#F1F5F9' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: it.kind === 'board' ? '#DAF3F2' : it.kind === 'folder' ? '#EDE9FE' : '#FEF3C7' }}>
                    {it.kind === 'board'    ? <LayoutGridIcon /> :
                     it.kind === 'folder'   ? <FolderIcon size={14} style={{ color: '#7C3AED' }} /> :
                                              <FileText size={14} style={{ color: '#B45309' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1A202C' }}>{labelOf(it)}</p>
                    <p className="text-[10px] truncate" style={{ color: '#9CA3AF' }}>
                      {subOf(it)} · deleted {fmt(it.deletedAt)}{it.deletedBy ? ` by ${it.deletedBy}` : ''}
                    </p>
                  </div>
                  {canRestore && (
                    <button onClick={() => onRestore(it.id)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border hover:bg-gray-50"
                      style={{ borderColor: '#E5E7EB', color: '#0F766E' }}>
                      Restore
                    </button>
                  )}
                  {canPurge && (
                    <button onClick={() => onPurge(it.id)}
                      title="Permanently delete"
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border hover:bg-red-50"
                      style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                      Delete forever
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          {canPurge && items.length > 0 ? (
            confirmEmpty ? (
              <div className="flex items-center gap-1.5">
                <button onClick={() => setConfirmEmpty(false)}
                  className="text-xs px-3 py-1 rounded-lg border" style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>Cancel</button>
                <button onClick={() => { onEmpty(); setConfirmEmpty(false); }}
                  className="text-xs font-semibold px-3 py-1 rounded-lg text-white"
                  style={{ background: '#DC2626' }}>Yes, empty bin</button>
              </div>
            ) : (
              <button onClick={() => setConfirmEmpty(true)}
                className="text-xs font-semibold px-3 py-1 rounded-lg border hover:bg-red-50"
                style={{ borderColor: '#FECACA', color: '#DC2626' }}>Empty bin</button>
            )
          ) : <span />}
          <button onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  );
}

function LayoutGridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

// ─── Combine Folders Modal — pick multiple folders to view as one sheet ─────
function CombineFoldersModal({
  folders, boards, onSubmit, onClose,
}: {
  folders: Folder[];
  boards: Board[];
  onSubmit: (selected: Folder[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const submit = () => {
    if (picked.size === 0) return;
    const selected = folders.filter((f) => picked.has(f.id));
    onSubmit(selected);
    onClose();
  };

  const boardCount = (folderId: string) =>
    boards.filter((b) => b.folderId === folderId).length;
  const totalBoards = folders
    .filter((f) => picked.has(f.id))
    .reduce((acc, f) => acc + boardCount(f.id), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-[460px] max-h-[80vh] flex flex-col overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#DAF3F2' }}>
              <Layers size={15} style={{ color: '#0F766E' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>Combine folders</h3>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Open every board across the selected folders in one sheet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 pb-2">
          {folders.length === 0 ? (
            <p className="text-xs italic py-6 text-center" style={{ color: '#9CA3AF' }}>
              No folders yet. Create one first to combine views.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {folders.map((f) => {
                const isPicked = picked.has(f.id);
                const count = boardCount(f.id);
                return (
                  <li key={f.id}>
                    <button
                      onClick={() => toggle(f.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left"
                      style={{
                        borderColor: isPicked ? '#1EC9C4' : '#E5E7EB',
                        background:  isPicked ? '#F0FBFA' : 'white',
                      }}>
                      <span
                        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{
                          background: isPicked ? '#1EC9C4' : 'white',
                          border: isPicked ? '1.5px solid #1EC9C4' : '1.5px solid #D1D5DB',
                        }}>
                        {isPicked && <Check size={11} className="text-white" strokeWidth={3} />}
                      </span>
                      <FolderIcon size={14} style={{ color: '#6B7280' }} className="flex-shrink-0" />
                      <span className="text-sm font-semibold flex-1 truncate" style={{ color: '#374151' }}>{f.name}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{ background: '#F3F4F6', color: '#6B7280' }}>
                        {count} {count === 1 ? 'board' : 'boards'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          <span className="text-xs" style={{ color: '#6B7280' }}>
            {picked.size === 0
              ? 'Pick at least one folder'
              : <>
                  <span className="font-semibold" style={{ color: '#0F766E' }}>{picked.size}</span>
                  {' '}folder{picked.size === 1 ? '' : 's'} ·{' '}
                  <span className="font-semibold" style={{ color: '#0F766E' }}>{totalBoards}</span>
                  {' '}board{totalBoards === 1 ? '' : 's'}
                </>}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
            <button
              onClick={submit}
              disabled={picked.size === 0}
              className="px-5 py-1.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              style={{ background: '#1EC9C4' }}>
              <Layers size={13} /> Open Combined View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Board Overview ───────────────────────────────────────────────────────────
function BoardOverview({
  boards, folders, folderMemberCounts, collapsedFolders, memberCounts, updatedPcts,
  onOpenBoard, onManageBoard, onManageFolder, onAddBoard, arrangeMode, onToggleArrange, onReorder,
  onAddFolder, onRenameFolder, onDeleteFolder, onMoveBoardToFolder, onToggleFolder,
  onLoadDemo, onUnloadDemo, onOpenFolderView, onOpenCombinedFolderView, perms, viewAs, recycleCount, onOpenRecycleBin,
}: {
  boards: Board[];
  folders: Folder[];
  folderMemberCounts: Record<string, number>;
  collapsedFolders: Set<string>;
  memberCounts: Record<string, number>;
  updatedPcts:  Record<string, number>;
  onOpenBoard: (board: Board) => void;
  onManageBoard: (board: Board) => void;
  onManageFolder: (folder: Folder) => void;
  onAddBoard: () => void;
  arrangeMode: boolean;
  onToggleArrange: () => void;
  onReorder: (next: Board[]) => void;
  onAddFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveBoardToFolder: (boardId: string, folderId: string | null) => void;
  onToggleFolder: (id: string) => void;
  onLoadDemo: () => void;
  onUnloadDemo: () => void;
  onOpenFolderView: (folder: Folder) => void;
  onOpenCombinedFolderView: (folders: Folder[]) => void;
  perms: {
    boardsCreate: boolean;
    boardsReorder: boolean;
    foldersCreate: boolean;
    foldersEdit: boolean;
    foldersDelete: boolean;
    foldersAssignBoards: boolean;
    foldersViewCombined: boolean;
    foldersManage: boolean;
    boardsManage: boolean;
    dataDemo: boolean;
    recycleAccess: boolean;
  };
  recycleCount?: number;
  onOpenRecycleBin?: () => void;
  viewAs?: {
    available: boolean;          // only true for the real master admin
    current: AppRole;            // role currently in effect
    onChange: (role: AppRole | null) => void;
  };
}) {
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const demoMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showDemoMenu) return;
    const h = (e: MouseEvent) => {
      if (demoMenuRef.current && !demoMenuRef.current.contains(e.target as Node)) setShowDemoMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showDemoMenu]);

  const [showViewAs, setShowViewAs] = useState(false);
  const viewAsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showViewAs) return;
    const h = (e: MouseEvent) => {
      if (viewAsRef.current && !viewAsRef.current.contains(e.target as Node)) setShowViewAs(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showViewAs]);

  // Folder dialog state — replaces native window.prompt / window.confirm
  const [folderPrompt, setFolderPrompt] = useState<
    | { mode: 'create' }
    | { mode: 'rename'; folderId: string; initial: string }
    | null
  >(null);
  const [showCombineFolders, setShowCombineFolders] = useState(false);

  const dragIndex = useRef<number | null>(null);
  const dragBoardId = useRef<string | null>(null);

  const handleDragStart = (i: number) => { dragIndex.current = i; dragBoardId.current = boards[i]?.id ?? null; };
  const handleDragEnter = (i: number) => {
    if (dragIndex.current === null || dragIndex.current === i) return;
    const next = [...boards];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(i, 0, moved);
    dragIndex.current = i;
    onReorder(next);
  };
  const handleDragEnd = () => { dragIndex.current = null; dragBoardId.current = null; };

  // Drop a dragged board onto a folder header → assign it (folders.assign_boards).
  const handleDropOnFolder = (folderId: string | null) => {
    if (!perms.foldersAssignBoards) { dragBoardId.current = null; return; }
    if (dragBoardId.current) onMoveBoardToFolder(dragBoardId.current, folderId);
    dragBoardId.current = null;
  };

  // Group boards by folderId
  const ungrouped = boards.filter((b) => !b.folderId);
  const byFolder: Record<string, Board[]> = {};
  for (const f of folders) byFolder[f.id] = [];
  for (const b of boards) {
    if (b.folderId && byFolder[b.folderId]) byFolder[b.folderId].push(b);
  }

  const promptNewFolder = () => setFolderPrompt({ mode: 'create' });

  const renderCard = (board: Board, indexInBoards: number) => (
    <BoardCard
      key={board.id}
      board={board}
      memberCount={memberCounts[board.id] ?? 1}
      updatedPct={updatedPcts[board.id] ?? 0}
      onOpen={() => onOpenBoard(board)}
      onManage={() => onManageBoard(board)}
      arrangeMode={arrangeMode}
      showManageGear={perms.boardsManage}
      dragHandlers={arrangeMode ? {
        draggable: true,
        onDragStart: () => handleDragStart(indexInBoards),
        onDragEnter: () => handleDragEnter(indexInBoards),
        onDragEnd: handleDragEnd,
        onDragOver: (e) => e.preventDefault(),
      } : undefined}
    />
  );

  return (
    <div className="flex-1 overflow-auto px-6 py-6">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#1A202C' }}>Prospect Hub</h2>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
            {arrangeMode ? 'Drag boards to rearrange or drop on a folder to move them in — click Done when finished' : 'Select a board to view its prospects'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {viewAs?.available && (() => {
            const currentRoleDef = APP_ROLES.find((r) => r.id === viewAs.current);
            const isPreviewing = viewAs.current !== 'master_admin';
            return (
              <div ref={viewAsRef} className="relative">
                <button
                  onClick={() => setShowViewAs((o) => !o)}
                  title="Preview Prospect Hub as a different role — connected to Admin Control settings"
                  className={[
                    'flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors',
                    isPreviewing ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-[#1EC9C4] hover:text-[#1EC9C4] bg-white',
                  ].join(' ')}
                  style={isPreviewing ? { background: currentRoleDef?.tone.text ?? '#1EC9C4' } : undefined}>
                  <Eye size={14} /> View as: {currentRoleDef?.label ?? viewAs.current}
                  <ChevronDown size={12} className={isPreviewing ? 'text-white/80' : 'text-gray-400'} />
                </button>
                {showViewAs && (
                  <div
                    className="absolute z-50 right-0 top-full mt-1 min-w-[200px] bg-white rounded-xl border border-gray-100 py-1"
                    style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                    <div className="px-3 pt-1 pb-1.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                      Preview Prospect Hub as
                    </div>
                    {APP_ROLES.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          viewAs.onChange(r.id === 'master_admin' ? null : r.id);
                          setShowViewAs(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left">
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={{ background: r.tone.bg, color: r.tone.text }}>{r.label}</span>
                        {viewAs.current === r.id && <Check size={11} className="ml-auto text-[#1EC9C4]" strokeWidth={3} />}
                      </button>
                    ))}
                    {isPreviewing && (
                      <>
                        <div className="my-1 border-t border-gray-100" />
                        <button
                          onClick={() => { viewAs.onChange(null); setShowViewAs(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs italic hover:bg-gray-50 transition-colors"
                          style={{ color: '#9CA3AF' }}>
                          Stop preview
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          {perms.boardsReorder && (
            <button
              onClick={onToggleArrange}
              className={[
                'flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors',
                arrangeMode
                  ? 'text-white'
                  : 'border-gray-200 text-gray-600 hover:border-[#1EC9C4] hover:text-[#1EC9C4] bg-white',
              ].join(' ')}
              style={arrangeMode ? { background: '#1EC9C4', borderColor: '#1EC9C4' } : undefined}
            >
              {arrangeMode ? <><Check size={14} strokeWidth={2.5} /> Done</> : <><Settings2 size={14} /> Manage</>}
            </button>
          )}
          {perms.recycleAccess && onOpenRecycleBin && (
            <button
              onClick={onOpenRecycleBin}
              disabled={arrangeMode}
              title="Restore or permanently delete soft-deleted items"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-[#1EC9C4] hover:text-[#1EC9C4] bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Trash2 size={14} /> Recycle Bin
              {(recycleCount ?? 0) > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: '#FEE2E2', color: '#DC2626' }}>{recycleCount}</span>
              )}
            </button>
          )}
          {/* Demo data menu — gated by data.demo */}
          {perms.dataDemo && (
            <div ref={demoMenuRef} className="relative">
              <button
                onClick={() => setShowDemoMenu((o) => !o)}
                disabled={arrangeMode}
                title="Demo dataset options"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-[#1EC9C4] hover:text-[#1EC9C4] bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Loader2 size={14} /> Demo Data <ChevronDown size={12} className="text-gray-400" />
              </button>
              {showDemoMenu && (
                <div
                  className="absolute z-50 right-0 top-full mt-1 min-w-[200px] bg-white rounded-xl border border-gray-100 py-1"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                  <button
                    onClick={() => { onLoadDemo(); setShowDemoMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors"
                    style={{ color: '#374151' }}>
                    <Loader2 size={13} className="text-gray-400" />
                    <div className="flex-1 text-left">
                      <div>Load Demo Data</div>
                      <div className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>50 boards × 300 prospects</div>
                    </div>
                  </button>
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    onClick={() => { onUnloadDemo(); setShowDemoMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-red-50 transition-colors"
                    style={{ color: '#DC2626' }}>
                    <Trash2 size={13} />
                    <div className="flex-1 text-left">
                      <div>Unload Demo Data</div>
                      <div className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>Clear all of my boards</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
          {perms.foldersCreate && (
            <button
              onClick={promptNewFolder}
              disabled={arrangeMode}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-[#1EC9C4] hover:text-[#1EC9C4] bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FolderPlus size={14} /> New Folder
            </button>
          )}
          {perms.foldersViewCombined && (
            <button
              onClick={() => setShowCombineFolders(true)}
              disabled={arrangeMode || folders.length === 0}
              title={folders.length === 0 ? 'Create a folder first' : 'Combine multiple folders into one sheet'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-[#1EC9C4] hover:text-[#1EC9C4] bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Layers size={14} /> Combine
            </button>
          )}
          {perms.boardsCreate && (
            <button
              onClick={onAddBoard}
              disabled={arrangeMode}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#1EC9C4' }}
            >
              <Plus size={15} strokeWidth={2.5} /> New Board
            </button>
          )}
        </div>
      </div>

      {/* Folder sections */}
      {folders.map((folder) => {
        const cards = byFolder[folder.id] ?? [];
        const isCollapsed = collapsedFolders.has(folder.id);
        return (
          <section key={folder.id} className="mb-5">
            <div
              onDragOver={arrangeMode ? (e) => e.preventDefault() : undefined}
              onDrop={arrangeMode ? () => handleDropOnFolder(folder.id) : undefined}
              className="flex items-center gap-2 mb-2.5 px-1 group"
              style={arrangeMode ? { borderRadius: 12, padding: '4px 8px', border: '2px dashed #D1D5DB' } : undefined}
            >
              <button onClick={() => onToggleFolder(folder.id)} className="text-gray-400 hover:text-gray-600 transition-colors">
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              <FolderIcon size={14} style={{ color: '#6B7280' }} />
              <h3 className="text-sm font-bold flex-1" style={{ color: '#374151' }}>{folder.name}</h3>
              <span className="text-xs" style={{ color: '#9CA3AF' }}>{cards.length}</span>
              {cards.length > 0 && !arrangeMode && perms.foldersViewCombined && (
                <button
                  onClick={() => onOpenFolderView(folder)}
                  title="Open combined view of all boards in this folder"
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors hover:bg-[#DAF3F2]"
                  style={{ color: '#0F766E' }}>
                  <Layers size={11} /> View All
                </button>
              )}
              {(folderMemberCounts[folder.id] ?? 0) > 0 && (
                <span
                  title={`${folderMemberCounts[folder.id]} invited ${folderMemberCounts[folder.id] === 1 ? 'member' : 'members'}`}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  style={{ background: '#DAF3F2', color: '#0F766E' }}>
                  <Users size={9} /> {folderMemberCounts[folder.id]}
                </span>
              )}
              {perms.foldersManage && (
                <button
                  onClick={() => onManageFolder(folder)}
                  title="Manage folder — rename, invite members, delete"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 transition-all">
                  <Settings2 size={12} className="text-gray-400" />
                </button>
              )}
            </div>
            {!isCollapsed && (
              cards.length === 0 ? (
                <p className="text-xs italic px-3 py-3" style={{ color: '#9CA3AF' }}>
                  No boards in this folder yet{arrangeMode ? ' — drop one here.' : '.'}
                </p>
              ) : (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                  {cards.map((b) => renderCard(b, boards.indexOf(b)))}
                </div>
              )
            )}
          </section>
        );
      })}

      {/* Ungrouped boards */}
      {ungrouped.length > 0 && (
        <section
          onDragOver={arrangeMode ? (e) => e.preventDefault() : undefined}
          onDrop={arrangeMode ? () => handleDropOnFolder(null) : undefined}
        >
          {folders.length > 0 && (
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2.5 px-1" style={{ color: '#9CA3AF' }}>
              Ungrouped
            </h3>
          )}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {ungrouped.map((b) => renderCard(b, boards.indexOf(b)))}
          </div>
        </section>
      )}

      {folderPrompt && (
        <FolderPromptModal
          mode={folderPrompt.mode}
          initial={folderPrompt.mode === 'rename' ? folderPrompt.initial : ''}
          onSubmit={(name) => {
            if (folderPrompt.mode === 'create') onAddFolder(name);
            else onRenameFolder(folderPrompt.folderId, name);
          }}
          onClose={() => setFolderPrompt(null)}
        />
      )}

      {showCombineFolders && (
        <CombineFoldersModal
          folders={folders}
          boards={boards}
          onSubmit={(selected) => onOpenCombinedFolderView(selected)}
          onClose={() => setShowCombineFolders(false)}
        />
      )}
    </div>
  );
}
import {
  seedProspects,
  type Prospect,
  type CallingStatus,
  type ListingType,
  type Furnishing,
  type Availability,
} from '@/data/prospects';

// ─── Per-Board Manage Modal ───────────────────────────────────────────────────
// Invite roles mirror the global RBAC roles defined in @/lib/permissions, minus
// master_admin (which can't be granted via an invitation).
import type { Role as AppRole } from '@/lib/permissions';
import { ROLES as APP_ROLES, setUserRole as setUserRoleGlobal, getUserRole, canDo, getViewAsRole, setViewAsRole } from '@/lib/permissions';

const MASTER_ADMIN_EMAIL_PH = 'linux@whyestate.com';
// Actual stored role — ignores any active "View as" override.
function actualAppRole(email: string | undefined | null): AppRole {
  if (!email) return 'viewer';
  if (email.toLowerCase() === MASTER_ADMIN_EMAIL_PH) return 'master_admin';
  return getUserRole(email);
}
// Effective role used for permission checks — only the real master admin
// may downgrade their view; everyone else gets their stored role.
function resolveAppRole(email: string | undefined | null): AppRole {
  const real = actualAppRole(email);
  if (real === 'master_admin') {
    const override = getViewAsRole();
    if (override) return override;
  }
  return real;
}
type MemberRole = Exclude<AppRole, 'master_admin'>;
// Owners (and other inviters) can only invite as Editor / Viewer.
// The Admin role is reserved for the master admin to grant via Admin Control.
const INVITE_ROLES: { id: MemberRole; label: string }[] = APP_ROLES
  .filter((r) => r.id !== 'master_admin' && r.id !== 'admin')
  .map((r) => ({ id: r.id as MemberRole, label: r.label }));

interface BoardMember {
  id: string;
  email: string;
  name?: string;
  // Stored role can be any app role (including master_admin for the auto-invited
  // master). The UI invite picker still excludes master_admin via INVITE_ROLES.
  role: AppRole | 'Owner';
}

// ─── Shared invite-email autocomplete ────────────────────────────────────────
// Drop-in replacement for a plain email <input> in the Invite Member section.
// Surfaces every registered user (from the local directory) as a click-to-pick
// list, filtered by what the user types. Hides owner + already-invited emails.
function InviteEmailAutocomplete({
  value, onChange, ownerEmail, existingMemberEmails,
}: {
  value: string;
  onChange: (email: string) => void;
  ownerEmail: string;
  existingMemberEmails: string[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const lowerVal = value.trim().toLowerCase();
  const ownerLower = ownerEmail.toLowerCase();
  const memberSet  = new Set(existingMemberEmails.map((e) => e.toLowerCase()));
  const candidates = listAllUsers().filter((u) => {
    const e = u.email.toLowerCase();
    if (e === ownerLower)  return false;
    if (memberSet.has(e))  return false;
    if (!lowerVal)         return true;
    return u.name.toLowerCase().includes(lowerVal) || e.includes(lowerVal);
  });

  return (
    <div ref={wrapRef} className="flex-1 relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Email or pick a registered user"
        type="email"
        className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
        style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }}
      />
      {open && candidates.length > 0 && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 py-1 max-h-64 overflow-auto"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <div className="px-3 pt-1 pb-1.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
            Registered users · {candidates.length}
          </div>
          {candidates.slice(0, 12).map((u) => {
            const initials = u.name.split(' ').map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
            return (
              <button
                key={u.email}
                onClick={() => { onChange(u.email); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#1EC9C4' }}>
                  <span className="text-[9px] font-bold text-white">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: '#2B3340' }}>{u.name}</p>
                  <p className="text-[10px] truncate" style={{ color: '#9CA3AF' }}>{u.email}</p>
                </div>
              </button>
            );
          })}
          {candidates.length > 12 && (
            <div className="px-3 py-1.5 text-[10px] italic" style={{ color: '#9CA3AF' }}>
              + {candidates.length - 12} more — keep typing to narrow…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ManageBoardModal({
  board,
  ownerEmail,
  ownerName,
  members,
  onClose,
  onSave,
  onInvite,
  onRemoveMember,
  onDelete,
}: {
  board: Board;
  ownerEmail: string;
  ownerName: string;
  members: BoardMember[];
  onClose: () => void;
  onSave: (patch: { name: string; location: string; color: string }) => void;
  onInvite: (email: string) => void;
  onRemoveMember: (id: string) => void;
  onDelete: () => void;
}) {
  const [name, setName]         = useState(board.name);
  const [location, setLocation] = useState(board.location);
  const [color, setColor]       = useState(board.color);
  const [inviteEmail, setInviteEmail] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Permission gates (driven by Admin Control → Prospect Hub Setting matrix)
  const myRole       = resolveAppRole(getCurrentUser()?.email);
  const canInvite    = canDo(myRole, 'boards.invite_members');
  const canRemoveMem = canDo(myRole, 'boards.remove_members');
  const canEdit      = canDo(myRole, 'boards.edit');
  const canDelete    = canDo(myRole, 'boards.delete');

  const dirty = name !== board.name || location !== board.location || color !== board.color;
  const initials = ownerName.split(' ').map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase() || 'U';

  const submitSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), location: location.trim(), color });
  };

  const submitInvite = () => {
    const e = inviteEmail.trim();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    onInvite(e);
    setInviteEmail('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] overflow-hidden flex flex-col"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>Board Settings</h3>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{board.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {/* Settings */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Settings</p>

            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#374151' }}>Board Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm mb-4 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />

            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#374151' }}>Subtitle <span className="text-gray-400 font-normal">(optional)</span></label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm mb-4 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />

            <label className="text-xs font-semibold mb-2 block" style={{ color: '#374151' }}>Color</label>
            <div className={`flex flex-wrap items-center gap-1.5 mb-3 ${canEdit ? '' : 'opacity-50 pointer-events-none'}`}>
              {BOARD_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} disabled={!canEdit}
                  className="w-6 h-6 shrink-0 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ background: c, boxShadow: color === c && BOARD_COLORS.includes(color) ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none' }}>
                  {color === c && BOARD_COLORS.includes(color) && <Check size={11} className="text-white" strokeWidth={3} />}
                </button>
              ))}
              <label className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 relative"
                title="Custom colour"
                style={{
                  background: !BOARD_COLORS.includes(color) ? color : 'transparent',
                  border: !BOARD_COLORS.includes(color) ? 'none' : '1.5px dashed #C7CCD6',
                  boxShadow: !BOARD_COLORS.includes(color) ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none',
                }}>
                {!BOARD_COLORS.includes(color) ? (
                  <Check size={11} className="text-white drop-shadow" strokeWidth={3} style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.6))' }} />
                ) : (
                  <Plus size={12} strokeWidth={2.5} style={{ color: '#7C8AA0' }} />
                )}
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={!canEdit}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </label>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
              <input value={color} onChange={(e) => setColor(e.target.value)} disabled={!canEdit}
                className="flex-1 px-3 py-2 rounded-lg border outline-none text-xs font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ borderColor: '#E5E7EB', background: '#FAFBFC', color: '#374151' }} />
            </div>

            {canEdit ? (
              <button onClick={submitSave} disabled={!dirty || !name.trim()}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                style={{ background: '#1EC9C4' }}>
                Save Changes
              </button>
            ) : (
              <p className="text-[11px] italic" style={{ color: '#9CA3AF' }}>Your role does not have permission to edit board settings.</p>
            )}
          </section>

          {/* Members */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Members</p>

            {/* Owner row */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2" style={{ background: '#F8FAFB' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#DAF3F2' }}>
                <span className="text-[10px] font-bold" style={{ color: '#1EC9C4' }}>{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#2B3340' }}>{ownerName}</p>
                <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{ownerEmail}</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0"
                style={{ background: '#FEF3C7', color: '#92400E' }}>Owner</span>
            </div>

            {/* Invited members — names pulled from the user directory when available */}
            {members.length === 0 ? (
              <p className="text-xs text-center py-3" style={{ color: '#9CA3AF' }}>No invited members yet.</p>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const dir = new Map<string, string>();
                  for (const u of listAllUsers()) dir.set(u.email.toLowerCase(), u.name);
                  return members.map((m) => {
                    const nickname = dir.get(m.email.toLowerCase());
                    const initials = (nickname || m.email).split(' ').map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
                    const isSignedUp = !!nickname;
                    return (
                      <div key={m.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border" style={{ borderColor: '#F1F5F9' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                          style={{ background: isSignedUp ? getAvatarColor(m.email) : '#F3F4F6' }}>
                          {isSignedUp
                            ? (getAvatarImage(m.email)
                                ? <img src={getAvatarImage(m.email) as string} alt="" className="w-full h-full object-cover" />
                                : <span className="text-[10px] font-bold text-white">{initials}</span>)
                            : <Mail size={12} style={{ color: '#9CA3AF' }} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          {isSignedUp ? (
                            <>
                              <p className="text-xs font-bold truncate" style={{ color: '#2B3340' }}>{nickname}</p>
                              <p className="text-[10px] truncate" style={{ color: '#9CA3AF' }}>{m.email}</p>
                            </>
                          ) : (
                            <>
                              <p className="text-xs font-medium truncate" style={{ color: '#374151' }}>{m.email}</p>
                              <p className="text-[10px] italic" style={{ color: '#9CA3AF' }}>Pending — not signed up</p>
                            </>
                          )}
                        </div>
                        {(() => {
                          // Show the member's Tier (Agent / Staff / Branch Manager / Branch Partner).
                          const tier = getUserTier(m.email);
                          const tone = TIER_BADGE_TONES[tier] ?? { bg: '#F3F4F6', text: '#374151' };
                          return (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex-shrink-0"
                              style={{ background: tone.bg, color: tone.text }}>
                              {tier}
                            </span>
                          );
                        })()}
                        {canRemoveMem && m.email.toLowerCase() !== MASTER_ADMIN_EMAIL_PH && (
                          <button onClick={() => onRemoveMember(m.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                            title="Remove member">
                            <Trash2 size={12} className="text-gray-300 hover:text-red-400" />
                          </button>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </section>

          {/* Invite — only visible to roles with the Invite Members permission */}
          {canInvite ? (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Invite Member</p>
              <div className="flex items-center gap-2 mb-2">
                <InviteEmailAutocomplete
                  value={inviteEmail}
                  onChange={setInviteEmail}
                  ownerEmail={ownerEmail}
                  existingMemberEmails={members.map((m) => m.email)}
                />
              </div>
              <button onClick={submitInvite}
                className="w-full px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ background: '#1EC9C4' }}>
                Send Invite
              </button>
              <p className="text-[10px] mt-2" style={{ color: '#9CA3AF' }}>
                Members inherit their permission from Admin Control → User Setting.
              </p>
            </section>
          ) : null}

          {/* Danger zone */}
          {canDelete && (
            <section className="border-t pt-5" style={{ borderColor: '#FECACA' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#DC2626' }}>Danger Zone</p>
              <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
                Permanently delete this board and all of its prospects, columns, and data. This cannot be undone.
              </p>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs flex-1" style={{ color: '#DC2626' }}>Are you sure? This is irreversible.</span>
                  <button onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={() => { onDelete(); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 flex items-center gap-1"
                    style={{ background: '#DC2626' }}>
                    <Trash2 size={12} /> Delete board
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="w-full px-5 py-2 rounded-xl text-sm font-semibold border hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
                  style={{ borderColor: '#FECACA', color: '#DC2626', background: 'white' }}>
                  <Trash2 size={14} /> Delete board and all data
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Manage Folder Modal — rename + invite + remove members ─────────────────
function ManageFolderModal({
  folder, ownerEmail, ownerName, members, boardCount,
  canRename, canInvite, canRemoveMembers, canDelete,
  onClose, onRename, onInvite, onRemoveMember, onDelete,
}: {
  folder: Folder;
  ownerEmail: string;
  ownerName: string;
  members: BoardMember[];
  boardCount: number;
  canRename: boolean;
  canInvite: boolean;
  canRemoveMembers: boolean;
  canDelete: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  onInvite: (email: string) => void;
  onRemoveMember: (id: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [inviteEmail, setInviteEmail] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submitInvite = () => {
    const e = inviteEmail.trim();
    if (!e || !e.includes('@')) return;
    onInvite(e);
    setInviteEmail('');
  };
  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === folder.name) return;
    onRename(trimmed);
  };
  const ownerInitials = (ownerName || ownerEmail).split(' ').map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-[460px] max-h-[90vh] flex flex-col overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#DAF3F2' }}>
              <FolderIcon size={15} style={{ color: '#0F766E' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>Manage folder</h3>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                {boardCount} {boardCount === 1 ? 'board' : 'boards'} · {members.length} invited
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 pb-5 space-y-5">
          {/* Folder name */}
          {canRename && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>Folder Name</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }}
                className="w-full text-sm border rounded-xl px-3 py-2 outline-none focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }}
              />
              {name.trim() && name.trim() !== folder.name && (
                <button onClick={saveName}
                  className="mt-2 text-xs font-semibold px-3 py-1 rounded-lg text-white hover:opacity-90"
                  style={{ background: '#1EC9C4' }}>Save name</button>
              )}
            </section>
          )}

          {/* Members */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Members</p>

            {/* Owner */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2" style={{ background: '#F8FAFB' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#DAF3F2' }}>
                <span className="text-[10px] font-bold" style={{ color: '#1EC9C4' }}>{ownerInitials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#2B3340' }}>{ownerName || ownerEmail.split('@')[0]}</p>
                <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{ownerEmail}</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0"
                style={{ background: '#FEF3C7', color: '#92400E' }}>Owner</span>
            </div>

            {members.length === 0 ? (
              <p className="text-xs text-center py-3" style={{ color: '#9CA3AF' }}>No invited members yet.</p>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const dir = new Map<string, string>();
                  for (const u of listAllUsers()) dir.set(u.email.toLowerCase(), u.name);
                  return members.map((m) => {
                    const nickname = dir.get(m.email.toLowerCase());
                    const initials = (nickname || m.email).split(' ').map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
                    const isSignedUp = !!nickname;
                    // Show the member's Tier (Agent / Staff / Branch Manager / Branch Partner).
                    const tier = getUserTier(m.email);
                    const label = tier;
                    const tone  = TIER_BADGE_TONES[tier] ?? { bg: '#F3F4F6', text: '#374151' };
                    return (
                      <div key={m.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border" style={{ borderColor: '#F1F5F9' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: isSignedUp ? '#1EC9C4' : '#F3F4F6' }}>
                          {isSignedUp
                            ? <span className="text-[10px] font-bold text-white">{initials}</span>
                            : <Mail size={12} style={{ color: '#9CA3AF' }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          {isSignedUp ? (
                            <>
                              <p className="text-xs font-bold truncate" style={{ color: '#2B3340' }}>{nickname}</p>
                              <p className="text-[10px] truncate" style={{ color: '#9CA3AF' }}>{m.email}</p>
                            </>
                          ) : (
                            <>
                              <p className="text-xs font-medium truncate" style={{ color: '#374151' }}>{m.email}</p>
                              <p className="text-[10px] italic" style={{ color: '#9CA3AF' }}>Pending — not signed up</p>
                            </>
                          )}
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={{ background: tone.bg, color: tone.text }}>{label}</span>
                        {canRemoveMembers && m.email.toLowerCase() !== MASTER_ADMIN_EMAIL_PH && (
                          <button onClick={() => onRemoveMember(m.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                            title="Remove member">
                            <Trash2 size={12} className="text-gray-300 hover:text-red-400" />
                          </button>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </section>

          {/* Invite */}
          {canInvite && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Invite Member</p>
              <div className="flex items-center gap-2 mb-2">
                <InviteEmailAutocomplete
                  value={inviteEmail}
                  onChange={setInviteEmail}
                  ownerEmail={ownerEmail}
                  existingMemberEmails={members.map((m) => m.email)}
                />
              </div>
              <button onClick={submitInvite}
                className="w-full px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ background: '#1EC9C4' }}>
                Send Invite
              </button>
              <p className="text-[10px] mt-2" style={{ color: '#9CA3AF' }}>
                Invited members can see this folder and every board inside it. Permissions come from Admin Control → User Setting.
              </p>
            </section>
          )}

          {/* Danger zone */}
          {canDelete && (
            <section className="border-t pt-5" style={{ borderColor: '#FECACA' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#DC2626' }}>Danger Zone</p>
              <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
                Delete this folder. Boards inside will move out to Ungrouped — they will not be deleted.
              </p>
              {confirmDelete ? (
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)}
                    className="flex-1 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button onClick={onDelete}
                    className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
                    style={{ background: '#DC2626' }}>Yes, delete folder</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="px-4 py-2 rounded-xl text-sm font-medium border text-red-600 hover:bg-red-50"
                  style={{ borderColor: '#FECACA' }}>Delete folder</button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Space-pan hook ──────────────────────────────────────────────────────────
// Hold spacebar and drag to pan the scroll container (like Figma / Notion)
function useSpacePan(scrollRef: MutableRefObject<HTMLDivElement | null>) {
  const spaceDown  = useRef(false);
  const dragging   = useRef(false);
  const lastPos    = useRef({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing inside an input / textarea / contenteditable
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      if (e.code === 'Space') {
        e.preventDefault(); // always block scroll — including key-repeat events
        if (!spaceDown.current) {
          spaceDown.current = true;
          setIsPanning(true);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
        dragging.current  = false;
        setIsPanning(false);
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!spaceDown.current) return;
      dragging.current = true;
      lastPos.current  = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !scrollRef.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      scrollRef.current.scrollLeft -= dx;
      scrollRef.current.scrollTop  -= dy;
      lastPos.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { dragging.current = false; };

    window.addEventListener('keydown',   onKeyDown);
    window.addEventListener('keyup',     onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('keydown',   onKeyDown);
      window.removeEventListener('keyup',     onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [scrollRef]);

  return isPanning;
}

// ─── Badge configs ────────────────────────────────────────────────────────────
const CALLING_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  Positive: { bg: '#DCFCE7', text: '#16A34A' },
  Negative: { bg: '#FEE2E2', text: '#DC2626' },
  Neutral:  { bg: '#FEF9C3', text: '#CA8A04' },
};
const LISTING_TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  Rent: { bg: '#FFEDD5', text: '#EA580C' },
  Sale: { bg: '#F3F4F6', text: '#374151' },
};
const FURNISHING_STYLE: Record<string, { bg: string; text: string }> = {
  'Fully Furnished':  { bg: '#DBEAFE', text: '#1D4ED8' },
  'Partly Furnished': { bg: '#DCFCE7', text: '#15803D' },
  'Bare Unit':        { bg: '#F3F4F6', text: '#374151' },
};
const AVAILABILITY_STYLE: Record<string, { bg: string; text: string }> = {
  'Available':     { bg: '#DCFCE7', text: '#16A34A' },
  'NOT Available': { bg: '#FEE2E2', text: '#DC2626' },
};

// Agent badge palette — pastel bg + saturated text (matches Calling Status look).
// Keyed by short name; AgentPreset.color stores one of these keys.
const AGENT_COLOR_PALETTE: Record<string, { bg: string; text: string; swatch: string }> = {
  green:  { bg: '#DCFCE7', text: '#16A34A', swatch: '#22C55E' },
  red:    { bg: '#FEE2E2', text: '#DC2626', swatch: '#EF4444' },
  yellow: { bg: '#FEF9C3', text: '#CA8A04', swatch: '#EAB308' },
  blue:   { bg: '#DBEAFE', text: '#1D4ED8', swatch: '#3B82F6' },
  purple: { bg: '#EDE9FE', text: '#7C3AED', swatch: '#8B5CF6' },
  pink:   { bg: '#FCE7F3', text: '#DB2777', swatch: '#EC4899' },
  orange: { bg: '#FFEDD5', text: '#EA580C', swatch: '#F97316' },
  teal:   { bg: '#CCFBF1', text: '#0F766E', swatch: '#14B8A6' },
  gray:   { bg: '#F3F4F6', text: '#374151', swatch: '#6B7280' },
};
const AGENT_COLOR_KEYS = Object.keys(AGENT_COLOR_PALETTE);
const AGENT_FALLBACK = AGENT_COLOR_PALETTE.gray;

// ─── Select options ───────────────────────────────────────────────────────────
const CALLING_OPTIONS: CallingStatus[] = ['Positive', 'Negative', 'Neutral', ''];
// Listing type is multi-select; LISTING_OPTIONS is the list of choosable atoms.
const LISTING_OPTIONS: string[] = ['Rent', 'Sale'];
const FURNISHING_OPTIONS: Furnishing[] = ['Fully Furnished', 'Partly Furnished', 'Bare Unit', ''];
const AVAILABILITY_OPTIONS: Availability[] = ['Available', 'NOT Available', ''];

// ─── Quick view tabs ──────────────────────────────────────────────────────────
type QuickView = 'All' | 'Rent' | 'Sale';

const QUICK_VIEWS: { label: QuickView; color: string; activeBg: string; activeText: string; dot: string }[] = [
  { label: 'All',  color: '#6B7280', activeBg: '#F3F4F6',  activeText: '#374151', dot: '#9CA3AF' },
  { label: 'Rent', color: '#EA580C', activeBg: '#FFEDD5',  activeText: '#EA580C', dot: '#F97316' },
  { label: 'Sale', color: '#374151', activeBg: '#F3F4F6',  activeText: '#374151', dot: '#6B7280' },
];

// ─── System field definitions ─────────────────────────────────────────────────
const SYSTEM_FIELDS: { key: keyof Prospect | '__skip__'; label: string }[] = [
  { key: '__skip__',      label: '— Skip this column —' },
  { key: 'name',          label: 'Name' },
  { key: 'unitNo',        label: 'Unit No' },
  { key: 'type',          label: 'Type' },
  { key: 'size',          label: 'Size (sqft)' },
  { key: 'phone',         label: 'Phone' },
  { key: 'callingStatus', label: 'Calling Status' },
  { key: 'listingType',   label: 'Listing Type' },
  { key: 'furnishing',    label: 'Furnishing' },
  { key: 'availability',  label: 'Availability' },
  { key: 'askingRent',    label: 'Asking RENT' },
  { key: 'askingPrice',   label: 'Asking PRICE' },
  { key: 'remark',        label: 'Remark' },
];

// Auto-suggest: normalize CSV header → best-guess system key
const AUTO_SUGGEST: Record<string, keyof Prospect> = {
  'name': 'name', 'owner': 'name', 'owner name': 'name', 'contact name': 'name',
  'unit no': 'unitNo', 'unit number': 'unitNo', 'unitno': 'unitNo', 'unit': 'unitNo',
  'type': 'type', 'property type': 'type',
  'size': 'size', 'size (sqft)': 'size', 'sqft': 'size', 'area': 'size', 'built up': 'size',
  'phone': 'phone', 'mobile': 'phone', 'contact': 'phone', 'phone number': 'phone', 'tel': 'phone',
  'calling status': 'callingStatus', 'callingstatus': 'callingStatus', 'status': 'callingStatus', 'call status': 'callingStatus',
  'listing type': 'listingType', 'listingtype': 'listingType', 'listing': 'listingType',
  'furnishing': 'furnishing', 'furnished': 'furnishing', 'furnish': 'furnishing',
  'availability': 'availability', 'available': 'availability',
  'asking rent': 'askingRent', 'askingrent': 'askingRent', 'rent': 'askingRent', 'monthly rent': 'askingRent',
  'asking price': 'askingPrice', 'askingprice': 'askingPrice', 'price': 'askingPrice', 'sale price': 'askingPrice',
  'remark': 'remark', 'remarks': 'remark', 'note': 'remark', 'notes': 'remark', 'comment': 'remark',
};

// ─── Raw CSV parser ───────────────────────────────────────────────────────────
// Returns headers + raw string[][] rows (no mapping applied yet)
function parseRawCsv(text: string): { headers: string[]; rawRows: string[][] } {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rawRows: [] };

  const splitLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = ''; let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cells.push(cur.replace(/^"|"$/g, '').trim()); cur = ''; }
      else { cur += ch; }
    }
    cells.push(cur.replace(/^"|"$/g, '').trim());
    return cells;
  };

  const headers = splitLine(lines[0]);
  const rawRows = lines.slice(1).map(splitLine);
  return { headers, rawRows };
}

// Apply column mapping to produce Prospect[]
function applyMapping(
  rawRows: string[][],
  mapping: Array<keyof Prospect | '__skip__'>,
): Prospect[] {
  return rawRows
    .map((cells, i) => {
      const row: Prospect = {
        id: String(Date.now() + i),
        name: '', unitNo: '', type: '', size: '', phone: '', agent: '', lastUpdate: '',
        callingStatus: '', listingType: '', furnishing: '',
        availability: '', askingRent: '', askingPrice: '', remark: '',
      };
      mapping.forEach((sysKey, colIdx) => {
        if (sysKey === '__skip__') return;
        const val = (cells[colIdx] ?? '').trim();
        (row as unknown as Record<string, string>)[sysKey] = val;
      });
      return row;
    })
    .filter((r) => r.name || r.unitNo || r.phone);
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, styleMap }: { label: string; styleMap: Record<string, { bg: string; text: string }> }) {
  if (!label) return null;
  const s = styleMap[label] ?? { bg: '#F3F4F6', text: '#374151' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap" style={{ background: s.bg, color: s.text }}>
      {label}
    </span>
  );
}

// ─── Dropdown cell ────────────────────────────────────────────────────────────
function DropdownCell<T extends string>({ value, options, styleMap, onChange }: {
  value: T; options: T[]; styleMap: Record<string, { bg: string; text: string }>; onChange: (v: T) => void;
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
    <div ref={ref} className="relative w-full h-full flex items-center">
      <button onClick={() => setOpen((o) => !o)} className="w-full h-full flex items-center gap-1.5 px-2 py-1 group">
        {value ? <Badge label={value} styleMap={styleMap} /> : <span className="text-xs text-gray-300">—</span>}
        <ChevronDown size={11} className="ml-auto flex-shrink-0 text-gray-300 group-hover:text-gray-500" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-0.5 min-w-[160px] bg-white rounded-xl shadow-xl border border-gray-100 py-1 overflow-hidden" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {options.map((opt) => (
            <button key={opt || '__empty__'} onClick={() => { onChange(opt); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors">
              {opt ? <Badge label={opt} styleMap={styleMap} /> : <span className="text-xs text-gray-400 italic">Clear</span>}
              {value === opt && <Check size={11} className="ml-auto text-[#1EC9C4]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Multi-select dropdown cell (for Listing Type) ───────────────────────────
function MultiSelectDropdownCell({ value, options, styleMap, onChange }: {
  value: string;
  options: string[];
  styleMap: Record<string, { bg: string; text: string }>;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const selected = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const toggle = (opt: string) => {
    const set = new Set(selected);
    if (set.has(opt)) set.delete(opt);
    else set.add(opt);
    // Preserve canonical option order
    const next = options.filter((o) => set.has(o)).join(',');
    onChange(next);
  };

  return (
    <div ref={ref} className="relative w-full h-full flex items-center">
      <button onClick={() => setOpen((o) => !o)} className="w-full h-full flex items-center gap-1 px-2 py-1 group">
        {selected.length > 0 ? (
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            {selected.map((s) => <Badge key={s} label={s} styleMap={styleMap} />)}
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
        <ChevronDown size={11} className="ml-auto flex-shrink-0 text-gray-300 group-hover:text-gray-500" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-0.5 min-w-[180px] bg-white rounded-xl shadow-xl border border-gray-100 py-1 overflow-hidden" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <button key={opt} onClick={() => toggle(opt)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors">
                <span
                  className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                  style={{
                    borderColor: checked ? '#1EC9C4' : '#D1D5DB',
                    background: checked ? '#1EC9C4' : 'white',
                  }}>
                  {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                </span>
                <Badge label={opt} styleMap={styleMap} />
              </button>
            );
          })}
          {selected.length > 0 && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button onClick={() => { onChange(''); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors">
                <span className="text-xs text-gray-400 italic">Clear</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Agent badge + dropdown cell ─────────────────────────────────────────────
// `color` may be a palette key (e.g. 'green') or a custom hex (e.g. '#FF6B6B').
function resolveAgentStyle(color: string): { bg: string; text: string; swatch: string } {
  if (color.startsWith('#') && /^#[0-9A-Fa-f]{6}$/.test(color)) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return { bg: `rgba(${r},${g},${b},0.18)`, text: color, swatch: color };
  }
  const pal = AGENT_COLOR_PALETTE[color] ?? AGENT_FALLBACK;
  return { bg: pal.bg, text: pal.text, swatch: pal.swatch };
}

function AgentBadge({ name, color }: { name: string; color: string }) {
  const pal = resolveAgentStyle(color);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight"
      style={{ background: pal.bg, color: pal.text }}>
      {name}
    </span>
  );
}

function AgentDropdown({ value, presets, canManage, onChange, onAddPreset, onRemovePreset }: {
  value: string;
  presets: AgentPreset[];
  canManage: boolean;
  onChange: (name: string) => void;
  onAddPreset: (name: string, color: string) => AgentPreset;
  onRemovePreset: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState<string>('teal');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setAdding(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Map row's saved name → preset (so we can pick its color). Falls back to gray.
  const matched = presets.find((p) => p.name === value);

  const submitNew = () => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    const preset = onAddPreset(trimmed, draftColor);
    onChange(preset.name);
    setDraftName('');
    setDraftColor('teal');
    setAdding(false);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full h-full flex items-center">
      <button onClick={() => setOpen((o) => !o)} className="w-full h-full flex items-center gap-1.5 px-2 py-1 group">
        {value
          ? <AgentBadge name={value} color={matched?.color ?? 'gray'} />
          : <span className="text-xs text-gray-300">—</span>}
        <ChevronDown size={11} className="ml-auto flex-shrink-0 text-gray-300 group-hover:text-gray-500" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-0.5 min-w-[200px] bg-white rounded-xl border border-gray-100 py-1 overflow-hidden"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {presets.length === 0 && !adding && (
            <div className="px-3 py-2 text-[11px] italic text-gray-400">No agents yet — add one below</div>
          )}
          {presets.map((p) => (
            <div key={p.id} className="group/row flex items-center gap-1 hover:bg-gray-50">
              <button onClick={() => { onChange(p.name); setOpen(false); }}
                className="flex-1 flex items-center gap-2 px-3 py-1.5 text-left">
                <AgentBadge name={p.name} color={p.color} />
                {value === p.name && <Check size={11} className="ml-auto text-[#1EC9C4]" />}
              </button>
              {canManage && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemovePreset(p.id); }}
                  title={`Remove ${p.name}`}
                  className="opacity-0 group-hover/row:opacity-100 p-1 mr-1 rounded hover:bg-red-50 transition-all">
                  <Trash2 size={11} className="text-gray-400 hover:text-red-500" />
                </button>
              )}
            </div>
          ))}

          {value && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button onClick={() => { onChange(''); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs italic hover:bg-gray-50 transition-colors text-gray-400">
                Clear
              </button>
            </>
          )}

          {canManage && <div className="my-1 border-t border-gray-100" />}

          {canManage && (!adding ? (
            <button onClick={() => setAdding(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-[#0F766E]">
              <Plus size={12} strokeWidth={2.5} /> Add agent
            </button>
          ) : (
            <div className="px-3 py-2 space-y-2 bg-[#F8FAFB]">
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') { setAdding(false); setDraftName(''); } }}
                placeholder="Agent name"
                className="w-full text-xs border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-[#1EC9C4]"
              />
              <div className="flex flex-nowrap items-center gap-1">
                {AGENT_COLOR_KEYS.map((k) => {
                  const pal = AGENT_COLOR_PALETTE[k];
                  const picked = draftColor === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setDraftColor(k)}
                      title={k}
                      className="w-5 h-5 shrink-0 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                      style={{
                        background: pal.swatch,
                        boxShadow: picked ? `0 0 0 2px white, 0 0 0 4px ${pal.swatch}` : 'none',
                      }}>
                      {picked && <Check size={10} className="text-white" strokeWidth={3} />}
                    </button>
                  );
                })}
                {/* Custom color — native picker; selected when draftColor is a hex */}
                {(() => {
                  const isCustom = draftColor.startsWith('#');
                  return (
                    <label
                      title="Custom colour"
                      className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 relative"
                      style={{
                        background: isCustom ? draftColor : 'transparent',
                        border: isCustom ? 'none' : '1.5px dashed #C7CCD6',
                        boxShadow: isCustom ? `0 0 0 2px white, 0 0 0 4px ${draftColor}` : 'none',
                      }}>
                      {isCustom
                        ? <Check size={10} className="text-white drop-shadow" strokeWidth={3} style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.6))' }} />
                        : <Plus size={10} strokeWidth={2.5} style={{ color: '#7C8AA0' }} />}
                      <input
                        type="color"
                        value={isCustom ? draftColor : '#1EC9C4'}
                        onChange={(e) => setDraftColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                  );
                })()}
              </div>
              {draftName.trim() && (
                <div className="pt-0.5"><AgentBadge name={draftName.trim()} color={draftColor} /></div>
              )}
              <div className="flex justify-end gap-1.5">
                <button onClick={() => { setAdding(false); setDraftName(''); }}
                  className="text-[11px] text-gray-500 hover:text-gray-700 px-2 py-0.5">Cancel</button>
                <button onClick={submitNew} disabled={!draftName.trim()}
                  className="text-[11px] font-semibold text-white px-2.5 py-0.5 rounded-md disabled:opacity-40"
                  style={{ background: '#1EC9C4' }}>Save</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Typed wrappers ───────────────────────────────────────────────────────────
function CallingDropdown({ value, onChange }: { value: CallingStatus; onChange: (v: CallingStatus) => void }) {
  return <DropdownCell value={value} options={CALLING_OPTIONS} styleMap={CALLING_STATUS_STYLE} onChange={onChange} />;
}
function ListingDropdown({ value, onChange }: { value: ListingType; onChange: (v: ListingType) => void }) {
  return <MultiSelectDropdownCell value={value} options={LISTING_OPTIONS} styleMap={LISTING_TYPE_STYLE} onChange={onChange} />;
}
function FurnishingDropdown({ value, onChange }: { value: Furnishing; onChange: (v: Furnishing) => void }) {
  return <DropdownCell value={value} options={FURNISHING_OPTIONS} styleMap={FURNISHING_STYLE} onChange={onChange} />;
}
function AvailabilityDropdown({ value, onChange }: { value: Availability; onChange: (v: Availability) => void }) {
  return <DropdownCell value={value} options={AVAILABILITY_OPTIONS} styleMap={AVAILABILITY_STYLE} onChange={onChange} />;
}

// ─── Text cell ────────────────────────────────────────────────────────────────
function TextCell({ value, onChange, align = 'left', mono = false, placeholder = '' }: {
  value: string; onChange: (v: string) => void; align?: 'left' | 'center'; mono?: boolean; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  if (editing) {
    return (
      <input ref={inputRef} className="w-full h-full px-2 py-1 text-xs outline-none bg-white border-0"
        style={{ fontFamily: mono ? 'JetBrains Mono, monospace' : undefined, textAlign: align, color: '#2B3340' }}
        value={value} onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false); }}
        placeholder={placeholder}
      />
    );
  }
  return (
    <button onDoubleClick={() => setEditing(true)} className="w-full h-full flex items-center px-2 py-1 hover:bg-blue-50/40 transition-colors" style={{ justifyContent: align === 'center' ? 'center' : undefined }}>
      <span className="text-xs truncate" style={{ fontFamily: mono ? 'JetBrains Mono, monospace' : undefined, color: value ? '#2B3340' : '#D1D5DB' }}>{value || placeholder}</span>
    </button>
  );
}

// ─── Row menu ─────────────────────────────────────────────────────────────────
function RowMenu({ anchorRect, onDelete, onDuplicate, onImportClient, onClose, canDelete, canDuplicate, importedAlready }: {
  anchorRect: DOMRect;
  onDelete: () => void;
  onDuplicate: () => void;
  onImportClient: () => void;
  onClose: () => void;
  canDelete: boolean;
  canDuplicate: boolean;
  importedAlready: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  // Import is available to anyone with read access (always available here).
  // We still hide the menu entirely if there's literally nothing to do.
  const items = (canDuplicate ? 1 : 0) + (canDelete ? 1 : 0) + 1; // +1 for Import
  if (items === 0) return null;

  // Position the menu just below the ⋯ trigger, flipping above when it would
  // run off the bottom of the viewport. Portals to body so it can never be
  // clipped by the scrolling table.
  const MENU_W = 190;
  const MENU_H = items * 32 + 8;
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const openUp = spaceBelow < MENU_H + 8;
  const top = openUp ? Math.max(8, anchorRect.top - MENU_H - 4) : anchorRect.bottom + 4;
  const left = Math.min(window.innerWidth - MENU_W - 8, Math.max(8, anchorRect.right - MENU_W));

  return createPortal(
    <div ref={ref}
      style={{ position: 'fixed', top, left, width: MENU_W, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.14)' }}
      className="bg-white rounded-xl border border-gray-100 py-1">
      <button onClick={onImportClient}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50"
        style={{ color: importedAlready ? '#9CA3AF' : '#0F766E' }}>
        <UserPlus size={13} />
        {importedAlready ? 'Re-sync to Clients' : 'Import as Client'}
      </button>
      {canDuplicate && <button onClick={onDuplicate} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"><Copy size={13} /> Duplicate row</button>}
      {canDelete    && <button onClick={onDelete}    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"><Trash2 size={13} /> Delete row</button>}
    </div>,
    document.body
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────
// Range filter bounds — used as upper limits for the price/rent sliders.
const RENT_MAX  = 100000;    // RM / month
const PRICE_MAX = 5000000;   // RM

// Filter values are arrays — empty array means "no filter" (i.e. show all).
interface Filters {
  callingStatus: string[];
  furnishing:    string[];
  availability:  string[];
  agent:         string[];
  askingRentRange:  [number, number];
  askingPriceRange: [number, number];
}

function parseMoney(s: string): number {
  const n = Number(String(s).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(n);
}

function RangeNumberInputs({ value, onChange, min, max }: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
  min: number;
  max: number;
}) {
  // Local string state lets the user type freely (including empty) without
  // fighting clamping while typing. We commit on blur / Enter.
  const [lo, setLo] = useState(String(value[0]));
  const [hi, setHi] = useState(String(value[1]));

  // Keep local strings in sync when the parent updates (e.g. slider drag, Clear).
  useEffect(() => { setLo(String(value[0])); }, [value[0]]);
  useEffect(() => { setHi(String(value[1])); }, [value[1]]);

  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));
  const commit = () => {
    const a = lo === '' ? min : clamp(Number(lo) || 0);
    const b = hi === '' ? max : clamp(Number(hi) || 0);
    const next: [number, number] = a <= b ? [a, b] : [b, a];
    onChange(next);
    setLo(String(next[0]));
    setHi(String(next[1]));
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        inputMode="numeric"
        value={lo}
        onChange={(e) => setLo(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-14 px-1.5 py-0.5 text-[11px] font-mono border border-gray-200 rounded-md outline-none focus:border-[#1EC9C4]"
        style={{ background: '#FAFBFC' }}
      />
      <span className="text-xs text-gray-400">–</span>
      <input
        type="number"
        inputMode="numeric"
        value={hi}
        onChange={(e) => setHi(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-20 px-1.5 py-0.5 text-[11px] font-mono border border-gray-200 rounded-md outline-none focus:border-[#1EC9C4]"
        style={{ background: '#FAFBFC' }}
      />
    </div>
  );
}

function RangeSlider({ value, onChange, min, max, step }: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <SliderPrimitive.Root
      value={value}
      onValueChange={(v) => onChange([v[0] ?? min, v[1] ?? max] as [number, number])}
      min={min}
      max={max}
      step={step}
      minStepsBetweenThumbs={1}
      className="relative flex w-24 touch-none select-none items-center flex-shrink-0"
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-gray-200">
        <SliderPrimitive.Range className="absolute h-full" style={{ background: '#1EC9C4' }} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border-2 bg-white focus-visible:outline-none cursor-grab active:cursor-grabbing" style={{ borderColor: '#1EC9C4' }} />
      <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border-2 bg-white focus-visible:outline-none cursor-grab active:cursor-grabbing" style={{ borderColor: '#1EC9C4' }} />
    </SliderPrimitive.Root>
  );
}

function FilterMultiSelect({ label, options, selected, onChange }: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const popRef  = useRef<HTMLDivElement>(null);

  // Compute portal position from the trigger's bounding rect; close on outside click.
  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left });
    };
    updatePos();
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  const toggle = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else onChange([...selected, opt]);
  };

  const summary = selected.length === 0
    ? 'All'
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  return (
    <div className="flex items-center gap-1.5" ref={wrapRef}>
      <span className="text-xs text-gray-400">{label}</span>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className={[
          'flex items-center gap-1.5 text-xs border rounded-lg px-2 py-1 bg-white transition-colors min-w-[88px] justify-between',
          selected.length > 0 ? 'border-[#1EC9C4] text-[#0F766E]' : 'border-gray-200 text-gray-700 hover:border-gray-300',
        ].join(' ')}>
        <span className="truncate max-w-[140px]">{summary}</span>
        <ChevronDown size={11} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && pos && createPortal(
        <div
          ref={popRef}
          className="fixed z-[1000] min-w-[160px] bg-white rounded-xl border border-gray-100 py-1"
          style={{ top: pos.top, left: pos.left, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <button key={opt} onClick={() => toggle(opt)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left">
                <span
                  className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: checked ? '#1EC9C4' : '#D1D5DB', background: checked ? '#1EC9C4' : 'white' }}>
                  {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                </span>
                <span style={{ color: '#374151' }}>{opt}</span>
              </button>
            );
          })}
          {selected.length > 0 && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button onClick={() => { onChange([]); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs italic hover:bg-gray-50 transition-colors"
                style={{ color: '#9CA3AF' }}>
                Clear
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function FilterBar({ filters, setFilters, agentOptions, onClose }: { filters: Filters; setFilters: React.Dispatch<React.SetStateAction<Filters>>; agentOptions: string[]; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-[#FAFBFC] overflow-x-auto whitespace-nowrap">
      <span className="text-xs font-semibold text-gray-500 flex-shrink-0">Filters</span>
      {[
        { label: 'Status',       key: 'callingStatus' as const, opts: CALLING_OPTIONS.filter(Boolean) },
        { label: 'Furnishing',   key: 'furnishing'    as const, opts: FURNISHING_OPTIONS.filter(Boolean) },
        { label: 'Availability', key: 'availability'  as const, opts: AVAILABILITY_OPTIONS.filter(Boolean) },
        { label: 'Agent',        key: 'agent'         as const, opts: agentOptions },
      ].map(({ label, key, opts }) => (
        <FilterMultiSelect
          key={key}
          label={label}
          options={opts}
          selected={filters[key]}
          onChange={(next) => setFilters((f) => ({ ...f, [key]: next }))}
        />
      ))}

      <span className="w-px h-5 bg-gray-200 flex-shrink-0" />

      {/* Asking RENT range — slider + numeric inputs */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[11px] text-gray-400">RENT</span>
        <RangeSlider
          value={filters.askingRentRange}
          onChange={(v) => setFilters((f) => ({ ...f, askingRentRange: v }))}
          min={0} max={RENT_MAX} step={500}
        />
        <RangeNumberInputs
          value={filters.askingRentRange}
          min={0} max={RENT_MAX}
          onChange={(v) => setFilters((f) => ({ ...f, askingRentRange: v }))}
        />
      </div>

      {/* Asking PRICE range — slider + numeric inputs */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[11px] text-gray-400">PRICE</span>
        <RangeSlider
          value={filters.askingPriceRange}
          onChange={(v) => setFilters((f) => ({ ...f, askingPriceRange: v }))}
          min={0} max={PRICE_MAX} step={10000}
        />
        <RangeNumberInputs
          value={filters.askingPriceRange}
          min={0} max={PRICE_MAX}
          onChange={(v) => setFilters((f) => ({ ...f, askingPriceRange: v }))}
        />
      </div>

      <button onClick={() => setFilters({ callingStatus: [], furnishing: [], availability: [], agent: [], askingRentRange: [0, RENT_MAX], askingPriceRange: [0, PRICE_MAX] })} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 flex-shrink-0"><X size={12} /> Clear</button>
      <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={14} /></button>
    </div>
  );
}

// ─── Import modal ─────────────────────────────────────────────────────────────
type ImportMode  = 'append' | 'replace';
type ImportStep  = 'upload' | 'mapping' | 'preview' | 'done' | 'error';

const STEP_LABELS: Record<ImportStep, string> = {
  upload:  '1. Upload',
  mapping: '2. Map Columns',
  preview: '3. Preview & Import',
  done:    'Done',
  error:   'Error',
};

// ─── Export modal — pick a format (CSV / Excel) ─────────────────────────────
type ExportFormat = 'csv' | 'xlsx';

function ExportFormatCard({ icon, iconBg, iconColor, label, ext, desc, onClick }: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  ext: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-[#1EC9C4] hover:bg-[#F0FFFE] hover:shadow-sm transition-all text-left group">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold" style={{ color: '#1A202C' }}>{label}</span>
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{ext}</span>
        </div>
        <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: '#6B7280' }}>{desc}</p>
      </div>
      <ChevronRight size={14} className="text-gray-300 group-hover:text-[#1EC9C4] flex-shrink-0 transition-colors" />
    </button>
  );
}

function ExportModal({ rowCount, onExport, onClose }: {
  rowCount: number;
  onExport: (format: ExportFormat) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const pick = (format: ExportFormat) => { onExport(format); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-[460px] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#DAF3F2' }}>
              <Download size={15} style={{ color: '#0F766E' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>Export data</h3>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                {rowCount} {rowCount === 1 ? 'row' : 'rows'} from the current view · pick a format
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="px-6 pb-5 space-y-2">
          <ExportFormatCard
            icon={<FileText size={16} />}
            iconBg="#FEE2E2"
            iconColor="#DC2626"
            label="CSV"
            ext=".csv"
            desc="Plain text. Universally supported — Excel, Numbers, any text editor."
            onClick={() => pick('csv')}
          />
          <ExportFormatCard
            icon={<FileSpreadsheet size={16} />}
            iconBg="#DCFCE7"
            iconColor="#16A34A"
            label="Excel"
            ext=".xlsx"
            desc="Microsoft Excel workbook with sized columns and proper cell types."
            onClick={() => pick('xlsx')}
          />
        </div>

        <div className="flex justify-end gap-2 px-6 py-3 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ onClose, onImport }: {
  onClose: () => void;
  onImport: (rows: Prospect[], mode: ImportMode) => void;
}) {
  const [step, setStep]       = useState<ImportStep>('upload');
  const [mode, setMode]       = useState<ImportMode>('append');
  const [fileName, setFileName] = useState('');
  const [error, setError]     = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  // mapping[i] = system key for csv column i
  const [mapping, setMapping] = useState<Array<keyof Prospect | '__skip__'>>([]);
  const [mapped, setMapped]   = useState<Prospect[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── File handling ───────────────────────────────────────────────────────
  const isExcel = (name: string) => /\.(xlsx|xls|xlsm|xlsb)$/i.test(name);
  const isCsv   = (name: string) => /\.csv$/i.test(name);

  const applyHeaders = (headers: string[], rows: string[][]) => {
    if (headers.length === 0 || rows.length === 0) {
      setError('No data found. Make sure the file has a header row and at least one data row.');
      setStep('error'); return;
    }
    setCsvHeaders(headers);
    setRawRows(rows);
    const suggested = headers.map((h) => AUTO_SUGGEST[h.toLowerCase()] ?? '__skip__' as const);
    setMapping(suggested);
    setStep('mapping');
  };

  const processFile = (file: File) => {
    if (!isCsv(file.name) && !isExcel(file.name)) {
      setError('Please upload a .csv, .xlsx, or .xls file.');
      setStep('error'); return;
    }
    setFileName(file.name);
    const reader = new FileReader();

    if (isCsv(file.name)) {
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const { headers, rawRows: rows } = parseRawCsv(text);
          applyHeaders(headers, rows);
        } catch {
          setError('Failed to parse CSV. Please check the file format.');
          setStep('error');
        }
      };
      reader.readAsText(file);
    } else {
      // Excel: read as ArrayBuffer → SheetJS
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb   = XLSX.read(data, { type: 'array' });
          const ws   = wb.Sheets[wb.SheetNames[0]]; // first sheet
          // sheet_to_json with header:1 gives string[][] including header row
          const allRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
          if (allRows.length < 2) {
            setError('No data found in the first sheet.');
            setStep('error'); return;
          }
          const headers = (allRows[0] as (string | number)[]).map((h) => String(h ?? '').trim());
          const rows    = allRows.slice(1).map((r) =>
            headers.map((_, i) => String((r as (string | number)[])[i] ?? '').trim())
          );
          applyHeaders(headers, rows);
        } catch {
          setError('Failed to read Excel file. Please check the file is not corrupted.');
          setStep('error');
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) processFile(f); };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processFile(f); };

  // ── Mapping confirmed → go to preview ──────────────────────────────────
  const confirmMapping = () => {
    const result = applyMapping(rawRows, mapping);
    setMapped(result);
    setStep('preview');
  };

  // ── Final import ────────────────────────────────────────────────────────
  const confirm = () => {
    onImport(mapped, mode);
    setStep('done');
    setTimeout(onClose, 1400);
  };

  // ── How many columns are mapped (not skipped) ───────────────────────────
  const mappedCount = mapping.filter((k) => k !== '__skip__').length;
  // Warn if a system field is mapped to more than one CSV column
  const usedKeys = mapping.filter((k) => k !== '__skip__');
  const dupKeys  = usedKeys.filter((k, i) => usedKeys.indexOf(k) !== i);

  // ── Breadcrumb steps ────────────────────────────────────────────────────
  const visibleSteps: ImportStep[] = ['upload', 'mapping', 'preview'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.40)' }}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full mx-4 overflow-hidden flex flex-col"
        style={{ maxWidth: 600, maxHeight: '90vh', boxShadow: '0 24px 60px rgba(0,0,0,0.20)' }}
      >
        {/* ── Modal header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="font-bold text-sm" style={{ color: '#2B3340' }}>Import CSV</h3>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 mt-1">
              {visibleSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-gray-200 text-xs">›</span>}
                  <span className="text-xs font-medium" style={{
                    color: step === s ? '#1EC9C4' : (visibleSteps.indexOf(step) > i ? '#9CA3AF' : '#D1D5DB'),
                    textDecoration: step === s ? 'underline' : 'none',
                  }}>
                    {STEP_LABELS[s]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* ── Modal body (scrollable) ── */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* ── STEP 1: Upload ── */}
          {(step === 'upload' || step === 'error') && (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors hover:border-[#1EC9C4] hover:bg-[#F0FFFE]"
                style={{ borderColor: step === 'error' ? '#FCA5A5' : '#D1D5DB' }}
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#DAF3F2' }}>
                  <Upload size={22} style={{ color: '#1EC9C4' }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ color: '#2B3340' }}>Drop your file here</p>
                  <p className="text-xs mt-0.5" style={{ color: '#A1A9B6' }}>or click to browse</p>
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    {['.csv', '.xlsx', '.xls'].map((ext) => (
                      <span key={ext} className="text-xs px-2 py-0.5 rounded-md font-mono font-semibold" style={{ background: '#F3F4F6', color: '#6B7280' }}>{ext}</span>
                    ))}
                  </div>
                </div>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.xlsm" className="hidden" onChange={handleFile} />
              </div>

              {step === 'error' && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: '#FEE2E2' }}>
                  <AlertCircle size={14} style={{ color: '#DC2626' }} />
                  <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
                </div>
              )}

              <div className="rounded-xl p-3" style={{ background: '#F8FAFB' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#6B7280' }}>Any CSV works — you'll map columns in the next step.</p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>System fields: Name · Unit No · Type · Size · Phone · Calling Status · Listing Type · Furnishing · Availability · Asking RENT · Asking PRICE · Remark</p>
              </div>
            </>
          )}

          {/* ── STEP 2: Map Columns ── */}
          {step === 'mapping' && (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: '#F0FFFE', border: '1px solid #DAF3F2' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#DAF3F2' }}>
                  <Upload size={13} style={{ color: '#1EC9C4' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate" style={{ color: '#2B3340' }}>{fileName}</p>
                  <p className="text-xs" style={{ color: '#1EC9C4' }}>{rawRows.length} rows · {csvHeaders.length} columns detected</p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: '#DAF3F2', color: '#1EC9C4' }}>
                  {mappedCount}/{csvHeaders.length} mapped
                </span>
              </div>

              {/* Duplicate warning */}
              {dupKeys.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#FEF9C3' }}>
                  <AlertCircle size={13} style={{ color: '#CA8A04' }} />
                  <p className="text-xs" style={{ color: '#CA8A04' }}>
                    Some system fields are mapped twice. Each field can only be used once.
                  </p>
                </div>
              )}

              {/* Mapping table */}
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-2 px-3 py-2" style={{ background: '#F8FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <span className="text-xs font-semibold" style={{ color: '#6B7280' }}>Your CSV Column</span>
                  <span className="text-xs font-semibold" style={{ color: '#6B7280' }}>Maps to System Field</span>
                </div>
                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {csvHeaders.map((header, idx) => {
                    const isDup = mapping[idx] !== '__skip__' && usedKeys.filter((k) => k === mapping[idx]).length > 1;
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-2 items-center px-3 py-2 gap-3"
                        style={{ background: isDup ? '#FFFBEB' : idx % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}
                      >
                        {/* CSV header + sample value */}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: '#2B3340' }}>{header}</p>
                          <p className="text-xs truncate mt-0.5" style={{ color: '#A1A9B6' }}>
                            e.g. {rawRows[0]?.[idx] ?? '—'}
                          </p>
                        </div>
                        {/* System field dropdown */}
                        <div className="flex items-center gap-1.5">
                          <select
                            value={mapping[idx]}
                            onChange={(e) => {
                              const newMapping = [...mapping];
                              newMapping[idx] = e.target.value as keyof Prospect | '__skip__';
                              setMapping(newMapping);
                            }}
                            className="flex-1 text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1EC9C4] transition-colors"
                            style={{
                              borderColor: isDup ? '#FCD34D' : mapping[idx] === '__skip__' ? '#E5E7EB' : '#1EC9C4',
                              background: mapping[idx] === '__skip__' ? '#F9FAFB' : '#F0FFFE',
                              color: mapping[idx] === '__skip__' ? '#9CA3AF' : '#1EC9C4',
                              fontWeight: mapping[idx] === '__skip__' ? 400 : 600,
                            }}
                          >
                            {SYSTEM_FIELDS.map((sf) => (
                              <option key={sf.key} value={sf.key}>{sf.label}</option>
                            ))}
                          </select>
                          {mapping[idx] !== '__skip__' && !isDup && (
                            <Check size={13} style={{ color: '#1EC9C4', flexShrink: 0 }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs" style={{ color: '#A1A9B6' }}>
                Unmapped columns (Skip) will be ignored. Mapped columns fill the system field; all other fields stay blank.
              </p>
            </>
          )}

          {/* ── STEP 3: Preview & Import ── */}
          {step === 'preview' && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl p-3 text-center" style={{ background: '#DAF3F2' }}>
                  <p className="text-2xl font-bold font-mono" style={{ color: '#1EC9C4' }}>{mapped.length}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#27B1AD' }}>rows to import</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: '#F3F4F6' }}>
                  <p className="text-2xl font-bold font-mono" style={{ color: '#374151' }}>{mappedCount}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>columns mapped</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: '#F3F4F6' }}>
                  <p className="text-2xl font-bold font-mono" style={{ color: '#374151' }}>{csvHeaders.length - mappedCount}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>columns skipped</p>
                </div>
              </div>

              {/* Preview table — shows ALL mapped columns for first 5 rows */}
              <div>
                <p className="text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>
                  Preview (first 5 rows of {mapped.length})
                </p>
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto max-h-52">
                    <table className="text-xs" style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFB', borderBottom: '1px solid #E5E7EB' }}>
                          {SYSTEM_FIELDS.filter((sf) => sf.key !== '__skip__' && mapping.includes(sf.key as keyof Prospect)).map((sf) => (
                            <th key={sf.key} className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: '#6B7280' }}>{sf.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mapped.slice(0, 5).map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            {SYSTEM_FIELDS.filter((sf) => sf.key !== '__skip__' && mapping.includes(sf.key as keyof Prospect)).map((sf) => {
                              const val = (r as unknown as Record<string, string>)[sf.key as string] ?? '';
                              return (
                                <td key={sf.key} className="px-3 py-1.5 whitespace-nowrap" style={{ color: val ? '#374151' : '#D1D5DB', maxWidth: 180 }}>
                                  {sf.key === 'callingStatus' && val
                                    ? <Badge label={val} styleMap={CALLING_STATUS_STYLE} />
                                    : <span className="truncate block" style={{ maxWidth: 160 }}>{val || '—'}</span>
                                  }
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {mapped.length > 5 && (
                    <div className="px-3 py-1.5 text-xs text-center" style={{ color: '#A1A9B6', background: '#F8FAFB', borderTop: '1px solid #E5E7EB' }}>
                      +{mapped.length - 5} more rows · all {mapped.length} rows will be imported
                    </div>
                  )}
                </div>
              </div>

              {/* Mode selector */}
              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>Import mode</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'append'  as const, label: 'Append',  desc: 'Add to existing rows' },
                    { value: 'replace' as const, label: 'Replace', desc: 'Clear all & replace' },
                  ] as const).map((opt) => (
                    <button key={opt.value} onClick={() => setMode(opt.value)}
                      className="flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all"
                      style={{ borderColor: mode === opt.value ? '#1EC9C4' : '#E5E7EB', background: mode === opt.value ? '#F0FFFE' : '#FFFFFF' }}>
                      <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ borderColor: mode === opt.value ? '#1EC9C4' : '#D1D5DB' }}>
                        {mode === opt.value && <div className="w-2 h-2 rounded-full" style={{ background: '#1EC9C4' }} />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: '#2B3340' }}>{opt.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── DONE ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#DCFCE7' }}>
                <CheckCircle2 size={28} style={{ color: '#16A34A' }} />
              </div>
              <p className="text-base font-bold" style={{ color: '#2B3340' }}>Import successful!</p>
              <p className="text-sm" style={{ color: '#6B7280' }}>{mapped.length} rows imported · {mappedCount} columns mapped</p>
            </div>
          )}
        </div>

        {/* ── Modal footer ── */}
        {(step === 'mapping' || step === 'preview') && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 flex-shrink-0" style={{ background: '#F8FAFB' }}>
            <button
              onClick={() => setStep(step === 'mapping' ? 'upload' : 'mapping')}
              className="px-4 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
            {step === 'mapping' && (
              <button
                onClick={confirmMapping}
                disabled={mappedCount === 0 || dupKeys.length > 0}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: '#1EC9C4' }}
              >
                Next: Preview →
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={confirm}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 flex items-center gap-1.5"
                style={{ background: '#1EC9C4' }}
              >
                <Upload size={13} /> Import all {mapped.length} rows
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────
type ColType = 'text' | 'select' | 'custom-select' | 'readonly';
interface ColDef {
  key: string;
  label: string;
  width: number;
  type: ColType;
  mono?: boolean;
  align?: 'left' | 'center';
  placeholder?: string;
  fixed?: boolean; // system columns — label not editable / not deletable
  selectKey?: 'callingStatus' | 'listingType' | 'furnishing' | 'availability';
  options?: string[]; // for custom-select columns
}

const BASE_COLUMNS: ColDef[] = [
  { key: 'name',          label: 'Name',          width: 220, type: 'text',   fixed: true },
  { key: 'unitNo',        label: 'Unit No',        width: 96,  type: 'text',   fixed: true, mono: true },
  { key: 'type',          label: 'Type',           width: 72,  type: 'text',   fixed: true, align: 'center' },
  { key: 'size',          label: 'Size (sqft)',    width: 88,  type: 'text',   fixed: true, align: 'center', mono: true },
  { key: 'phone',         label: 'Phone',          width: 180, type: 'text',   fixed: true, mono: true },
  { key: 'callingStatus', label: 'Calling Status', width: 130, type: 'select', fixed: true, selectKey: 'callingStatus' },
  { key: 'listingType',   label: 'Listing Type',   width: 120, type: 'select', fixed: true, selectKey: 'listingType' },
  { key: 'furnishing',    label: 'Furnishing',     width: 148, type: 'select', fixed: true, selectKey: 'furnishing' },
  { key: 'availability',  label: 'Availability',   width: 130, type: 'select', fixed: true, selectKey: 'availability' },
  { key: 'askingRent',    label: 'Asking RENT',    width: 110, type: 'text',   fixed: true, mono: true, placeholder: 'RM —' },
  { key: 'askingPrice',   label: 'Asking PRICE',   width: 120, type: 'text',   fixed: true, mono: true, placeholder: 'RM —' },
  { key: 'remark',        label: 'Remark',         width: 200, type: 'text',   fixed: true, placeholder: 'Add note...' },
  { key: 'agent',         label: 'Agent',          width: 130, type: 'readonly', fixed: true },
  { key: 'lastUpdate',    label: 'Last Update',    width: 150, type: 'readonly', fixed: true, mono: true },
];

// ─── Custom select cell ───────────────────────────────────────────────────────
function CustomSelectCell({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="relative w-full h-full flex items-center">
      <button onClick={() => setOpen((o) => !o)} className="w-full h-full flex items-center gap-1.5 px-2 py-1 group">
        {value
          ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: '#F3F4F6', color: '#374151' }}>{value}</span>
          : <span className="text-xs text-gray-300">—</span>}
        <ChevronDown size={11} className="ml-auto flex-shrink-0 text-gray-300 group-hover:text-gray-500" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-0.5 min-w-[160px] bg-white rounded-xl shadow-xl border border-gray-100 py-1" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <button onClick={() => { onChange(''); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50">
            <span className="text-xs text-gray-400 italic">Clear</span>
            {!value && <Check size={11} className="ml-auto text-[#1EC9C4]" />}
          </button>
          {options.map((opt) => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: '#F3F4F6', color: '#374151' }}>{opt}</span>
              {value === opt && <Check size={11} className="ml-auto text-[#1EC9C4]" />}
            </button>
          ))}
          {options.length === 0 && <p className="px-3 py-2 text-xs text-gray-400 italic">No options yet</p>}
        </div>
      )}
    </div>
  );
}

// ─── Editable header cell ─────────────────────────────────────────────────────
function HeaderCell({ col, onRename, onDelete, canEdit, canDelete }: {
  col: ColDef;
  onRename: (key: string, label: string) => void;
  onDelete: (key: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing]     = useState(false);
  const [draft, setDraft]         = useState(col.label);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [menuPos, setMenuPos]     = useState({ top: 0, left: 0 });
  const inputRef  = useRef<HTMLInputElement>(null);
  const menuRef   = useRef<HTMLDivElement>(null);
  const btnRef    = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editing) { setDraft(col.label); inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing, col.label]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current  && !btnRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
    setMenuOpen((o) => !o);
  };

  const commit = () => { const v = draft.trim(); if (v) onRename(col.key, v); setEditing(false); };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="w-full px-1 py-0 text-xs font-semibold outline-none bg-white border-b-2 border-[#1EC9C4] rounded-sm"
        style={{ color: '#2B3340' }}
      />
    );
  }

  return (
    <span className="flex items-center gap-1 group/header w-full">
      <span
        onDoubleClick={() => !col.fixed && canEdit && setEditing(true)}
        className="truncate flex-1"
        title={col.fixed ? col.label : (canEdit ? 'Double-click to rename' : undefined)}
        style={{ cursor: col.fixed || !canEdit ? 'default' : 'text' }}
      >{col.label}</span>

      {/* ⋯ button — custom columns only, and only if user can rename or delete */}
      {!col.fixed && (canEdit || canDelete) && (
        <button
          ref={btnRef}
          onClick={openMenu}
          className="opacity-0 group-hover/header:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 transition-all text-sm"
          style={{ color: '#6B7280', lineHeight: 1 }}
        >⋯</button>
      )}

      {/* Portal menu — renders on document.body to escape overflow:hidden & sticky z-index */}
      {menuOpen && !col.fixed && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 9999,
            minWidth: 160,
            background: '#FFFFFF',
            borderRadius: 12,
            border: '1px solid #F3F4F6',
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            padding: '4px 0',
          }}
        >
          {canEdit && (
            <button
              onClick={() => { setMenuOpen(false); setEditing(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              <span style={{ fontSize: 13 }}>✎</span> Rename field
            </button>
          )}
          {canEdit && canDelete && <div style={{ borderTop: '1px solid #F3F4F6', margin: '2px 0' }} />}
          {canDelete && (
            <button
              onClick={() => { setMenuOpen(false); onDelete(col.key); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50"
            >
              <Trash2 size={12} /> Delete field
            </button>
          )}
        </div>,
        document.body
      )}
    </span>
  );
}

// ─── Add Field modal ──────────────────────────────────────────────────────────
type FieldType = 'text' | 'dropdown';

function AddFieldModal({ onAdd, onClose }: {
  onAdd: (label: string, type: FieldType, options: string[]) => void;
  onClose: () => void;
}) {
  const [label,     setLabel]     = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [options,   setOptions]   = useState<string[]>(['']);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const addOption    = () => setOptions((p) => [...p, '']);
  const updateOption = (i: number, v: string) => setOptions((p) => p.map((o, idx) => idx === i ? v : o));
  const removeOption = (i: number) => setOptions((p) => p.filter((_, idx) => idx !== i));

  const submit = () => {
    if (!label.trim()) return;
    const cleanOpts = options.map((o) => o.trim()).filter(Boolean);
    onAdd(label.trim(), fieldType, cleanOpts);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-96 overflow-hidden" style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.16)', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-sm" style={{ color: '#2B3340' }}>Add Custom Field</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 130px)' }}>
          {/* Field name */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>Field name</label>
            <input
              ref={inputRef}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && fieldType === 'text') submit(); if (e.key === 'Escape') onClose(); }}
              placeholder="e.g. Owner ID, Floor Level…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#1EC9C4] focus:border-transparent"
            />
          </div>

          {/* Field type */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>Field type</label>
            <div className="grid grid-cols-2 gap-2">
              {([['text', 'Text', 'Free-form text input'], ['dropdown', 'Dropdown', 'Pick from a list']] as const).map(([val, title, desc]) => (
                <button key={val} onClick={() => setFieldType(val)}
                  className="flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all"
                  style={{ borderColor: fieldType === val ? '#1EC9C4' : '#E5E7EB', background: fieldType === val ? '#F0FFFE' : '#FFFFFF' }}>
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ borderColor: fieldType === val ? '#1EC9C4' : '#D1D5DB' }}>
                    {fieldType === val && <div className="w-2 h-2 rounded-full" style={{ background: '#1EC9C4' }} />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#2B3340' }}>{title}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Options editor — only for dropdown */}
          {fieldType === 'dropdown' && (
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6B7280' }}>Dropdown options</label>
              <div className="space-y-1.5">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#D1D5DB' }} />
                    <input
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#1EC9C4] focus:border-transparent"
                    />
                    {options.length > 1 && (
                      <button onClick={() => removeOption(i)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addOption}
                  className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg hover:bg-[#F0FFFE] transition-colors"
                  style={{ color: '#1EC9C4' }}>
                  <Plus size={11} /> Add option
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 flex-shrink-0" style={{ background: '#F8FAFB' }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={!label.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-1"
            style={{ background: '#1EC9C4' }}>
            <Plus size={12} /> Add Field
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProspectHub() {
  // ── Current user (drives data isolation + permission gates) ──────────────
  const me = getCurrentUser();
  const myEmail = (me?.email ?? '').toLowerCase();
  const OWNER_NAME  = me?.name  || 'LinuxLin';
  const OWNER_EMAIL = me?.email || 'unknown@whyestate.com';
  const myRole      = resolveAppRole(me?.email);
  const can         = (key: string) => canDo(myRole, key);

  // ── Hydrate full CRM state from localStorage (shared across users) ───────
  const initialState = (() => {
    const loaded = loadCrmState();
    if (loaded && loaded.boards.length > 0) {
      // Backfill owner & folder fields for any legacy boards that pre-date them.
      const boards = loaded.boards.map((b) => ({
        ...b,
        ownerEmail: b.ownerEmail || OWNER_EMAIL,
        ownerName:  b.ownerName  || (b.ownerEmail ? b.ownerEmail.split('@')[0] : OWNER_NAME),
        folderId:   b.folderId === undefined ? null : b.folderId,
      }));
      const folders = (loaded.folders ?? []).map((f) => ({
        ...f,
        ownerName: f.ownerName ?? (f.ownerEmail ? f.ownerEmail.split('@')[0] : ''),
      }));
      return { boards, prospects: loaded.prospects ?? {}, members: loaded.members ?? {}, folders, folderMembers: loaded.folderMembers ?? {}, agents: loaded.agents ?? [], recycleBin: loaded.recycleBin ?? [] };
    }
    // First-time-ever bootstrap on this browser → seed demo data owned by current user.
    const seedBoards: Board[] = SEED_BOARDS_TEMPLATE.map((b) => ({ ...b, ownerEmail: OWNER_EMAIL, ownerName: OWNER_NAME, folderId: null }));
    const seedByBoard: Record<string, Prospect[]> = {
      board_1: seedProspects.slice(0, 5),
      board_2: seedProspects.slice(5, 9),
      board_3: seedProspects.slice(9, 13),
      board_4: seedProspects.slice(13, 15),
      board_5: seedProspects.slice(15, 17),
      board_6: seedProspects.slice(17),
    };
    return { boards: seedBoards, prospects: seedByBoard, members: {} as Record<string, BoardMember[]>, folders: [] as Folder[], folderMembers: {} as Record<string, BoardMember[]>, agents: [] as AgentPreset[], recycleBin: [] as RecycledItem[] };
  })();

  // ── Board state ───────────────────────────────────────────────────────────
  const [boards, setBoards] = useState<Board[]>(initialState.boards);
  const [view, setView]     = useState<'board' | 'grid'>('board');
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [showNewBoard, setShowNewBoard]         = useState(false);
  const [arrangeMode, setArrangeMode]           = useState(false);
  const [manageBoardId, setManageBoardId]       = useState<string | null>(null);
  const [manageFolderId, setManageFolderId]     = useState<string | null>(null);
  const [boardMembers, setBoardMembers]         = useState<Record<string, BoardMember[]>>(initialState.members);
  const [boardProspects, setBoardProspects]     = useState<Record<string, Prospect[]>>(initialState.prospects);
  const [folders, setFolders]                   = useState<Folder[]>(initialState.folders);
  const [folderMembers, setFolderMembers]       = useState<Record<string, BoardMember[]>>(initialState.folderMembers);
  const [agentPresets, setAgentPresets]         = useState<AgentPreset[]>(initialState.agents);
  const [recycleBin, setRecycleBin]             = useState<RecycledItem[]>(initialState.recycleBin);
  const [showRecycleBin, setShowRecycleBin]     = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  // Folder-aggregate view supports either a single folder or a combined set of folders.
  const [folderView, setFolderView]             = useState<{ name: string; folderIds: string[] } | null>(null);

  // ── Folder visibility: own it OR invited to it ──────────────────────────
  const isFolderVisible = (f: Folder): boolean => {
    if (f.ownerEmail.toLowerCase() === myEmail) return true;
    return (folderMembers[f.id] ?? []).some((m) => m.email.toLowerCase() === myEmail);
  };

  // ── Board visibility: own it OR invited to it OR invited to its folder ───
  const isVisible = (b: Board): boolean => {
    if (b.ownerEmail.toLowerCase() === myEmail) return true;
    if ((boardMembers[b.id] ?? []).some((m) => m.email.toLowerCase() === myEmail)) return true;
    if (b.folderId) {
      const folder = folders.find((f) => f.id === b.folderId);
      if (folder && isFolderVisible(folder)) return true;
    }
    return false;
  };
  const visibleBoards = boards.filter(isVisible);
  const visibleFolders = folders.filter(isFolderVisible);

  // ── Persist any change back to shared localStorage ────────────────────────
  useEffect(() => {
    saveCrmState({ boards, prospects: boardProspects, members: boardMembers, folders, folderMembers, agents: agentPresets, recycleBin });
  }, [boards, boardProspects, boardMembers, folders, folderMembers, agentPresets, recycleBin]);

  // ── Agent preset CRUD ─────────────────────────────────────────────────────
  const addAgentPreset = (name: string, color: string): AgentPreset => {
    const trimmed = name.trim();
    const existing = agentPresets.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const preset: AgentPreset = { id: `agent_${Date.now()}`, name: trimmed, color };
    setAgentPresets((prev) => [...prev, preset]);
    return preset;
  };
  const removeAgentPreset = (id: string) => {
    setAgentPresets((prev) => prev.filter((p) => p.id !== id));
  };

  const memberCounts: Record<string, number> = {};
  const updatedPcts: Record<string, number> = {};
  for (const b of visibleBoards) {
    memberCounts[b.id] = 1 + (boardMembers[b.id]?.length ?? 0); // owner + invited
    const arr = boardProspects[b.id] ?? [];
    const updated = arr.filter((p) => p.lastUpdate && p.lastUpdate.length > 0).length;
    updatedPcts[b.id] = arr.length === 0 ? 0 : Math.round((updated / arr.length) * 100);
  }

  const updateBoard = (id: string, patch: { name: string; location: string; color: string }) => {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    if (activeBoard?.id === id) setActiveBoard((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  // Invite doesn't set a role — the member's effective permission comes from
  // their entry in Admin Control → User Setting. The stored `role` is a
  // bookkeeping placeholder only.
  const inviteBoardMember = (boardId: string, email: string) => {
    const member: BoardMember = { id: `m_${Date.now()}`, email, role: 'viewer' };
    setBoardMembers((prev) => ({ ...prev, [boardId]: [...(prev[boardId] ?? []), member] }));
  };

  const removeBoardMember = (boardId: string, memberId: string) => {
    setBoardMembers((prev) => {
      const list = prev[boardId] ?? [];
      const target = list.find((m) => m.id === memberId);
      // Hard guard — the auto-invited master admin can never be removed.
      if (target && target.email.toLowerCase() === MASTER_ADMIN_EMAIL_PH) return prev;
      return { ...prev, [boardId]: list.filter((m) => m.id !== memberId) };
    });
  };

  const inviteFolderMember = (folderId: string, email: string) => {
    const member: BoardMember = { id: `fm_${Date.now()}`, email, role: 'viewer' };
    setFolderMembers((prev) => ({ ...prev, [folderId]: [...(prev[folderId] ?? []), member] }));
  };

  const removeFolderMember = (folderId: string, memberId: string) => {
    setFolderMembers((prev) => {
      const list = prev[folderId] ?? [];
      const target = list.find((m) => m.id === memberId);
      if (target && target.email.toLowerCase() === MASTER_ADMIN_EMAIL_PH) return prev;
      return { ...prev, [folderId]: list.filter((m) => m.id !== memberId) };
    });
  };

  // ── Folder mutations ──────────────────────────────────────────────────────
  // Master admin gets auto-invited to every new board/folder so they can see
  // everyone's work without having to be hand-invited by each user.
  const autoInviteMaster = (): BoardMember | null => {
    if (OWNER_EMAIL.toLowerCase() === MASTER_ADMIN_EMAIL_PH) return null;
    return { id: `m_master_${Date.now()}`, email: MASTER_ADMIN_EMAIL_PH, role: 'master_admin' };
  };

  const createFolder = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const folder: Folder = { id: `folder_${Date.now()}`, name: trimmed, ownerEmail: OWNER_EMAIL, ownerName: OWNER_NAME };
    setFolders((prev) => [...prev, folder]);
    const master = autoInviteMaster();
    if (master) setFolderMembers((prev) => ({ ...prev, [folder.id]: [master] }));
  };
  const renameFolder = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: trimmed } : f)));
  };
  const deleteFolder = (id: string) => {
    const folder = folders.find((f) => f.id === id);
    if (folder) {
      const item: RecycledItem = {
        kind: 'folder', id,
        deletedAt: new Date().toISOString(),
        deletedBy: getCurrentUser()?.email ?? '',
        payload: { folder, members: folderMembers[id] ?? [] },
      };
      setRecycleBin((prev) => [item, ...prev]);
    }
    setBoards((prev) => prev.map((b) => (b.folderId === id ? { ...b, folderId: null } : b)));
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setFolderMembers((prev) => { const { [id]: _drop, ...rest } = prev; return rest; });
  };
  const moveBoardToFolder = (boardId: string, folderId: string | null) => {
    setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, folderId } : b)));
  };
  const toggleFolderCollapse = (id: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Unload: drop all of MY boards (other users' data is preserved) ───────
  const unloadDemoData = () => {
    const myBoardIds = new Set(boards.filter((b) => b.ownerEmail.toLowerCase() === myEmail).map((b) => b.id));
    if (myBoardIds.size === 0) {
      window.alert('Nothing to unload — you have no boards.');
      return;
    }
    const ok = window.confirm(`Remove all ${myBoardIds.size} of your boards and their prospects?\n\nBoards owned by other users won't be touched.`);
    if (!ok) return;
    setBoards((prev) => prev.filter((b) => !myBoardIds.has(b.id)));
    setBoardProspects((prev) => {
      const next: Record<string, Prospect[]> = {};
      for (const [k, v] of Object.entries(prev)) if (!myBoardIds.has(k)) next[k] = v;
      return next;
    });
    setBoardMembers((prev) => {
      const next: Record<string, BoardMember[]> = {};
      for (const [k, v] of Object.entries(prev)) if (!myBoardIds.has(k)) next[k] = v;
      return next;
    });
    setActiveBoard((curr) => (curr && myBoardIds.has(curr.id) ? null : curr));
    setView('board');
    // Also drop my folders.
    setFolders((prev) => prev.filter((f) => f.ownerEmail.toLowerCase() !== myEmail));
  };

  // ── Load 50 × 300 demo dataset (replaces YOUR boards; other users' data is preserved) ─
  const loadDemoData = () => {
    const ok = window.confirm('Load 50 demo project boards (300 prospects each) organised into 5 location folders?\n\nThis will REPLACE all of your current boards, folders, & prospects (boards owned by other users are not touched).');
    if (!ok) return;
    const seed = generateDemoSeed(OWNER_EMAIL, OWNER_NAME, 50, 300);
    const otherOwnedIds = new Set(boards.filter((b) => b.ownerEmail.toLowerCase() !== myEmail).map((b) => b.id));
    setBoards((prev) => {
      const others = prev.filter((b) => b.ownerEmail.toLowerCase() !== myEmail);
      return [...seed.boards, ...others];
    });
    setBoardProspects((prev) => {
      const next: Record<string, Prospect[]> = {};
      for (const [k, v] of Object.entries(prev)) if (otherOwnedIds.has(k)) next[k] = v;
      Object.assign(next, seed.prospects);
      return next;
    });
    setBoardMembers((prev) => {
      const next: Record<string, BoardMember[]> = {};
      for (const [k, v] of Object.entries(prev)) if (otherOwnedIds.has(k)) next[k] = v;
      return next;
    });
    // Replace MY folders with the 5 demo folders; keep folders owned by others.
    setFolders((prev) => {
      const others = prev.filter((f) => f.ownerEmail.toLowerCase() !== myEmail);
      return [...seed.folders, ...others];
    });
    setCollapsedFolders(new Set());
  };

  const totalAll = Object.values(boardProspects).reduce((s, arr) => s + arr.length, 0);

  const deleteBoard = (id: string) => {
    const board = boards.find((b) => b.id === id);
    if (board) {
      const item: RecycledItem = {
        kind: 'board', id,
        deletedAt: new Date().toISOString(),
        deletedBy: getCurrentUser()?.email ?? '',
        payload: { board, prospects: boardProspects[id] ?? [], members: boardMembers[id] ?? [] },
      };
      setRecycleBin((prev) => [item, ...prev]);
    }
    setBoards((prev) => prev.filter((b) => b.id !== id));
    setBoardProspects((prev) => { const { [id]: _drop, ...rest } = prev; return rest; });
    setBoardMembers((prev) => { const { [id]: _drop, ...rest } = prev; return rest; });
    if (activeBoard?.id === id) { setActiveBoard(null); setView('board'); }
  };

  const createBoard = (name: string, location: string, color: string) => {
    const newBoard: Board = { id: `board_${Date.now()}`, name, location, color, ownerEmail: OWNER_EMAIL, ownerName: OWNER_NAME, folderId: null };
    setBoards((prev) => [...prev, newBoard]);
    setBoardProspects((prev) => ({ ...prev, [newBoard.id]: [] }));
    const master = autoInviteMaster();
    if (master) setBoardMembers((prev) => ({ ...prev, [newBoard.id]: [master] }));
  };

  const openBoard = (board: Board) => {
    setActiveBoard(board);
    setFolderView(null);
    setView('grid');
  };

  const openFolderView = (folder: Folder) => {
    setFolderView({ name: folder.name, folderIds: [folder.id] });
    setActiveBoard(null);
    setView('grid');
  };

  const openCombinedFolderView = (selected: Folder[]) => {
    if (selected.length === 0) return;
    const name = selected.length === 1
      ? selected[0].name
      : `Combined · ${selected.length} folders`;
    setFolderView({ name, folderIds: selected.map((f) => f.id) });
    setActiveBoard(null);
    setView('grid');
  };

  // Editable copy of seedProspects for the no-board (default) grid view
  const [defaultRows, setDefaultRows] = useState<Prospect[]>(seedProspects);

  // ── Folder-aggregate view: rows from every board inside the folder ───────
  const folderViewBoardIds = useMemo<string[]>(() => {
    if (!folderView) return [];
    const folderIdSet = new Set(folderView.folderIds);
    return boards
      .filter((b) => {
        if (b.folderId === null || !folderIdSet.has(b.folderId)) return false;
        if (b.ownerEmail.toLowerCase() === myEmail) return true;
        return (boardMembers[b.id] ?? []).some((m) => m.email.toLowerCase() === myEmail);
      })
      .map((b) => b.id);
  }, [folderView, boards, boardMembers, myEmail]);

  // Current rows: folder view (aggregated) > active board > default seed
  const rows: Prospect[] = useMemo(() => {
    if (folderView) return folderViewBoardIds.flatMap((bid) => boardProspects[bid] ?? []);
    if (activeBoard) return boardProspects[activeBoard.id] ?? [];
    return defaultRows;
  }, [folderView, folderViewBoardIds, activeBoard, boardProspects, defaultRows]);

  // setRows: in folder-view mode we route writes back to each prospect's
  // source board. In single-board mode we update that board directly.
  const setRows = (updater: Prospect[] | ((prev: Prospect[]) => Prospect[])) => {
    const nextRows = typeof updater === 'function' ? updater(rows) : updater;
    if (folderView) {
      // Build a new mapping board → prospects for boards in the folder.
      // Rows come back tagged by id, so we look up which board originally held each id.
      const idToBoardId = new Map<string, string>();
      for (const bid of folderViewBoardIds) {
        for (const p of boardProspects[bid] ?? []) idToBoardId.set(p.id, bid);
      }
      const grouped: Record<string, Prospect[]> = {};
      for (const bid of folderViewBoardIds) grouped[bid] = [];
      const orphans: Prospect[] = [];
      for (const r of nextRows) {
        const bid = idToBoardId.get(r.id);
        if (bid) grouped[bid].push(r);
        else orphans.push(r);
      }
      // New rows added in folder view → drop into the first board in the folder
      // (so they have a real owner board to live in).
      if (orphans.length && folderViewBoardIds.length) {
        grouped[folderViewBoardIds[0]] = grouped[folderViewBoardIds[0]].concat(orphans);
      }
      setBoardProspects((prev) => ({ ...prev, ...grouped }));
      return;
    }
    if (activeBoard) {
      setBoardProspects((prev) => ({
        ...prev,
        [activeBoard.id]: typeof updater === 'function' ? updater(prev[activeBoard.id] ?? []) : updater,
      }));
    } else {
      setDefaultRows((prev) => (typeof updater === 'function' ? updater(prev) : updater));
    }
  };

  const [search, setSearch] = useState('');
  const [quickView, setQuickView] = useState<QuickView>('All');
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<Filters>({ callingStatus: [], furnishing: [], availability: [], agent: [], askingRentRange: [0, RENT_MAX], askingPriceRange: [0, PRICE_MAX] });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [rowMenu, setRowMenu] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAddField, setShowAddField] = useState(false);

  // ── Dynamic columns (base + custom) ──────────────────────────────────────
  const [columns, setColumns] = useState<ColDef[]>(BASE_COLUMNS);
  // Custom field values: { rowId: { colKey: value } }
  const [customValues, setCustomValues] = useState<Record<string, Record<string, string>>>({});

  const renameColumn = (key: string, label: string) => {
    setColumns((prev) => prev.map((c) => c.key === key ? { ...c, label } : c));
  };
  const deleteColumn = (key: string) => {
    setColumns((prev) => prev.filter((c) => c.key !== key));
    setCustomValues((prev) => {
      const next: Record<string, Record<string, string>> = {};
      Object.entries(prev).forEach(([rowId, vals]) => {
        const { [key]: _removed, ...rest } = vals;
        next[rowId] = rest;
      });
      return next;
    });
  };
  const addCustomField = (label: string, type: FieldType, options: string[]) => {
    const key = `custom_${Date.now()}`;
    const colType: ColType = type === 'dropdown' ? 'custom-select' : 'text';
    setColumns((prev) => [...prev, { key, label, width: 160, type: colType, fixed: false, placeholder: type === 'text' ? 'Add…' : undefined, options: type === 'dropdown' ? options : undefined }]);
  };

  // ── Space-pan ─────────────────────────────────────────────────────────────
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const isPanning = useSpacePan(gridScrollRef);

  // ── Row virtualization ────────────────────────────────────────────────────
  // Only render the rows currently in the viewport. Prevents the table from
  // building thousands of DOM nodes when a folder-aggregate view contains many
  // boards. Each row is a fixed 36px td + 1px border = 37px.
  const ROW_HEIGHT_PX = 37;
  const ROW_OVERSCAN = 8;
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(800);
  useEffect(() => {
    if (view !== 'grid') return;
    const el = gridScrollRef.current;
    if (!el) return;
    let raf = 0;
    const sync = () => {
      raf = 0;
      setScrollTop(el.scrollTop);
      setViewportH(el.clientHeight);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(sync); };
    sync();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', sync);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [view]);
  // Reset scroll when switching what we're looking at
  useEffect(() => {
    if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [folderView, activeBoard]);

  // ── Fill-handle drag state ────────────────────────────────────────────────
  // fillSrc = { rowId, colKey, value } — cell the drag started from
  // fillRange = rowIds that will be filled
  const fillSrc   = useRef<{ rowId: string; colKey: string; value: string } | null>(null);
  const [fillRange, setFillRange] = useState<Set<string>>(new Set());
  const [activeCell, setActiveCell] = useState<{ rowId: string; colKey: string } | null>(null);

  // ── Distinct agents across the current row set (drives Agent filter dropdown).
  // Rows with no agent are excluded — only surface actual nicknames.
  const agentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const a = r.agent.trim();
      if (a) set.add(a);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // ── Counts for quick view tabs ────────────────────────────────────────────
  const counts: Record<QuickView, number> = useMemo(() => {
    let rent = 0;
    let sale = 0;
    for (const r of rows) {
      const types = r.listingType.split(',').map((s) => s.trim());
      if (types.includes('Rent')) rent++;
      if (types.includes('Sale')) sale++;
    }
    return { All: rows.length, Rent: rent, Sale: sale };
  }, [rows]);

  // ── Filter + search ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const callingSet = new Set(filters.callingStatus);
    const furnishSet = new Set(filters.furnishing);
    const availSet   = new Set(filters.availability);
    const agentSet   = new Set(filters.agent);
    const fullRent  = filters.askingRentRange[0]  === 0 && filters.askingRentRange[1]  === RENT_MAX;
    const fullPrice = filters.askingPriceRange[0] === 0 && filters.askingPriceRange[1] === PRICE_MAX;
    return rows.filter((r) => {
      const matchSearch = !q || r.name.toLowerCase().includes(q) || r.unitNo.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q);
      if (!matchSearch) return false;
      const matchQuick   = quickView === 'All' || r.listingType.split(',').map((s) => s.trim()).includes(quickView);
      if (!matchQuick) return false;
      if (callingSet.size > 0 && !callingSet.has(r.callingStatus)) return false;
      if (furnishSet.size > 0 && !furnishSet.has(r.furnishing)) return false;
      if (availSet.size  > 0 && !availSet.has(r.availability))  return false;
      if (agentSet.size  > 0 && !agentSet.has(r.agent))         return false;
      if (!fullRent) {
        const rent = parseMoney(r.askingRent);
        if (rent < filters.askingRentRange[0] || rent > filters.askingRentRange[1]) return false;
      }
      if (!fullPrice) {
        const price = parseMoney(r.askingPrice);
        if (price < filters.askingPriceRange[0] || price > filters.askingPriceRange[1]) return false;
      }
      return true;
    });
  }, [rows, search, quickView, filters]);

  // ── Cell value reader (works for both system & custom fields) ────────────
  // ── Folder-view: prospect.id → its source board (for the Project column) ─
  const prospectToBoard = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    if (!folderView) return m;
    const boardById = new Map(boards.map((b) => [b.id, b]));
    for (const bid of folderViewBoardIds) {
      const board = boardById.get(bid);
      if (!board) continue;
      for (const p of boardProspects[bid] ?? []) {
        m.set(p.id, { name: board.name, color: board.color });
      }
    }
    return m;
  }, [folderView, folderViewBoardIds, boards, boardProspects]);

  const getCellValue = (row: Prospect, colKey: string): string => {
    if (colKey === 'projectName') return prospectToBoard.get(row.id)?.name ?? '';
    if (colKey in row) return (row as unknown as Record<string, string>)[colKey] ?? '';
    return customValues[row.id]?.[colKey] ?? '';
  };

  // ── Time helpers ──────────────────────────────────────────────────────────
  // Malaysia time = Asia/Kuala_Lumpur (UTC+8). Shown as "DD MMM YYYY, HH:mm"
  const nowMyt = (): string => new Date().toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  // NOT memoised — these close over `setRows`, which itself depends on
  // folderView / activeBoard. Memoising would freeze them at first render.
  const updateRow = <K extends keyof Prospect>(id: string, key: K, value: Prospect[K]) => {
    // Permission gate — silently no-op if the role lacks rows.edit
    if (!can('rows.edit')) return;
    if (key === 'lastUpdate') {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, lastUpdate: value as string } : r)));
      return;
    }
    // Agent edits stamp lastUpdate but don't trigger another agent stamp.
    if (key === 'agent') {
      const stamp = nowMyt();
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, agent: value as string, lastUpdate: stamp } : r)));
      return;
    }
    const stamp = nowMyt();
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value, lastUpdate: stamp } : r)));
  };

  const updateCustom = (rowId: string, colKey: string, value: string) => {
    if (!can('rows.edit')) return;
    const stamp = nowMyt();
    setCustomValues((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] ?? {}), [colKey]: value },
    }));
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, lastUpdate: stamp } : r)));
  };

  const setCellValue = (rowId: string, colKey: string, value: string) => {
    const isSystemKey = BASE_COLUMNS.some((c) => c.key === colKey);
    if (isSystemKey) {
      updateRow(rowId, colKey as keyof Prospect, value as Prospect[keyof Prospect]);
    } else {
      updateCustom(rowId, colKey, value);
    }
  };

  const addRow = () => {
    const newId = String(Date.now());
    setRows((prev) => [...prev, {
      id: newId, name: '', unitNo: '', type: '', size: '', phone: '', agent: '', lastUpdate: '',
      callingStatus: '', listingType: '', furnishing: '',
      availability: '', askingRent: '', askingPrice: '', remark: '',
    }]);
    // The new row may sit outside the virtualization window, so scroll the
    // container itself to its new bottom — the row will mount on next frame.
    setTimeout(() => {
      const el = gridScrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, 50);
  };

  // Resolve which board a prospect currently lives in (single board view, folder view, or default seed).
  const prospectHomeBoardId = (rowId: string): string => {
    if (activeBoard) return activeBoard.id;
    if (folderView) {
      for (const bid of folderViewBoardIds) {
        if ((boardProspects[bid] ?? []).some((p) => p.id === rowId)) return bid;
      }
    }
    return '__default__';
  };
  const pushProspectsToBin = (ids: string[]) => {
    const stamp = new Date().toISOString();
    const me = getCurrentUser()?.email ?? '';
    const items: RecycledItem[] = [];
    for (const id of ids) {
      const prospect = rows.find((r) => r.id === id);
      if (!prospect) continue;
      items.push({
        kind: 'prospect', id,
        deletedAt: stamp, deletedBy: me,
        payload: { boardId: prospectHomeBoardId(id), prospect, customValues: customValues[id] ?? {} },
      });
    }
    if (items.length) setRecycleBin((prev) => [...items, ...prev]);
  };

  const deleteRow = (id: string) => {
    pushProspectsToBin([id]);
    setRows((p) => p.filter((r) => r.id !== id));
    setSelectedRows((p) => { const s = new Set(p); s.delete(id); return s; });
    setCustomValues((p) => { const n = { ...p }; delete n[id]; return n; });
  };
  const deleteSelected = () => {
    const ids = Array.from(selectedRows);
    pushProspectsToBin(ids);
    setRows((p) => p.filter((r) => !selectedRows.has(r.id)));
    setCustomValues((p) => {
      const n = { ...p };
      selectedRows.forEach((id) => delete n[id]);
      return n;
    });
    setSelectedRows(new Set());
  };
  // ── Recycle Bin: restore + permanently purge ──────────────────────────────
  const restoreFromBin = (id: string) => {
    const item = recycleBin.find((x) => x.id === id);
    if (!item) return;
    if (item.kind === 'board') {
      const p = item.payload as { board: Board; prospects: Prospect[]; members: BoardMember[] };
      setBoards((prev) => [...prev, p.board]);
      setBoardProspects((prev) => ({ ...prev, [p.board.id]: p.prospects }));
      setBoardMembers((prev) => ({ ...prev, [p.board.id]: p.members }));
    } else if (item.kind === 'folder') {
      const p = item.payload as { folder: Folder; members: BoardMember[] };
      setFolders((prev) => [...prev, p.folder]);
      setFolderMembers((prev) => ({ ...prev, [p.folder.id]: p.members }));
    } else if (item.kind === 'prospect') {
      const p = item.payload as { boardId: string; prospect: Prospect; customValues: Record<string, string> };
      if (p.boardId === '__default__') {
        setDefaultRows((prev) => [...prev, p.prospect]);
      } else {
        setBoardProspects((prev) => ({ ...prev, [p.boardId]: [...(prev[p.boardId] ?? []), p.prospect] }));
      }
      if (Object.keys(p.customValues).length) {
        setCustomValues((prev) => ({ ...prev, [p.prospect.id]: p.customValues }));
      }
    }
    setRecycleBin((prev) => prev.filter((x) => x.id !== id));
  };
  const purgeFromBin = (id: string) => {
    setRecycleBin((prev) => prev.filter((x) => x.id !== id));
  };
  const emptyBin = () => setRecycleBin([]);

  const duplicateRow = (id: string) => {
    const src = rows.find((r) => r.id === id);
    if (!src) return;
    const newId  = String(Date.now());
    const newRow = { ...src, id: newId };
    setRows((prev) => { const idx = prev.findIndex((r) => r.id === id); const next = [...prev]; next.splice(idx + 1, 0, newRow); return next; });
    if (customValues[id]) setCustomValues((p) => ({ ...p, [newId]: { ...p[id] } }));
    setRowMenu(null);
  };

  // ── Import to Clients module ─────────────────────────────────────────────
  // Snapshots a prospect row into the Clients module so it can carry follow-up
  // state and tasks. Idempotent on prospectId — re-importing refreshes the
  // snapshot fields and bumps the timestamp.
  const [importedTick, setImportedTick] = useState(0);
  const importedProspectIds = useMemo(() => {
    void importedTick; // bust when import happens
    return new Set(listClients().map((c) => c.prospectId).filter(Boolean) as string[]);
  }, [importedTick]);
  const [importToast, setImportToast] = useState<{ name: string; created: boolean } | null>(null);

  const importRowAsClient = (id: string) => {
    const src = rows.find((r) => r.id === id);
    if (!src) return;
    // Resolve the source board name from whichever view we're in.
    const boardName = activeBoard?.name ?? prospectToBoard.get(id)?.name ?? '';
    const { client, created } = importFromProspect({
      prospectId:    src.id,
      name:          src.name,
      phone:         src.phone,
      unitNo:        src.unitNo,
      boardName,
      listingType:   src.listingType,
      askingRent:    src.askingRent,
      askingPrice:   src.askingPrice,
      callingStatus: src.callingStatus,
      remark:        src.remark,
      agent:         src.agent,
    }, OWNER_EMAIL);
    setImportedTick((t) => t + 1);
    setImportToast({ name: client.name, created });
    setRowMenu(null);
    setTimeout(() => setImportToast(null), 2800);
  };

  const toggleRow   = (id: string) => setSelectedRows((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll   = () => setSelectedRows(selectedRows.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)));

  // ── Fill-handle: drag starts on the handle dot ────────────────────────────
  const onFillHandleMouseDown = (e: React.MouseEvent, rowId: string, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const value = getCellValue(rows.find((r) => r.id === rowId)!, colKey);
    fillSrc.current = { rowId, colKey, value };
    setFillRange(new Set([rowId]));

    const onMove = (ev: MouseEvent) => {
      if (!fillSrc.current) return;
      // Find which row the mouse is over
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const td = el?.closest('[data-rowid]') as HTMLElement | null;
      if (!td) return;
      const hoverId = td.dataset.rowid;
      if (!hoverId) return;
      // Build range from src to hover
      const allIds = filtered.map((r) => r.id);
      const srcIdx = allIds.indexOf(fillSrc.current.rowId);
      const hovIdx = allIds.indexOf(hoverId);
      if (srcIdx < 0 || hovIdx < 0) return;
      const [from, to] = srcIdx <= hovIdx ? [srcIdx, hovIdx] : [hovIdx, srcIdx];
      setFillRange(new Set(allIds.slice(from, to + 1)));
    };
    const onUp = () => {
      if (fillSrc.current && fillRange.size > 0) {
        const { colKey: ck, value: val } = fillSrc.current;
        fillRange.forEach((rid) => setCellValue(rid, ck, val));
      }
      fillSrc.current = null;
      setFillRange(new Set());
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Export ────────────────────────────────────────────────────────────────
  // Resolve which rows + base filename a given scope refers to.
  // boardId: undefined = current view (filtered); null = all visible boards; else specific board
  // The base filename is `<slug>-<YYYY-MM-DD>` so files self-document where they
  // came from and when they were exported.
  const slugify = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  const todayStamp = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const resolveExportScope = (boardId: string | null | undefined) => {
    const date = todayStamp();
    if (boardId === undefined) {
      // Current view — derive name from whichever board / folder we're looking at.
      const namePart = activeBoard
        ? slugify(activeBoard.name)
        : folderView
          ? slugify(folderView.name)
          : 'prospects';
      return { rows: filtered, base: `${namePart || 'prospects'}-${date}` };
    }
    if (boardId === null) return { rows: visibleBoards.flatMap((b) => boardProspects[b.id] ?? []), base: `all-boards-${date}` };
    const board = boards.find((b) => b.id === boardId);
    const safeName = slugify(board?.name ?? boardId);
    return { rows: boardProspects[boardId] ?? [], base: `${safeName || 'board'}-${date}` };
  };

  const exportCsv = (boardId: string | null | undefined = undefined) => {
    const { rows: exportRows, base } = resolveExportScope(boardId);
    const headers = columns.map((c) => c.label).join(',');
    const body = exportRows.map((r) =>
      columns.map((c) => `"${getCellValue(r, c.key).replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[headers, ...body].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${base}.csv`; a.click();
  };

  const exportXlsx = (boardId: string | null | undefined = undefined) => {
    const { rows: exportRows, base } = resolveExportScope(boardId);
    const headers = columns.map((c) => c.label);

    // Build the sheet first with raw values, then style every cell.
    // Money columns are stored as real numbers so Excel sums/sorts correctly.
    const aoa: (string | number)[][] = [
      headers,
      ...exportRows.map((r) => columns.map((c) => {
        const v = getCellValue(r, c.key);
        if (c.key === 'askingRent' || c.key === 'askingPrice') {
          const n = parseMoney(v);
          return n > 0 ? n : '';
        }
        return v;
      })),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // ── Style helpers (xlsx colors are 'FFRRGGBB' — no leading #) ────────────
    const rgb = (hex: string) => 'FF' + hex.replace('#', '').toUpperCase();
    const thin = { style: 'thin', color: { rgb: rgb('#E5E7EB') } } as const;
    const cellBorder = { top: thin, bottom: thin, left: thin, right: thin } as const;

    // Mirrors the in-app badge styles (CALLING_STATUS_STYLE et al).
    const PILLS: Record<string, Record<string, { bg: string; text: string }>> = {
      callingStatus: {
        Positive: { bg: '#DCFCE7', text: '#16A34A' },
        Negative: { bg: '#FEE2E2', text: '#DC2626' },
        Neutral:  { bg: '#FEF9C3', text: '#CA8A04' },
      },
      listingType: {
        Rent: { bg: '#FFEDD5', text: '#EA580C' },
        Sale: { bg: '#F3F4F6', text: '#374151' },
      },
      furnishing: {
        'Fully Furnished':  { bg: '#DBEAFE', text: '#1D4ED8' },
        'Partly Furnished': { bg: '#DCFCE7', text: '#15803D' },
        'Bare Unit':        { bg: '#F3F4F6', text: '#374151' },
      },
      availability: {
        'Available':     { bg: '#DCFCE7', text: '#16A34A' },
        'NOT Available': { bg: '#FEE2E2', text: '#DC2626' },
      },
    };

    // ── Header row ──
    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[ref]) ws[ref] = { v: headers[c], t: 's' };
      ws[ref].s = {
        font: { bold: true, color: { rgb: rgb('#FFFFFF') }, sz: 11, name: 'Calibri' },
        fill: { fgColor: { rgb: rgb('#1EC9C4') } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: cellBorder,
      };
    }

    // ── Body rows ──
    for (let r = 0; r < exportRows.length; r++) {
      const row = exportRows[r];
      const stripe = r % 2 === 1;
      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        const ref = XLSX.utils.encode_cell({ r: r + 1, c });
        if (!ws[ref]) ws[ref] = { v: '', t: 's' };
        const raw = getCellValue(row, col.key);

        // Default body style — alternating row tint, soft borders.
        const style: Record<string, unknown> = {
          font: { color: { rgb: rgb('#374151') }, sz: 10, name: 'Calibri' },
          fill: { fgColor: { rgb: rgb(stripe ? '#FFFFFF' : '#F0FFFE') } },
          alignment: {
            horizontal: col.align === 'center' ? 'center' : 'left',
            vertical: 'center',
            wrapText: false,
          },
          border: cellBorder,
        };

        // Pill columns — bold colored text on a pastel fill.
        const map = col.selectKey ? PILLS[col.selectKey] : null;
        if (map) {
          if (col.selectKey === 'listingType') {
            const tags = raw.split(',').map((s) => s.trim()).filter(Boolean);
            if (tags.length === 1 && map[tags[0]]) {
              const p = map[tags[0]];
              style.fill = { fgColor: { rgb: rgb(p.bg) } };
              style.font = { color: { rgb: rgb(p.text) }, bold: true, sz: 10, name: 'Calibri' };
              (style.alignment as Record<string, unknown>).horizontal = 'center';
            }
          } else if (raw && map[raw]) {
            const p = map[raw];
            style.fill = { fgColor: { rgb: rgb(p.bg) } };
            style.font = { color: { rgb: rgb(p.text) }, bold: true, sz: 10, name: 'Calibri' };
            (style.alignment as Record<string, unknown>).horizontal = 'center';
          }
        }

        // Agent column — color the pill from the matching preset (palette keys only;
        // custom-hex agents fall back to plain bold text).
        if (col.key === 'agent' && raw) {
          const preset = agentPresets.find((p) => p.name === raw);
          const palette = preset && AGENT_COLOR_PALETTE[preset.color];
          if (palette) {
            style.fill = { fgColor: { rgb: rgb(palette.bg) } };
            style.font = { color: { rgb: rgb(palette.text) }, bold: true, sz: 10, name: 'Calibri' };
            (style.alignment as Record<string, unknown>).horizontal = 'center';
          }
        }

        // Money columns — number type with RM format, right-aligned mono.
        if (col.key === 'askingRent' || col.key === 'askingPrice') {
          const n = parseMoney(raw);
          if (n > 0) {
            ws[ref].t = 'n';
            ws[ref].v = n;
            ws[ref].z = '"RM "#,##0';
          }
          (style.alignment as Record<string, unknown>).horizontal = 'right';
          style.font = { ...(style.font as object), name: 'JetBrains Mono' };
        } else if (col.mono) {
          style.font = { ...(style.font as object), name: 'JetBrains Mono' };
        }

        ws[ref].s = style;
      }
    }

    // ── Column widths ──
    ws['!cols'] = headers.map((h, i) => {
      const sample = aoa.slice(1, 201).map((row) => String(row[i] ?? '').length);
      const maxLen = Math.max(h.length, ...sample, 10);
      return { wch: Math.min(maxLen + 4, 42) };
    });

    // ── Row heights — taller header, comfortable body. ──
    ws['!rows'] = [{ hpt: 28 }, ...exportRows.map(() => ({ hpt: 20 }))];

    // ── Header autofilter ──
    const lastCol = XLSX.utils.encode_col(headers.length - 1);
    ws['!autofilter'] = { ref: `A1:${lastCol}${exportRows.length + 1}` };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Prospects');

    // ── Freeze the header row so it stays visible while scrolling. ──
    // xlsx-js-style's WorkbookProperties typing doesn't expose Views/Sheets[].Views,
    // but the underlying writer reads them. Cast through unknown to keep this concise
    // without disabling type-checking elsewhere.
    if (!wb.Workbook) wb.Workbook = {};
    const wbAny = wb.Workbook as unknown as Record<string, unknown>;
    wbAny.Views = [{ RTL: false }];
    wbAny.Sheets = [{
      Hidden: 0,
      Views: [{ RTL: false, FrozenPane: { xSplit: 0, ySplit: 1, state: 'frozen', topLeftCell: 'A2', activePane: 'bottomLeft' } }],
    }];

    XLSX.writeFile(wb, `${base}.xlsx`);
  };


  // ── Import handler ────────────────────────────────────────────────────────
  const handleImport = (imported: Prospect[], mode: ImportMode) => {
    if (mode === 'replace') setRows(imported);
    else setRows((prev) => [...prev, ...imported]);
    setShowImport(false);
  };

  const totalWidth = columns.reduce((s, c) => s + c.width, 0) + 40 + 40 + 80; // +checkbox +rowNo +addfield

  // Banner shows whenever the real master admin is previewing as a different role.
  const realRole    = actualAppRole(me?.email);
  const isPreviewing = realRole === 'master_admin' && myRole !== 'master_admin';
  const previewDef  = APP_ROLES.find((r) => r.id === myRole);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col" style={{ background: '#F5F7FA' }}>

      {/* ── Preview banner (master admin previewing as another role) ── */}
      {isPreviewing && (
        <div className="flex items-center gap-2 px-4 py-1.5 flex-shrink-0" style={{ background: previewDef?.tone.text ?? '#1EC9C4', color: 'white' }}>
          <Eye size={13} />
          <span className="text-[11px] font-semibold">
            Previewing Prospect Hub as <span className="font-bold">{previewDef?.label ?? myRole}</span> — buttons & access reflect the matrix configured in Admin Control.
          </span>
          <button
            onClick={() => { setViewAsRole(null); window.location.reload(); }}
            className="ml-auto px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-white/20 transition-colors">
            Stop preview
          </button>
        </div>
      )}

      {/* ── Toolbar (grid view only) ──────────────────────────────── */}
      {view === 'grid' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          {/* Back to Boards */}
          <button onClick={() => { setView('board'); setActiveBoard(null); setFolderView(null); }}
            className="flex items-center gap-1 text-xs font-medium hover:text-[#1EC9C4] transition-colors flex-shrink-0"
            style={{ color: '#6B7280' }}>
            <ChevronLeft size={14} /> Boards
          </button>

          <span className="text-gray-200 flex-shrink-0">|</span>

          {/* Header — folder-view shows folder name + member-board count, board view shows board name + Owner */}
          {folderView ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <FolderIcon size={14} style={{ color: '#0F766E' }} />
              <span className="text-sm font-bold" style={{ color: '#2B3340' }}>{folderView.name}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                style={{ background: '#DAF3F2', color: '#0F766E' }}>
                Combined · {folderViewBoardIds.length} {folderViewBoardIds.length === 1 ? 'board' : 'boards'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: activeBoard?.color }} />
              <span className="text-sm font-bold" style={{ color: '#2B3340' }}>{activeBoard?.name}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                style={{ background: '#FEF3C7', color: '#92400E' }}>Owner</span>
            </div>
          )}

          {/* Search */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1.5 bg-white flex-1 max-w-xs focus-within:border-[#1EC9C4] transition-colors">
            <Search size={13} style={{ color: '#A1A9B6' }} />
            <input className="flex-1 text-xs outline-none bg-transparent placeholder:text-gray-300" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')}><X size={11} className="text-gray-300 hover:text-gray-500" /></button>}
          </div>

          <div className="flex-1" />

          {selectedRows.size > 0 && can('rows.bulk_delete') && (
            <button onClick={deleteSelected} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 bg-white transition-colors flex-shrink-0">
              <Trash2 size={13} /> Delete {selectedRows.size}
            </button>
          )}

          {/* Filter */}
          {can('view.filter') && (
            <button onClick={() => setShowFilter((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex-shrink-0 ${showFilter ? 'border-[#1EC9C4] text-[#1EC9C4] bg-[#DAF3F2]' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}>
              <Filter size={13} /> Filter
              {(filters.callingStatus.length > 0 || filters.furnishing.length > 0 || filters.availability.length > 0 || filters.agent.length > 0) && <span className="w-2 h-2 rounded-full bg-[#1EC9C4]" />}
            </button>
          )}

          {/* Import Data — gated by data.import */}
          {can('data.import') && (
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-[#1EC9C4] hover:text-[#1EC9C4] bg-white transition-colors flex-shrink-0">
              <Upload size={13} /> Import Data
            </button>
          )}

          {/* Export Data — gated by data.export. Opens a format picker modal. */}
          {can('data.export') && (
            <button
              onClick={() => setShowExport(true)}
              disabled={filtered.length === 0}
              title={filtered.length === 0 ? 'Nothing to export' : `Export ${filtered.length} ${filtered.length === 1 ? 'row' : 'rows'}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-[#1EC9C4] hover:text-[#1EC9C4] bg-white transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
              <Download size={13} /> Export Data
            </button>
          )}
        </div>
      )}

      {/* ── Board Overview (board mode) ────────────────────────────── */}
      {view === 'board' && (
        <BoardOverview
          boards={visibleBoards}
          folders={visibleFolders}
          folderMemberCounts={Object.fromEntries(visibleFolders.map((f) => [f.id, (folderMembers[f.id] ?? []).length]))}
          collapsedFolders={collapsedFolders}
          memberCounts={memberCounts}
          updatedPcts={updatedPcts}
          onOpenBoard={openBoard}
          onManageBoard={(b) => setManageBoardId(b.id)}
          onManageFolder={(f) => setManageFolderId(f.id)}
          onAddBoard={() => setShowNewBoard(true)}
          arrangeMode={arrangeMode}
          onToggleArrange={() => setArrangeMode((v) => !v)}
          onReorder={(newVisible) => {
            // Reorder only my visible boards; preserve invisible (other-owners') in their original positions.
            const visibleIds = new Set(newVisible.map((b) => b.id));
            const invisible = boards.filter((b) => !visibleIds.has(b.id));
            setBoards([...newVisible, ...invisible]);
          }}
          onAddFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          onMoveBoardToFolder={moveBoardToFolder}
          onToggleFolder={toggleFolderCollapse}
          onLoadDemo={loadDemoData}
          onUnloadDemo={unloadDemoData}
          onOpenFolderView={openFolderView}
          onOpenCombinedFolderView={openCombinedFolderView}
          perms={{
            boardsCreate:        can('boards.create'),
            boardsReorder:       can('boards.reorder'),
            foldersCreate:       can('folders.create'),
            foldersEdit:         can('folders.edit'),
            foldersDelete:       can('folders.delete'),
            foldersAssignBoards: can('folders.assign_boards'),
            foldersViewCombined: can('folders.view_combined'),
            // Show the manage gear if the user can do anything to the folder.
            foldersManage: can('folders.edit') || can('folders.delete') || can('folders.invite_members') || can('folders.remove_members'),
            boardsManage:  can('boards.edit') || can('boards.delete') || can('boards.invite_members') || can('boards.remove_members'),
            dataDemo:            can('data.demo'),
            recycleAccess:       can('recycle.access'),
          }}
          recycleCount={recycleBin.length}
          onOpenRecycleBin={() => setShowRecycleBin(true)}
          viewAs={{
            // Only the REAL master admin (ignoring any active preview) sees this.
            available: actualAppRole(me?.email) === 'master_admin',
            current: myRole,
            onChange: (next) => { setViewAsRole(next); window.location.reload(); },
          }}
        />
      )}

      {/* ── Quick View Tabs (grid mode only) — gated by view.quick_tabs ── */}
      {view === 'grid' && can('view.quick_tabs') && <div className="flex items-center gap-1 px-4 py-0 bg-white border-b border-gray-100 flex-shrink-0">
        {QUICK_VIEWS.map((qv) => {
          const isActive = quickView === qv.label;
          return (
            <button key={qv.label} onClick={() => setQuickView(qv.label)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all relative"
              style={{ color: isActive ? qv.activeText : '#9CA3AF' }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isActive ? qv.dot : '#E5E7EB' }} />
              {qv.label}
              <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold ml-0.5"
                style={{ background: isActive ? qv.activeBg : '#F3F4F6', color: isActive ? qv.activeText : '#9CA3AF' }}>
                {counts[qv.label]}
              </span>
              {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: qv.dot }} />}
            </button>
          );
        })}
      </div>}

      {/* ── Filter bar (grid only) ───────────────────────────────────── */}
      {view === 'grid' && showFilter && <FilterBar filters={filters} setFilters={setFilters} agentOptions={agentOptions} onClose={() => setShowFilter(false)} />}

      {/* ── Grid (grid only) ────────────────────────────────────────────── */}
      {view === 'grid' && (() => {
        // Prepend a "Project" column when in folder-aggregate view so each row
        // shows which board it's from (read-only, with the board's color dot).
        const displayColumns: ColDef[] = folderView
          ? [{ key: 'projectName', label: 'Project', width: 180, type: 'readonly', fixed: true }, ...columns]
          : columns;
        const displayTotalWidth = displayColumns.reduce((s, c) => s + c.width, 0) + 40 + 40 + 80;

        // Virtualization window: only render rows that fall in the current viewport
        // (plus a small overscan above and below for smoother scroll).
        const totalRows  = filtered.length;
        const startIdx   = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - ROW_OVERSCAN);
        const endIdx     = Math.min(totalRows, Math.ceil((scrollTop + viewportH) / ROW_HEIGHT_PX) + ROW_OVERSCAN);
        const visibleRows = filtered.slice(startIdx, endIdx);
        const topPad     = startIdx * ROW_HEIGHT_PX;
        const bottomPad  = Math.max(0, (totalRows - endIdx) * ROW_HEIGHT_PX);
        const spacerColSpan = displayColumns.length + 3;
        return (
        <div ref={gridScrollRef} className="flex-1 overflow-auto"
        style={{ cursor: isPanning ? 'grabbing' : 'default', userSelect: isPanning ? 'none' : undefined }}>
        <table style={{ minWidth: displayTotalWidth, borderCollapse: 'collapse', tableLayout: 'fixed', width: displayTotalWidth }}>
          <colgroup>
            <col style={{ width: 40 }} />
            <col style={{ width: 40 }} />
            {displayColumns.map((c) => <col key={c.key} style={{ width: c.width }} />)}
            <col style={{ width: 80 }} />
          </colgroup>

          {/* ── Header row ── */}
          <thead>
            <tr style={{ background: '#F8FAFB', borderBottom: '2px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 10 }}>
              <th style={{ width: 40, borderRight: '1px solid #E5E7EB' }} className="px-2 py-2.5">
                <input type="checkbox" checked={selectedRows.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll} className="w-3.5 h-3.5 rounded accent-[#1EC9C4] cursor-pointer" />
              </th>
              <th style={{ width: 40, borderRight: '2px solid #1EC9C4', color: '#A1A9B6', fontSize: 11, fontWeight: 600 }}
                className="px-2 py-2.5 text-center">#</th>

              {displayColumns.map((col) => (
                <th key={col.key}
                  style={{
                    borderRight: col.key === 'phone' ? '2px solid #1EC9C4' : '1px solid #E5E7EB',
                    fontWeight: 600, fontSize: 11, color: '#6B7280',
                    padding: '6px 8px', whiteSpace: 'nowrap',
                  }}>
                  <HeaderCell col={col} onRename={renameColumn} onDelete={deleteColumn} canEdit={can('columns.edit')} canDelete={can('columns.delete')} />
                </th>
              ))}

              {/* Add Field button — gated by columns.create */}
              <th style={{ borderLeft: '1px solid #E5E7EB', width: 80 }} className="px-2 py-2.5">
                {can('columns.create') && (
                  <button
                    onClick={() => setShowAddField(true)}
                    className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border border-dashed transition-colors hover:border-[#1EC9C4] hover:text-[#1EC9C4] hover:bg-[#F0FFFE]"
                    style={{ borderColor: '#D1D5DB', color: '#9CA3AF' }}>
                    <Plus size={11} strokeWidth={2.5} /> Field
                  </button>
                )}
              </th>
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {topPad > 0 && (
              <tr aria-hidden="true">
                <td colSpan={spacerColSpan} style={{ height: topPad, padding: 0, border: 'none' }} />
              </tr>
            )}
            {visibleRows.map((row, i) => {
              const idx = startIdx + i;
              const isSelected = selectedRows.has(row.id);
              const rowBg = isSelected ? '#EFF6FF' : idx % 2 === 0 ? '#F0FFFE' : '#FFFFFF';
              return (
                <tr key={row.id} id={`row-${row.id}`}
                  style={{ background: rowBg, borderBottom: '1px solid #E5E7EB' }}
                  className="group hover:bg-blue-50/60 transition-colors">

                  {/* Checkbox */}
                  <td style={{ width: 40, borderRight: '1px solid #E5E7EB' }} className="px-2 py-0 h-9 text-center">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleRow(row.id)}
                      className="w-3.5 h-3.5 rounded accent-[#1EC9C4] cursor-pointer" />
                  </td>

                  {/* Row number + menu */}
                  <td style={{ width: 40, borderRight: '2px solid #1EC9C4', fontSize: 11, color: '#A1A9B6', textAlign: 'center' }}
                    className="relative px-1 py-0 h-9">
                    <div className="relative flex items-center justify-center h-full">
                      <span className="group-hover:invisible">{idx + 1}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (rowMenu?.id === row.id) { setRowMenu(null); return; }
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          setRowMenu({ id: row.id, rect });
                        }}
                        className="absolute invisible group-hover:visible w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700">⋯</button>
                      {rowMenu?.id === row.id && (
                        <RowMenu
                          anchorRect={rowMenu.rect}
                          onDelete={() => { deleteRow(row.id); setRowMenu(null); }}
                          onDuplicate={() => duplicateRow(row.id)}
                          onImportClient={() => importRowAsClient(row.id)}
                          onClose={() => setRowMenu(null)}
                          canDelete={can('rows.delete')}
                          canDuplicate={can('rows.duplicate')}
                          importedAlready={importedProspectIds.has(row.id)}
                        />
                      )}
                    </div>
                  </td>

                  {/* Data cells */}
                  {displayColumns.map((col) => {
                    const isActive = activeCell?.rowId === row.id && activeCell?.colKey === col.key;
                    const isFilling = fillRange.has(row.id) && fillSrc.current?.colKey === col.key;
                    const cellValue = getCellValue(row, col.key);
                    const projectInfo = col.key === 'projectName' ? prospectToBoard.get(row.id) : null;

                    return (
                      <td
                        key={col.key}
                        data-rowid={row.id}
                        data-colkey={col.key}
                        onClick={() => setActiveCell({ rowId: row.id, colKey: col.key })}
                        style={{
                          height: 36, padding: 0,
                          borderRight: col.key === 'phone' ? '2px solid #1EC9C4' : '1px solid #E5E7EB',
                          verticalAlign: 'middle',
                          outline: isActive ? '2px solid #1EC9C4' : isFilling ? '2px solid #3B82F6' : 'none',
                          outlineOffset: '-2px',
                          background: isFilling ? 'rgba(59,130,246,0.06)' : undefined,
                          position: 'relative',
                        }}>

                        {/* Select cells */}
                        {col.type === 'select' && col.selectKey === 'callingStatus' &&
                          <CallingDropdown value={row.callingStatus} onChange={(v) => updateRow(row.id, 'callingStatus', v)} />}
                        {col.type === 'select' && col.selectKey === 'listingType' &&
                          <ListingDropdown value={row.listingType} onChange={(v) => updateRow(row.id, 'listingType', v)} />}
                        {col.type === 'select' && col.selectKey === 'furnishing' &&
                          <FurnishingDropdown value={row.furnishing} onChange={(v) => updateRow(row.id, 'furnishing', v)} />}
                        {col.type === 'select' && col.selectKey === 'availability' &&
                          <AvailabilityDropdown value={row.availability} onChange={(v) => updateRow(row.id, 'availability', v)} />}

                        {/* Custom-select cells */}
                        {col.type === 'custom-select' && (
                          <CustomSelectCell
                            value={getCellValue(row, col.key)}
                            options={col.options ?? []}
                            onChange={(v) => updateCustom(row.id, col.key, v)}
                          />
                        )}

                        {/* Text cells — double-click to edit */}
                        {col.type === 'text' && (
                          <TextCell
                            value={cellValue}
                            onChange={(v) => setCellValue(row.id, col.key, v)}
                            align={col.align ?? 'left'}
                            mono={col.mono ?? false}
                            placeholder={col.placeholder ?? ''}
                          />
                        )}

                        {/* Project column — folder-aggregate view only */}
                        {col.type === 'readonly' && col.key === 'projectName' && (
                          <div className="w-full h-full flex items-center gap-2 px-2 py-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: projectInfo?.color ?? '#D1D5DB' }} />
                            <span className="text-xs truncate font-medium" style={{ color: '#374151' }}>
                              {projectInfo?.name ?? '—'}
                            </span>
                          </div>
                        )}

                        {/* Agent column — preset dropdown with custom name + color */}
                        {col.key === 'agent' && (
                          <AgentDropdown
                            value={row.agent}
                            presets={agentPresets}
                            canManage={can('agents.manage')}
                            onChange={(v) => updateRow(row.id, 'agent', v)}
                            onAddPreset={addAgentPreset}
                            onRemovePreset={removeAgentPreset}
                          />
                        )}

                        {/* Read-only cells (e.g. Last Update timestamp) */}
                        {col.type === 'readonly' && col.key !== 'projectName' && col.key !== 'agent' && (
                          <div className="w-full h-full flex items-center px-2 py-1">
                            <span className="text-xs truncate" style={{
                              fontFamily: col.mono ? 'JetBrains Mono, monospace' : undefined,
                              color: cellValue ? '#6B7280' : '#D1D5DB',
                            }}>
                              {cellValue || '—'}
                            </span>
                          </div>
                        )}

                        {/* Fill handle dot — bottom-right corner of active cell */}
                        {isActive && (col.type === 'text') && (
                          <div
                            onMouseDown={(e) => onFillHandleMouseDown(e, row.id, col.key)}
                            style={{
                              position: 'absolute', bottom: -4, right: -4,
                              width: 8, height: 8, borderRadius: '50%',
                              background: '#1EC9C4', border: '1.5px solid white',
                              cursor: 'crosshair', zIndex: 20,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }}
                            title="Drag to fill down"
                          />
                        )}
                      </td>
                    );
                  })}

                  <td style={{ borderLeft: '1px solid #E5E7EB' }} />
                </tr>
              );
            })}
            {bottomPad > 0 && (
              <tr aria-hidden="true">
                <td colSpan={spacerColSpan} style={{ height: bottomPad, padding: 0, border: 'none' }} />
              </tr>
            )}

            {/* Add row footer — gated by rows.create */}
            {can('rows.create') && (
              <tr style={{ borderBottom: '1px solid #E5E7EB', background: '#FFFFFF' }}>
                <td colSpan={displayColumns.length + 3}>
                  <button onClick={addRow}
                    className="flex items-center gap-1.5 w-full px-6 py-2 text-xs text-gray-400 hover:text-[#1EC9C4] hover:bg-[#F0FFFE] transition-colors">
                    <Plus size={13} /> Add row
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#F3F4F6' }}>
              <Search size={20} style={{ color: '#D1D5DB' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: '#6B7280' }}>No records found</p>
            <p className="text-xs" style={{ color: '#A1A9B6' }}>Try adjusting your search or filters</p>
          </div>
        )}
      </div>
        );
      })()}

      {/* ── Status bar (grid only) ────────────────────────────────── */}
      {view === 'grid' && (
        <div className="flex items-center gap-4 px-4 py-1.5 border-t flex-shrink-0" style={{ background: '#F8FAFB', borderColor: '#E5E7EB' }}>
          <span className="text-xs" style={{ color: '#A1A9B6' }}>{rows.length} rows total</span>
          {selectedRows.size > 0 && <span className="text-xs" style={{ color: '#1EC9C4' }}>{selectedRows.size} selected</span>}
          {quickView !== 'All' && <span className="text-xs" style={{ color: '#A1A9B6' }}>Viewing: <strong>{quickView}</strong></span>}
          <span className="text-xs ml-auto flex items-center gap-3" style={{ color: '#A1A9B6' }}>
            <span>Click to edit · Drag <span style={{ color: '#1EC9C4' }}>●</span> to fill</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono border" style={{ background: '#F3F4F6', borderColor: '#D1D5DB', color: '#6B7280' }}>Space</kbd>
              <span>+ drag to pan</span>
            </span>
          </span>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────── */}
      {showImport   && <ImportModal   onClose={() => setShowImport(false)}   onImport={handleImport} />}
      {showExport   && (
        <ExportModal
          rowCount={filtered.length}
          onClose={() => setShowExport(false)}
          onExport={(format) => {
            if (format === 'csv') exportCsv();
            else exportXlsx();
          }}
        />
      )}
      {showAddField && <AddFieldModal onClose={() => setShowAddField(false)} onAdd={addCustomField} />}
      {showNewBoard && <NewBoardModal onClose={() => setShowNewBoard(false)} onCreate={createBoard} />}
      {manageBoardId && (() => {
        const b = boards.find((x) => x.id === manageBoardId);
        if (!b) return null;
        return (
          <ManageBoardModal
            board={b}
            ownerName={b.ownerName}
            ownerEmail={b.ownerEmail}
            members={boardMembers[b.id] ?? []}
            onClose={() => setManageBoardId(null)}
            onSave={(patch) => updateBoard(b.id, patch)}
            onInvite={(email) => inviteBoardMember(b.id, email)}
            onRemoveMember={(memberId) => removeBoardMember(b.id, memberId)}
            onDelete={() => {
              deleteBoard(b.id);
              setBoardProspects((prev) => { const { [b.id]: _drop, ...rest } = prev; return rest; });
              setBoardMembers((prev) => { const { [b.id]: _drop, ...rest } = prev; return rest; });
              setManageBoardId(null);
            }}
          />
        );
      })()}

      {manageFolderId && (() => {
        const f = folders.find((x) => x.id === manageFolderId);
        if (!f) return null;
        return (
          <ManageFolderModal
            folder={f}
            ownerEmail={f.ownerEmail}
            ownerName={f.ownerName ?? f.ownerEmail.split('@')[0]}
            members={folderMembers[f.id] ?? []}
            boardCount={boards.filter((b) => b.folderId === f.id).length}
            canRename={can('folders.edit')}
            canInvite={can('folders.invite_members')}
            canRemoveMembers={can('folders.remove_members')}
            canDelete={can('folders.delete')}
            onClose={() => setManageFolderId(null)}
            onRename={(name) => renameFolder(f.id, name)}
            onInvite={(email) => inviteFolderMember(f.id, email)}
            onRemoveMember={(memberId) => removeFolderMember(f.id, memberId)}
            onDelete={() => { deleteFolder(f.id); setManageFolderId(null); }}
          />
        );
      })()}

      {showRecycleBin && (
        <RecycleBinModal
          items={recycleBin}
          canRestore={can('recycle.restore')}
          canPurge={can('recycle.purge')}
          onRestore={restoreFromBin}
          onPurge={purgeFromBin}
          onEmpty={emptyBin}
          onClose={() => setShowRecycleBin(false)}
        />
      )}

      {/* Import-to-Clients toast — auto-dismisses */}
      {importToast && (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 bg-white rounded-xl border px-4 py-3 shadow-xl"
          style={{ borderColor: '#D1F2EF', boxShadow: '0 12px 32px rgba(0,0,0,0.16)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: '#DAF3F2' }}>
            <UserPlus size={14} style={{ color: '#0F766E' }} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold" style={{ color: '#1A202C' }}>
              {importToast.created ? 'Imported to Clients' : 'Synced to existing Client'}
            </p>
            <p className="text-[10px] truncate" style={{ color: '#6B7280' }}>{importToast.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}
