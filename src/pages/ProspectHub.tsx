import { useState, useRef, useEffect, useCallback, MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  Plus, Search, Filter, Download, Upload, ChevronDown, X, Check, Trash2, Copy,
  AlertCircle, CheckCircle2, Loader2, LayoutGrid, Table2, ArrowLeft, Users, CheckCheck,
  GripVertical, Settings2,
} from 'lucide-react';

// ─── Board types ──────────────────────────────────────────────────────────────
interface Board {
  id: string;
  name: string;
  location: string;
  color: string;
}

const BOARD_COLORS = [
  '#F97316','#1EC9C4','#8B5CF6','#EF4444','#22C55E','#F59E0B',
  '#3B82F6','#EC4899','#7C3AED','#06B6D4',
];


const INITIAL_BOARDS: Board[] = [
  { id: 'board_1', name: 'Millerz Square',   location: 'Old Klang Road',      color: '#F97316' },
  { id: 'board_2', name: 'AKASA',            location: 'Cheras',              color: '#1EC9C4' },
  { id: 'board_3', name: 'The Rainz',        location: 'Bukit Jalil',         color: '#8B5CF6' },
  { id: 'board_4', name: 'Nidoz Residence',  location: 'Desa Petaling',       color: '#EF4444' },
  { id: 'board_5', name: "D'Nuri",           location: 'Desa Petaling',       color: '#22C55E' },
  { id: 'board_6', name: 'Solaris Parq',     location: 'Old Klang Road',      color: '#F59E0B' },
];

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
            <div className="flex flex-nowrap items-center gap-1.5">
              {BOARD_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-6 h-6 shrink-0 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ background: c, boxShadow: color === c && BOARD_COLORS.includes(color) ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none' }}>
                  {color === c && BOARD_COLORS.includes(color) && <Check size={11} className="text-white" strokeWidth={3} />}
                </button>
              ))}

              {/* Custom color swatch */}
              <label
                className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 relative overflow-hidden"
                title="Custom colour"
                style={{
                  background: !BOARD_COLORS.includes(color)
                    ? color
                    : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                  boxShadow: !BOARD_COLORS.includes(color) ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none',
                }}>
                {!BOARD_COLORS.includes(color) && (
                  <Check size={11} className="text-white drop-shadow" strokeWidth={3} style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.6))' }} />
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

// ─── Manage Boards Modal ────────────────────────────────────────────────────────
function ManageBoardsModal({ boards, onClose, onReorder, onDelete }: {
  boards: Board[];
  onClose: () => void;
  onReorder: (boards: Board[]) => void;
  onDelete: (id: string) => void;
}) {
  const [list, setList]           = useState<Board[]>(boards);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const onDragStart = (i: number) => { dragIndex.current = i; };
  const onDragEnter = (i: number) => {
    dragOverIndex.current = i;
    if (dragIndex.current === null || dragIndex.current === i) return;
    const next = [...list];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(i, 0, moved);
    dragIndex.current = i;
    setList(next);
  };
  const onDragEnd = () => {
    onReorder(list);
    dragIndex.current = null;
    dragOverIndex.current = null;
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    setList((prev) => prev.filter((b) => b.id !== id));
    setDeleteConfirm(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>Manage Boards</h3>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Drag to reorder · click trash to delete</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        {/* Board list */}
        <div className="overflow-y-auto px-4 py-3 space-y-2" style={{ maxHeight: 'calc(80vh - 130px)' }}>
          {list.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: '#9CA3AF' }}>No boards yet</p>
          )}
          {list.map((board, i) => (
            <div
              key={board.id}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragEnter={() => onDragEnter(i)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all select-none"
              style={{ background: '#FAFAFA', borderColor: '#E5E7EB', cursor: 'grab' }}>

              {/* Drag handle */}
              <GripVertical size={15} className="text-gray-300 flex-shrink-0" />

              {/* Colour dot */}
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: board.color }} />

              {/* Name + location */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#2B3340' }}>{board.name}</p>
                {board.location && <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{board.location}</p>}
              </div>

              {/* Position badge */}
              <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#F3F4F6', color: '#9CA3AF' }}>{i + 1}</span>

              {/* Delete */}
              {deleteConfirm === board.id ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs" style={{ color: '#EF4444' }}>Delete?</span>
                  <button onClick={() => handleDelete(board.id)}
                    className="px-2 py-0.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: '#EF4444' }}>Yes</button>
                  <button onClick={() => setDeleteConfirm(null)}
                    className="px-2 py-0.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">No</button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(board.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                  <Trash2 size={14} className="text-gray-300 hover:text-red-400" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          <button onClick={onClose}
            className="px-5 py-1.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ background: '#1EC9C4' }}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── Board Card ───────────────────────────────────────────────────────────────
function BoardCard({ board, prospects, onOpen }: {
  board: Board;
  prospects: Prospect[];
  onOpen: () => void;
}) {
  const total     = prospects.length;
  const available = prospects.filter((p) => p.availability === 'Available').length;
  const positive  = prospects.filter((p) => p.callingStatus === 'Positive').length;
  const pct       = total > 0 ? Math.round((available / total) * 100) : 0;

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: 'white', border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      {/* Coloured header band */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-1" style={{ background: board.color }}>
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-white opacity-70">{board.location}</span>
          <button onClick={onOpen} title="Open grid view"
            className="p-1 rounded-lg transition-colors hover:bg-white/20">
            <Table2 size={13} className="text-white" />
          </button>
        </div>
        <p className="text-base font-bold text-white leading-snug">{board.name}</p>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: '#F3F4F6' }}>
          <Users size={11} style={{ color: '#6B7280' }} />
          <span className="text-xs font-semibold" style={{ color: '#374151' }}>{total}</span>
          <span className="text-xs" style={{ color: '#9CA3AF' }}>prospects</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: '#ECFDF5' }}>
          <CheckCheck size={11} style={{ color: '#16A34A' }} />
          <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>{available}</span>
          <span className="text-xs" style={{ color: '#6EE7B7' }}>avail.</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: '#DCFCE7' }}>
          <Plus size={11} style={{ color: '#15803D' }} strokeWidth={2.5} />
          <span className="text-xs font-semibold" style={{ color: '#15803D' }}>{positive}</span>
          <span className="text-xs" style={{ color: '#86EFAC' }}>+ve</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3 flex flex-col gap-1">
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: board.color }} />
        </div>
        <p className="text-xs" style={{ color: '#9CA3AF' }}>{pct}% available</p>
      </div>

      {/* Open link */}
      <div className="px-4 pb-4 mt-auto">
        <button onClick={onOpen}
          className="text-xs font-medium flex items-center gap-1 hover:gap-2 transition-all"
          style={{ color: board.color }}>
          Open Grid View <span>→</span>
        </button>
      </div>
    </div>
  );
}

// ─── Board Overview ───────────────────────────────────────────────────────────
function BoardOverview({ boards, boardProspects, onOpenBoard, onAddBoard, totalAll }: {
  boards: Board[];
  boardProspects: Record<string, Prospect[]>;
  onOpenBoard: (board: Board) => void;
  onAddBoard: () => void;
  totalAll: number;
}) {
  return (
    <div className="flex-1 overflow-auto px-4 py-4">
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {boards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            prospects={boardProspects[board.id] ?? []}
            onOpen={() => onOpenBoard(board)}
          />
        ))}

        {/* + Add Project Board */}
        <button onClick={onAddBoard}
          className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 min-h-[180px] transition-all hover:border-[#1EC9C4] hover:bg-[#F0FFFE] group"
          style={{ borderColor: '#D1D5DB' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ background: '#F3F4F6' }}>
            <Plus size={20} className="text-gray-400 group-hover:text-[#1EC9C4] transition-colors" />
          </div>
          <span className="text-xs font-medium text-gray-400 group-hover:text-[#1EC9C4] transition-colors">Add Project Board</span>
        </button>
      </div>
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
  Rent:          { bg: '#FFEDD5', text: '#EA580C' },
  Sale:          { bg: '#F3F4F6', text: '#374151' },
  'Rent & Sale': { bg: '#EDE9FE', text: '#7C3AED' },
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

// ─── Select options ───────────────────────────────────────────────────────────
const CALLING_OPTIONS: CallingStatus[] = ['Positive', 'Negative', 'Neutral', ''];
const LISTING_OPTIONS: ListingType[]   = ['Rent', 'Sale', 'Rent & Sale', ''];
const FURNISHING_OPTIONS: Furnishing[] = ['Fully Furnished', 'Partly Furnished', 'Bare Unit', ''];
const AVAILABILITY_OPTIONS: Availability[] = ['Available', 'NOT Available', ''];

// ─── Quick view tabs ──────────────────────────────────────────────────────────
type QuickView = 'All' | 'Positive' | 'Neutral' | 'Negative';

const QUICK_VIEWS: { label: QuickView; color: string; activeBg: string; activeText: string; dot: string }[] = [
  { label: 'All',      color: '#6B7280', activeBg: '#F3F4F6',  activeText: '#374151', dot: '#9CA3AF' },
  { label: 'Positive', color: '#16A34A', activeBg: '#DCFCE7',  activeText: '#16A34A', dot: '#22C55E' },
  { label: 'Neutral',  color: '#CA8A04', activeBg: '#FEF9C3',  activeText: '#CA8A04', dot: '#EAB308' },
  { label: 'Negative', color: '#DC2626', activeBg: '#FEE2E2',  activeText: '#DC2626', dot: '#EF4444' },
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
        name: '', unitNo: '', type: '', size: '', phone: '',
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

// ─── Typed wrappers ───────────────────────────────────────────────────────────
function CallingDropdown({ value, onChange }: { value: CallingStatus; onChange: (v: CallingStatus) => void }) {
  return <DropdownCell value={value} options={CALLING_OPTIONS} styleMap={CALLING_STATUS_STYLE} onChange={onChange} />;
}
function ListingDropdown({ value, onChange }: { value: ListingType; onChange: (v: ListingType) => void }) {
  return <DropdownCell value={value} options={LISTING_OPTIONS} styleMap={LISTING_TYPE_STYLE} onChange={onChange} />;
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
function RowMenu({ onDelete, onDuplicate, onClose }: { onDelete: () => void; onDuplicate: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute z-50 right-0 top-full mt-0.5 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-40" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
      <button onClick={onDuplicate} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"><Copy size={13} /> Duplicate row</button>
      <button onClick={onDelete} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"><Trash2 size={13} /> Delete row</button>
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────
interface Filters { callingStatus: CallingStatus | 'All'; listingType: ListingType | 'All'; availability: Availability | 'All'; }

function FilterBar({ filters, setFilters, onClose }: { filters: Filters; setFilters: React.Dispatch<React.SetStateAction<Filters>>; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-[#FAFBFC] flex-wrap">
      <span className="text-xs font-semibold text-gray-500">Filters:</span>
      {[
        { label: 'Calling Status', key: 'callingStatus' as const, opts: CALLING_OPTIONS },
        { label: 'Listing Type',   key: 'listingType'   as const, opts: LISTING_OPTIONS },
        { label: 'Availability',   key: 'availability'  as const, opts: AVAILABILITY_OPTIONS },
      ].map(({ label, key, opts }) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">{label}</span>
          <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#1EC9C4]"
            value={filters[key]} onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}>
            <option value="All">All</option>
            {opts.filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      ))}
      <button onClick={() => setFilters({ callingStatus: 'All', listingType: 'All', availability: 'All' })} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><X size={12} /> Clear</button>
      <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
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
type ColType = 'text' | 'select' | 'custom-select';
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
function HeaderCell({ col, onRename, onDelete }: {
  col: ColDef;
  onRename: (key: string, label: string) => void;
  onDelete: (key: string) => void;
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
        onDoubleClick={() => !col.fixed && setEditing(true)}
        className="truncate flex-1"
        title={col.fixed ? col.label : 'Double-click to rename'}
        style={{ cursor: col.fixed ? 'default' : 'text' }}
      >{col.label}</span>

      {/* ⋯ button — custom columns only */}
      {!col.fixed && (
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
          <button
            onClick={() => { setMenuOpen(false); setEditing(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
          >
            <span style={{ fontSize: 13 }}>✎</span> Rename field
          </button>
          <div style={{ borderTop: '1px solid #F3F4F6', margin: '2px 0' }} />
          <button
            onClick={() => { setMenuOpen(false); onDelete(col.key); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50"
          >
            <Trash2 size={12} /> Delete field
          </button>
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
  // ── Board state ───────────────────────────────────────────────────────────
  const [boards, setBoards] = useState<Board[]>(INITIAL_BOARDS);
  const [view, setView]     = useState<'board' | 'grid'>('board');
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [showNewBoard, setShowNewBoard]         = useState(false);
  const [showManageBoards, setShowManageBoards] = useState(false);

  // Per-board prospect data
  const [boardProspects, setBoardProspects] = useState<Record<string, Prospect[]>>({
    board_1: seedProspects.slice(0, 5),
    board_2: seedProspects.slice(5, 9),
    board_3: seedProspects.slice(9, 13),
    board_4: seedProspects.slice(13, 15),
    board_5: seedProspects.slice(15, 17),
    board_6: seedProspects.slice(17),
  });

  const totalAll = Object.values(boardProspects).reduce((s, arr) => s + arr.length, 0);

  const deleteBoard = (id: string) => {
    setBoards((prev) => prev.filter((b) => b.id !== id));
    if (activeBoard?.id === id) { setActiveBoard(null); setView('board'); }
  };

  const createBoard = (name: string, location: string, color: string) => {
    const newBoard: Board = { id: `board_${Date.now()}`, name, location, color };
    setBoards((prev) => [...prev, newBoard]);
    setBoardProspects((prev) => ({ ...prev, [newBoard.id]: [] }));
  };

  const openBoard = (board: Board) => {
    setActiveBoard(board);
    setView('grid');
  };

  // Current rows depend on which board is open (grid view) or all (board view)
  const rows    = activeBoard ? (boardProspects[activeBoard.id] ?? []) : seedProspects;
  const setRows = (updater: Prospect[] | ((prev: Prospect[]) => Prospect[])) => {
    if (!activeBoard) return;
    setBoardProspects((prev) => ({
      ...prev,
      [activeBoard.id]: typeof updater === 'function' ? updater(prev[activeBoard.id] ?? []) : updater,
    }));
  };

  const [search, setSearch] = useState('');
  const [quickView, setQuickView] = useState<QuickView>('All');
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<Filters>({ callingStatus: 'All', listingType: 'All', availability: 'All' });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
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

  // ── Fill-handle drag state ────────────────────────────────────────────────
  // fillSrc = { rowId, colKey, value } — cell the drag started from
  // fillRange = rowIds that will be filled
  const fillSrc   = useRef<{ rowId: string; colKey: string; value: string } | null>(null);
  const [fillRange, setFillRange] = useState<Set<string>>(new Set());
  const [activeCell, setActiveCell] = useState<{ rowId: string; colKey: string } | null>(null);

  // ── Counts for quick view tabs ────────────────────────────────────────────
  const counts: Record<QuickView, number> = {
    All:      rows.length,
    Positive: rows.filter((r) => r.callingStatus === 'Positive').length,
    Neutral:  rows.filter((r) => r.callingStatus === 'Neutral').length,
    Negative: rows.filter((r) => r.callingStatus === 'Negative').length,
  };

  // ── Filter + search ───────────────────────────────────────────────────────
  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.name.toLowerCase().includes(q) || r.unitNo.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q);
    const matchQuick   = quickView === 'All' || r.callingStatus === quickView;
    const matchCalling = filters.callingStatus === 'All' || r.callingStatus === filters.callingStatus;
    const matchListing = filters.listingType   === 'All' || r.listingType   === filters.listingType;
    const matchAvail   = filters.availability  === 'All' || r.availability  === filters.availability;
    return matchSearch && matchQuick && matchCalling && matchListing && matchAvail;
  });

  // ── Cell value reader (works for both system & custom fields) ────────────
  const getCellValue = (row: Prospect, colKey: string): string => {
    if (colKey in row) return (row as unknown as Record<string, string>)[colKey] ?? '';
    return customValues[row.id]?.[colKey] ?? '';
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateRow = useCallback(<K extends keyof Prospect>(id: string, key: K, value: Prospect[K]) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }, []);

  const updateCustom = useCallback((rowId: string, colKey: string, value: string) => {
    setCustomValues((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] ?? {}), [colKey]: value },
    }));
  }, []);

  const setCellValue = useCallback((rowId: string, colKey: string, value: string) => {
    const isSystemKey = BASE_COLUMNS.some((c) => c.key === colKey);
    if (isSystemKey) {
      updateRow(rowId, colKey as keyof Prospect, value as Prospect[keyof Prospect]);
    } else {
      updateCustom(rowId, colKey, value);
    }
  }, [updateRow, updateCustom]);

  const addRow = () => {
    const newId = String(Date.now());
    setRows((prev) => [...prev, {
      id: newId, name: '', unitNo: '', type: '', size: '', phone: '',
      callingStatus: '', listingType: '', furnishing: '',
      availability: '', askingRent: '', askingPrice: '', remark: '',
    }]);
    setTimeout(() => document.getElementById(`row-${newId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  };

  const deleteRow = (id: string) => {
    setRows((p) => p.filter((r) => r.id !== id));
    setSelectedRows((p) => { const s = new Set(p); s.delete(id); return s; });
    setCustomValues((p) => { const n = { ...p }; delete n[id]; return n; });
  };
  const deleteSelected = () => {
    setRows((p) => p.filter((r) => !selectedRows.has(r.id)));
    setCustomValues((p) => {
      const n = { ...p };
      selectedRows.forEach((id) => delete n[id]);
      return n;
    });
    setSelectedRows(new Set());
  };
  const duplicateRow = (id: string) => {
    const src = rows.find((r) => r.id === id);
    if (!src) return;
    const newId  = String(Date.now());
    const newRow = { ...src, id: newId };
    setRows((prev) => { const idx = prev.findIndex((r) => r.id === id); const next = [...prev]; next.splice(idx + 1, 0, newRow); return next; });
    if (customValues[id]) setCustomValues((p) => ({ ...p, [newId]: { ...p[id] } }));
    setRowMenu(null);
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

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCsv = () => {
    const headers = columns.map((c) => c.label).join(',');
    const body = filtered.map((r) =>
      columns.map((c) => `"${getCellValue(r, c.key).replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[headers, ...body].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'prospect-hub.csv'; a.click();
  };

  // ── Import handler ────────────────────────────────────────────────────────
  const handleImport = (imported: Prospect[], mode: ImportMode) => {
    if (mode === 'replace') setRows(imported);
    else setRows((prev) => [...prev, ...imported]);
    setShowImport(false);
  };

  const totalWidth = columns.reduce((s, c) => s + c.width, 0) + 40 + 40 + 80; // +checkbox +rowNo +addfield

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col" style={{ background: '#F5F7FA' }}>

      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0 flex-wrap">
        {/* Title + breadcrumb */}
        <div className="mr-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold" style={{ color: '#2B3340' }}>Prospect Hub</h2>
            <span className="px-1.5 py-0.5 rounded-md text-xs font-bold text-white" style={{ background: '#1EC9C4' }}>{totalAll}</span>
          </div>
          <p className="text-xs" style={{ color: '#A1A9B6' }}>
            {view === 'board'
              ? 'Board view'
              : (<><button onClick={() => { setView('board'); setActiveBoard(null); }} className="hover:underline" style={{ color: '#1EC9C4' }}>Board view</button> / {activeBoard?.name}</>)
            }
          </p>
        </div>
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 bg-white w-52 focus-within:border-[#1EC9C4] transition-colors flex-shrink-0">
          <Search size={13} style={{ color: '#A1A9B6' }} />
          <input className="flex-1 text-xs outline-none bg-transparent placeholder:text-gray-300" placeholder="Search name, unit, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')}><X size={11} className="text-gray-300 hover:text-gray-500" /></button>}
        </div>
        <button onClick={() => setShowFilter((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex-shrink-0 ${showFilter ? 'border-[#1EC9C4] text-[#1EC9C4] bg-[#DAF3F2]' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}>
          <Filter size={13} /> Filter
          {(filters.callingStatus !== 'All' || filters.listingType !== 'All' || filters.availability !== 'All') && <span className="w-2 h-2 rounded-full bg-[#1EC9C4]" />}
        </button>
        {selectedRows.size > 0 && (
          <button onClick={deleteSelected} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 bg-white transition-colors flex-shrink-0">
            <Trash2 size={13} /> Delete {selectedRows.size}
          </button>
        )}
        <div className="flex-1" />

        {/* Manage Boards button — only in board view */}
        {view === 'board' && (
          <button onClick={() => setShowManageBoards(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-[#1EC9C4] hover:text-[#1EC9C4] bg-white transition-colors flex-shrink-0">
            <Settings2 size={13} /> Manage
          </button>
        )}

        {/* Grid / Board toggle */}
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
          <button onClick={() => { setView('grid'); if (!activeBoard && boards.length > 0) setActiveBoard(boards[0]); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{ background: view === 'grid' ? '#1EC9C4' : 'white', color: view === 'grid' ? 'white' : '#6B7280' }}>
            <Table2 size={13} /> Grid
          </button>
          <button onClick={() => { setView('board'); setActiveBoard(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200"
            style={{ background: view === 'board' ? '#1EC9C4' : 'white', color: view === 'board' ? 'white' : '#6B7280' }}>
            <LayoutGrid size={13} /> Board
          </button>
        </div>

        <button onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-[#1EC9C4] hover:text-[#1EC9C4] bg-white transition-colors flex-shrink-0">
          <Upload size={13} /> Import CSV
        </button>
        <button onClick={exportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-gray-300 bg-white transition-colors flex-shrink-0">
          <Download size={13} /> Export CSV
        </button>

      </div>

      {/* ── Board Overview (board mode) ────────────────────────────── */}
      {view === 'board' && (
        <BoardOverview
          boards={boards}
          boardProspects={boardProspects}
          onOpenBoard={openBoard}
          onAddBoard={() => setShowNewBoard(true)}
          totalAll={totalAll}
        />
      )}

      {/* ── Quick View Tabs (grid mode only) ─────────────────────────── */}
      {view === 'grid' && <div className="flex items-center gap-1 px-4 py-0 bg-white border-b border-gray-100 flex-shrink-0">
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
      {view === 'grid' && showFilter && <FilterBar filters={filters} setFilters={setFilters} onClose={() => setShowFilter(false)} />}

      {/* ── Grid (grid only) ────────────────────────────────────────────── */}
      {view === 'grid' && <div ref={gridScrollRef} className="flex-1 overflow-auto"
        style={{ cursor: isPanning ? 'grabbing' : 'default', userSelect: isPanning ? 'none' : undefined }}>
        <table style={{ minWidth: totalWidth, borderCollapse: 'collapse', tableLayout: 'fixed', width: totalWidth }}>
          <colgroup>
            <col style={{ width: 40 }} />
            <col style={{ width: 40 }} />
            {columns.map((c) => <col key={c.key} style={{ width: c.width }} />)}
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

              {columns.map((col) => (
                <th key={col.key}
                  style={{
                    borderRight: col.key === 'phone' ? '2px solid #1EC9C4' : '1px solid #E5E7EB',
                    fontWeight: 600, fontSize: 11, color: '#6B7280',
                    padding: '6px 8px', whiteSpace: 'nowrap',
                  }}>
                  <HeaderCell col={col} onRename={renameColumn} onDelete={deleteColumn} />
                </th>
              ))}

              {/* Add Field button */}
              <th style={{ borderLeft: '1px solid #E5E7EB', width: 80 }} className="px-2 py-2.5">
                <button
                  onClick={() => setShowAddField(true)}
                  className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border border-dashed transition-colors hover:border-[#1EC9C4] hover:text-[#1EC9C4] hover:bg-[#F0FFFE]"
                  style={{ borderColor: '#D1D5DB', color: '#9CA3AF' }}>
                  <Plus size={11} strokeWidth={2.5} /> Field
                </button>
              </th>
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {filtered.map((row, idx) => {
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
                        onClick={(e) => { e.stopPropagation(); setRowMenu(rowMenu === row.id ? null : row.id); }}
                        className="absolute invisible group-hover:visible w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700">⋯</button>
                      {rowMenu === row.id && (
                        <RowMenu
                          onDelete={() => { deleteRow(row.id); setRowMenu(null); }}
                          onDuplicate={() => duplicateRow(row.id)}
                          onClose={() => setRowMenu(null)}
                        />
                      )}
                    </div>
                  </td>

                  {/* Data cells */}
                  {columns.map((col) => {
                    const isActive = activeCell?.rowId === row.id && activeCell?.colKey === col.key;
                    const isFilling = fillRange.has(row.id) && fillSrc.current?.colKey === col.key;
                    const cellValue = getCellValue(row, col.key);

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

            {/* Add row footer */}
            <tr style={{ borderBottom: '1px solid #E5E7EB', background: '#FFFFFF' }}>
              <td colSpan={columns.length + 3}>
                <button onClick={addRow}
                  className="flex items-center gap-1.5 w-full px-6 py-2 text-xs text-gray-400 hover:text-[#1EC9C4] hover:bg-[#F0FFFE] transition-colors">
                  <Plus size={13} /> Add row
                </button>
              </td>
            </tr>
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
      </div>}

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
      {showAddField && <AddFieldModal onClose={() => setShowAddField(false)} onAdd={addCustomField} />}
      {showNewBoard && <NewBoardModal onClose={() => setShowNewBoard(false)} onCreate={createBoard} />}
      {showManageBoards && (
        <ManageBoardsModal
          boards={boards}
          onClose={() => setShowManageBoards(false)}
          onReorder={setBoards}
          onDelete={deleteBoard}
        />
      )}
    </div>
  );
}
