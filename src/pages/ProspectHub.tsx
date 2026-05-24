import { useState, useRef, useEffect, useMemo, MutableRefObject, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx-js-style';
import {
  Plus, Search, Filter, Download, Upload, ChevronDown, ChevronLeft, ChevronRight, X, Check, Trash2, Copy,
  AlertCircle, CheckCircle2, Loader2, Users, UserPlus,
  GripVertical, Settings2, Mail, Folder as FolderIcon, FolderPlus, Layers,
  FileText, FileSpreadsheet, Eye, Target,
  Lock, Unlock, MessageSquare, Pencil,
} from 'lucide-react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { getCurrentUser, listAllUsers, getAvatarColor, getAvatarImage, getUserTier, useAuthStore } from '@/lib/auth';
import { importFromProspect, listClients, type Client } from '@/api/clients';
import { supabase } from '@/lib/supabase';

// Supabase API modules — every CRM mutation goes through here so changes
// persist across devices and the rest of the team picks them up via realtime.
import * as boardsApi    from '@/api/boards';
import * as prospectsApi from '@/api/prospects';
import * as foldersApi   from '@/api/folders';
import * as membersApi   from '@/api/members';
import * as agentsApi    from '@/api/agent-presets';
import * as recycleApi   from '@/api/recycle-bin';
import * as prefsApi     from '@/api/user_preferences';
import type { WaLang, WaTemplate } from '@/api/user_preferences';
import type { Json } from '@/types/database';
import { notifySuccess, notifyError } from '@/lib/notify';
import { confirm } from '@/components/ConfirmDialog';

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


// (SEED_BOARDS_TEMPLATE removed — first-time bootstrap is now handled by
// the live empty state, not a hard-coded six-board seed.)

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

// (Legacy localStorage `we.crm.state` blob is gone — every CRM mutation now
// goes through `@/api/*` and Supabase handles persistence + realtime fanout.)

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

// ─── WhatsApp helpers ───────────────────────────────────────────────────────
// Phone cells can hold multiple numbers separated by '/', and inputs vary
// wildly (with/without country code, hyphens, spaces). Convert to the bare
// international format wa.me expects: digits-only, leading '0' replaced with
// Malaysia's '60'. Defaults to MY country code when one isn't supplied.
function normalisePhonesForWhatsApp(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[/,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const digits = s.replace(/\D/g, '');
      if (!digits) return '';
      if (digits.startsWith('60')) return digits;
      if (digits.startsWith('0'))  return '60' + digits.slice(1);
      // No leading country code or 0 — assume MY mobile (e.g. "127879945").
      return '60' + digits;
    })
    .filter(Boolean);
}

// Small green WhatsApp glyph (lucide doesn't include the brand mark).
function WhatsAppIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.2-.7.2s-.8.9-1 1.1c-.2.2-.4.2-.7.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.6.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1.1 1.1-1.1 2.6c0 1.6 1.1 3 1.3 3.3.2.3 2.2 3.4 5.4 4.7.7.3 1.3.5 1.8.6.8.2 1.5.2 2 .1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.2-.3-.3-.6-.5zM12 2C6.5 2 2 6.5 2 12c0 1.7.5 3.4 1.3 4.8L2 22l5.4-1.3c1.4.7 2.9 1.1 4.6 1.1 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.5 0-2.9-.4-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3c-.8-1.3-1.2-2.8-1.2-4.3 0-4.6 3.7-8.3 8.3-8.3s8.3 3.7 8.3 8.3-3.7 8.3-8.3 8.3z"/>
    </svg>
  );
}

// ─── WhatsApp templates ────────────────────────────────────────────────────
// Templates persist per-user in Supabase (`user_preferences.wa_templates`)
// so each agent's library follows them across devices. Body can use {key}
// tokens (any Prospect field, plus derived helpers like {agent} /
// {first_name}) — see `WA_TOKENS` below for the menu shown in the editor.
// `WaLang` / `WaTemplate` are imported from `@/api/user_preferences`.

// Factory defaults used when the user's saved library is empty (first use).
const DEFAULT_WA_TEMPLATES: WaTemplate[] = [
  {
    id: 'initial', lang: 'en',
    label: 'Initial outreach',
    body:
      `Hi {first_name}, thank you for speaking with me earlier.\n\n` +
      `I'm {agent}, I would be happy to assist you in marketing your property professionally, maximizing listing exposure, and matching it with qualified tenants/buyers. We can also provide professional photoshooting and 3D walkthrough FOC to help present your property better.\n\n` +
      `May I have the property details, asking price/rental, current condition, availability date, and your preferred viewing arrangement?`,
  },
  {
    id: 'followup', lang: 'en',
    label: 'Follow up',
    body:
      `Hi {first_name}, just following up on our previous chat about your property at {unitNo}.\n\n` +
      `Are you still open to listing it? Happy to share market comparables and discuss next steps whenever it suits you.`,
  },
];

// Token catalog shown in the template editor. Each entry: { token, label,
// resolver }. Resolver receives the row + agent and returns the substituted
// string. Order = order in the editor's "Insert column" picker.
interface WaTokenDef { token: string; label: string; resolve: (ctx: WaTokenCtx) => string }
interface WaTokenCtx { row: Prospect; agentName: string; boardName?: string }

const WA_TOKENS: WaTokenDef[] = [
  { token: '{name}',          label: 'Full name',         resolve: (c) => c.row.name },
  { token: '{first_name}',    label: 'First name',        resolve: (c) => firstName(c.row.name, 'there') },
  { token: '{phone}',         label: 'Phone',             resolve: (c) => c.row.phone },
  { token: '{boardName}',     label: 'Board name',        resolve: (c) => c.boardName ?? '' },
  { token: '{unitNo}',        label: 'Unit No',           resolve: (c) => c.row.unitNo },
  { token: '{type}',          label: 'Type',              resolve: (c) => c.row.type },
  { token: '{size}',          label: 'Size (sqft)',       resolve: (c) => c.row.size },
  { token: '{askingRent}',    label: 'Asking Rent',       resolve: (c) => c.row.askingRent },
  { token: '{askingPrice}',   label: 'Asking Price',      resolve: (c) => c.row.askingPrice },
  { token: '{callingStatus}', label: 'Calling Status',    resolve: (c) => c.row.callingStatus },
  { token: '{listingType}',   label: 'Listing Type',      resolve: (c) => c.row.listingType },
  { token: '{furnishing}',    label: 'Condition',         resolve: (c) => c.row.furnishing },
  { token: '{availability}',  label: 'Availability',      resolve: (c) => c.row.availability },
  { token: '{unitStatus}',    label: 'Unit Status',       resolve: (c) => c.row.unitStatus },
  { token: '{remark}',        label: 'Remark',            resolve: (c) => c.row.remark },
  { token: '{agent}',         label: "Agent's first name", resolve: (c) => firstName(c.agentName, 'me') },
  { token: '{agent_full}',    label: "Agent's full name", resolve: (c) => c.agentName || '' },
];

function fillTemplate(body: string, ctx: WaTokenCtx): string {
  let out = body;
  for (const t of WA_TOKENS) {
    if (!out.includes(t.token)) continue;
    // Escape regex special characters in the token before building the regex.
    const safe = t.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(safe, 'g'), t.resolve(ctx) ?? '');
  }
  return out;
}
function firstName(full: string | undefined, fallback: string): string {
  const n = (full ?? '').trim().split(/[\s/]+/)[0];
  return n || fallback;
}

// ─── WhatsApp button ───────────────────────────────────────────────────────
// Click-triggered popup that lets the agent pick a template (or write a
// custom message) and — when the row has multiple numbers — choose which
// contact to message. The popup is portaled to <body> with `position: fixed`
// so it can never be clipped by the scrollable table or hidden behind the
// next row's sticky cells.
function WhatsAppButton({ row, agentName, boardName, templates, lang, onLangChange, onOpenChange, onManageTemplates }: {
  row: Prospect;
  agentName: string;
  boardName?: string;
  templates: WaTemplate[];
  lang: WaLang;
  onLangChange: (next: WaLang) => void;
  onOpenChange?: (open: boolean) => void;
  onManageTemplates?: () => void;
}) {
  const phone = row.phone;
  const numbers = normalisePhonesForWhatsApp(phone);
  // Pair each normalised number with the original token so the picker can
  // show the user-readable formatting they typed in (e.g. "012-2878545").
  const original = phone.split(/[/,;]/).map((s) => s.trim()).filter(Boolean);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [pickedNum, setPickedNum] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Bubble open/close to the parent so the host cell can keep the button
  // visible while the popup is up (otherwise the hover-gated wrapper hides
  // the click target the moment the cursor moves to the popup).
  useEffect(() => { onOpenChange?.(!!anchor); }, [anchor, onOpenChange]);

  // Close on outside click — covers both the button's host cell AND the
  // portaled popup, since either can be the click origin.
  useEffect(() => {
    if (!anchor) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (popupRef.current?.contains(t)) return;
      setAnchor(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [anchor]);

  if (numbers.length === 0) return null;

  // Pair names with phone numbers by position so "Linux Lin / Thomas Foo"
  // alongside "012-1111 / 016-2222" sends the second template to Thomas
  // when the user picks the second number. Falls back to the first name
  // when the lists don't align.
  const names = row.name.split(/[/]/).map((s) => s.trim()).filter(Boolean);
  const idx = Math.min(pickedNum, numbers.length - 1);
  const pickedName  = names[idx] ?? names[0] ?? row.name;
  const pickedPhone = original[idx] ?? row.phone;
  // Substitute the row's name + phone with the picked-contact's slice so
  // {name}, {first_name}, and {phone} all reflect who's actually being messaged.
  const ctxRow: Prospect = { ...row, name: pickedName, phone: pickedPhone };
  const ctx: WaTokenCtx = { row: ctxRow, agentName, boardName };
  const targetNumber = numbers[idx];
  const buildHref = (msg: string) => `https://wa.me/${targetNumber}?text=${encodeURIComponent(msg)}`;
  const openPopup = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor(anchor ? null : rect);   // toggle
  };

  // Position the portaled popup directly under the button, flipping it up
  // when there isn't enough space below, and clamping into the viewport.
  let pos: { top: number; left: number } | null = null;
  if (anchor) {
    const POPUP_W = 280;
    const POPUP_H = 240;
    const spaceBelow = window.innerHeight - anchor.bottom;
    const top = spaceBelow < POPUP_H + 8
      ? Math.max(8, anchor.top - POPUP_H - 4)
      : anchor.bottom + 4;
    const left = Math.min(window.innerWidth - POPUP_W - 8, Math.max(8, anchor.right - POPUP_W));
    pos = { top, left };
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={openPopup}
        title="WhatsApp"
        className="flex items-center justify-center w-5 h-5 rounded text-white hover:opacity-90 flex-shrink-0"
        style={{ background: '#25D366' }}>
        <WhatsAppIcon size={11} />
      </button>

      {anchor && pos && createPortal(
        <div ref={popupRef}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, width: 280,
            zIndex: 9999, background: 'white', borderRadius: 8,
            border: '1px solid #F3F4F6', boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
          }}>

          {/* Number picker — only shown when there's more than one contact. */}
          {numbers.length > 1 && (
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>
                Send to
              </p>
              <div className="flex flex-wrap gap-1">
                {numbers.map((n, i) => {
                  const active = i === pickedNum;
                  return (
                    <button key={i} onClick={() => setPickedNum(i)}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md border transition-colors"
                      style={{
                        borderColor: active ? '#25D366' : '#E5E7EB',
                        background:  active ? '#DCFCE7' : 'white',
                        color:       active ? '#15803D' : '#374151',
                      }}>
                      {original[i] ?? n}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Language toggle — filters the template list to only show
              templates tagged with the picked language. Preference is
              persisted per-user in Supabase (user_preferences.wa_lang). */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
              Pick a message
            </span>
            <div className="inline-flex items-stretch rounded-md overflow-hidden border" style={{ borderColor: '#E5E7EB' }}>
              {(['en', 'zh'] as WaLang[]).map((L) => {
                const active = lang === L;
                return (
                  <button key={L}
                    onClick={() => onLangChange(L)}
                    className="px-1.5 py-0.5 text-[10px] font-bold transition-colors"
                    style={{
                      background: active ? '#1EC9C4' : 'white',
                      color:      active ? 'white'   : '#6B7280',
                    }}>
                    {L === 'en' ? 'EN' : '中'}
                  </button>
                );
              })}
            </div>
          </div>
          {(() => {
            const visible = templates.filter((t) => t.lang === lang);
            if (visible.length === 0) {
              return (
                <p className="px-3 py-3 text-xs text-gray-400">
                  No {lang === 'zh' ? '中文' : 'English'} templates yet — use Manage below to add one.
                </p>
              );
            }
            return visible.map((t) => (
              <a key={t.id}
                href={buildHref(fillTemplate(t.body, ctx))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAnchor(null)}
                className="block px-3 py-2 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: '#25D366', color: 'white' }}>
                    <WhatsAppIcon size={9} />
                  </span>
                  <span className="text-xs font-semibold" style={{ color: '#1A202C' }}>{t.label}</span>
                </div>
                <p className="text-[10px] mt-1 ml-6 line-clamp-2" style={{ color: '#6B7280' }}>
                  {fillTemplate(t.body, ctx).split('\n')[0]}
                </p>
              </a>
            ));
          })()}
          {onManageTemplates && (
            <button onClick={() => { setAnchor(null); onManageTemplates(); }}
              className="w-full text-left px-3 py-2 border-t border-gray-100 text-xs font-semibold hover:bg-gray-50 transition-colors flex items-center gap-1.5"
              style={{ color: '#6B7280' }}>
              <Settings2 size={11} /> Manage templates…
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

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
    valid: '',
    listingType: listingPick,
    furnishing,
    availability,
    unitStatus: '',
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
  // Returns a Promise so the modal can wait + surface errors instead of
  // closing optimistically. The parent is responsible for actually awaiting
  // the DB write — see createBoard in PaginatedProspectHub.
  onCreate: (name: string, location: string, color: string) => Promise<void>;
}) {
  const [name, setName]         = useState('');
  const [location, setLocation] = useState('');
  const [color, setColor]       = useState(BOARD_COLORS[0]);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const initials = name.trim()
    ? name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
    : 'BD';

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim(), location.trim(), color);
      onClose();
    } catch (e) {
      // Keep the modal open so the user sees what went wrong instead of
      // having a toast flash and disappear off the bottom of the screen.
      setError(e instanceof Error ? e.message : 'Could not create board');
    } finally {
      setBusy(false);
    }
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

        {error && (
          <div className="mx-6 mb-2 px-3 py-2 rounded-lg text-xs flex items-start gap-2"
            style={{ background: '#FEE2E2', color: '#991B1B' }}>
            <span className="flex-1 min-w-0 break-words">{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          <button onClick={onClose} disabled={busy}
            className="px-4 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
            Cancel
          </button>
          <button onClick={submit} disabled={!name.trim() || busy}
            className="px-5 py-1.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: color }}>
            {busy ? 'Creating…' : 'Create Board'}
          </button>
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

// ─── WhatsApp Message Templates settings ────────────────────────────────────
// Per-user template library backed by Supabase (user_preferences.wa_templates).
// Lets the agent edit the shipped templates (Initial outreach / Follow up),
// add new ones, and insert column tokens like {first_name} or {askingRent}
// so the message auto-fills with the row's data when sent.
function WaTemplatesModal({ initial, onSave, onClose }: {
  initial: WaTemplate[];
  onSave: (next: WaTemplate[]) => void;
  onClose: () => void;
}) {
  // Working copy so Cancel can discard. Save commits.
  const [drafts, setDrafts] = useState<WaTemplate[]>(() => initial.map((t) => ({ ...t })));
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const active = drafts.find((d) => d.id === activeId) ?? null;

  const updateActive = (patch: Partial<WaTemplate>) => {
    if (!active) return;
    setDrafts((prev) => prev.map((d) => (d.id === active.id ? { ...d, ...patch } : d)));
  };

  const addTemplate = () => {
    const id = `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    // New templates inherit the active template's language so the user can
    // build out a CN/EN library without re-tagging each entry.
    const inheritedLang: WaLang = active?.lang ?? 'en';
    const next: WaTemplate = { id, label: 'New template', body: 'Hi {first_name}, ', lang: inheritedLang };
    setDrafts((prev) => [...prev, next]);
    setActiveId(id);
  };
  const removeTemplate = (id: string) => {
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (id === activeId) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };
  const moveTemplate = (id: string, dir: -1 | 1) => {
    setDrafts((prev) => {
      const i = prev.findIndex((d) => d.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  // Insert a token at the textarea's cursor; falls back to appending.
  const insertToken = (token: string) => {
    if (!active) return;
    const ta = bodyRef.current;
    if (!ta) { updateActive({ body: (active.body ?? '') + token }); return; }
    const start = ta.selectionStart ?? active.body.length;
    const end   = ta.selectionEnd ?? active.body.length;
    const before = active.body.slice(0, start);
    const after  = active.body.slice(end);
    const nextBody = before + token + after;
    updateActive({ body: nextBody });
    // Re-focus and place cursor right after the inserted token.
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  // Live-preview the message rendered for a synthetic example row, so the
  // user can sanity-check token substitution before saving.
  const sampleRow: Prospect = {
    id: 'sample', name: 'Thai Kam Meng', unitNo: 'C-08-05', type: 'B3', size: '1403',
    phone: '012-2878545', agent: '', lastUpdate: '',
    callingStatus: 'Positive', valid: 'O', listingType: 'Rent', furnishing: 'Fully Furnished',
    availability: 'Available', unitStatus: 'Own Stay',
    askingRent: '3500', askingPrice: '', remark: '',
  };
  const preview = active ? fillTemplate(active.body, { row: sampleRow, agentName: 'Agent', boardName: 'Millerz Square' }) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-[860px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] overflow-hidden flex flex-col"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#1A202C' }}>
              <MessageSquare size={14} /> WhatsApp Message Settings
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>
              Edit your templates. Use column tokens like <span className="font-mono">{'{first_name}'}</span> to auto-fill row data.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={15} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-[200px_1fr_180px] flex-1 overflow-hidden">
          {/* ── Left rail: template list ── */}
          <div className="border-r overflow-y-auto" style={{ borderColor: '#F1F5F9', background: '#FBFCFD' }}>
            <button onClick={addTemplate}
              className="w-full text-left px-3 py-2 text-xs font-semibold border-b hover:bg-gray-50 flex items-center gap-1.5"
              style={{ color: '#0F766E', borderColor: '#F1F5F9' }}>
              <Plus size={12} /> New template
            </button>
            {drafts.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-400">No templates yet.</p>
            )}
            {drafts.map((t, i) => {
              const isActive = t.id === activeId;
              return (
                <div key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className="group px-2 py-2 border-b cursor-pointer flex items-center gap-1.5"
                  style={{ borderColor: '#F1F5F9', background: isActive ? '#DAF3F2' : 'transparent' }}>
                  <span className="flex-1 text-xs truncate font-medium"
                    style={{ color: isActive ? '#0F766E' : '#1A202C' }}>{t.label || '(untitled)'}</span>
                  <button onClick={(e) => { e.stopPropagation(); moveTemplate(t.id, -1); }}
                    disabled={i === 0}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-0"
                    title="Move up">↑</button>
                  <button onClick={(e) => { e.stopPropagation(); moveTemplate(t.id, 1); }}
                    disabled={i === drafts.length - 1}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-0"
                    title="Move down">↓</button>
                  <button onClick={(e) => { e.stopPropagation(); removeTemplate(t.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500"
                    title="Remove">
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── Centre: editor ── */}
          <div className="overflow-y-auto p-4 space-y-3">
            {!active && (
              <div className="text-center py-10 text-xs text-gray-400">Select a template, or click "New template" to add one.</div>
            )}
            {active && (
              <>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: '#6B7280' }}>Label</label>
                    <input value={active.label}
                      onChange={(e) => updateActive({ label: e.target.value })}
                      placeholder="e.g. Initial outreach"
                      className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#1EC9C4]"
                      style={{ borderColor: '#E5E7EB' }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: '#6B7280' }}>Language</label>
                    {/* Each template is saved under one language so the picker
                        popup can surface EN-only or 中文-only at a time. */}
                    <div className="inline-flex items-stretch rounded-lg border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
                      {(['en', 'zh'] as WaLang[]).map((L) => {
                        const isOn = active.lang === L;
                        return (
                          <button key={L} type="button"
                            onClick={() => updateActive({ lang: L })}
                            className="px-3 py-2 text-xs font-bold transition-colors"
                            style={{
                              background: isOn ? '#1EC9C4' : 'white',
                              color:      isOn ? 'white'   : '#6B7280',
                            }}>
                            {L === 'en' ? 'EN' : '中'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: '#6B7280' }}>Message body</label>
                  <textarea ref={bodyRef}
                    value={active.body}
                    onChange={(e) => updateActive({ body: e.target.value })}
                    rows={10}
                    placeholder="Hi {first_name}, ..."
                    className="w-full px-3 py-2 rounded-lg border text-xs outline-none focus:border-[#1EC9C4] resize-y"
                    style={{ borderColor: '#E5E7EB', fontFamily: 'inherit', minHeight: 180 }} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: '#6B7280' }}>Preview (using a sample row)</label>
                  <div className="rounded-lg border px-3 py-2 text-xs whitespace-pre-wrap" style={{ borderColor: '#E5E7EB', background: '#F8FAFB', color: '#374151', minHeight: 80 }}>
                    {preview || <span className="text-gray-300">—</span>}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Right rail: token picker ── */}
          <div className="border-l overflow-y-auto p-3" style={{ borderColor: '#F1F5F9', background: '#FBFCFD' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>Insert column</p>
            <div className="space-y-1">
              {WA_TOKENS.map((t) => (
                <button key={t.token}
                  onClick={() => insertToken(t.token)}
                  disabled={!active}
                  className="w-full text-left px-2 py-1 rounded hover:bg-white border border-transparent hover:border-[#1EC9C4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <div className="text-[10px] font-mono" style={{ color: '#0F766E' }}>{t.token}</div>
                  <div className="text-[10px]" style={{ color: '#9CA3AF' }}>{t.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: '#F1F5F9', background: '#F8FAFB' }}>
          <button onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => { onSave(drafts); onClose(); }}
            className="px-5 py-1.5 rounded-xl text-xs font-bold text-white hover:opacity-90"
            style={{ background: '#1EC9C4' }}>
            Save templates
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
    // Guard with `boards.reorder` even though the toggle button is hidden when
    // the permission is missing — if a viewer ends up in arrangeMode somehow
    // (e.g. permission revoked mid-session), the drop is silently rejected.
    if (!perms.boardsReorder) return;
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
      dragHandlers={arrangeMode && perms.boardsReorder ? {
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
              onDragOver={arrangeMode && perms.foldersAssignBoards ? (e) => e.preventDefault() : undefined}
              onDrop={arrangeMode && perms.foldersAssignBoards ? () => handleDropOnFolder(folder.id) : undefined}
              className="flex items-center gap-2 mb-2.5 px-1 group"
              style={arrangeMode && perms.foldersAssignBoards ? { borderRadius: 12, padding: '4px 8px', border: '2px dashed #D1D5DB' } : undefined}
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
          onDragOver={arrangeMode && perms.foldersAssignBoards ? (e) => e.preventDefault() : undefined}
          onDrop={arrangeMode && perms.foldersAssignBoards ? () => handleDropOnFolder(null) : undefined}
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
  type ValidStatus,
} from '@/data/prospects';
import * as dropdownPresetsApi from '@/api/dropdown_presets';
import type { DropdownField, DropdownColor, DropdownPreset } from '@/api/dropdown_presets';

// ─── Per-Board Manage Modal ───────────────────────────────────────────────────
// Invite roles mirror the global RBAC roles defined in @/lib/permissions, minus
// master_admin (which can't be granted via an invitation).
import type { Role as AppRole } from '@/lib/permissions';
import { ROLES as APP_ROLES, setUserRole as setUserRoleGlobal, getUserRole, canDo, setViewAsRole, useViewAsStore, usePermsStore } from '@/lib/permissions';

// Resolution comes straight from the profiles directory in the auth store —
// master_admin is determined server-side at signup-trigger time, so no email
// hardcode is needed any more. Helpers below take an `email` and look up the
// canonical role; the snapshot is reactive because `useAuthStore` callers
// re-read the directory on every render.
function isMasterEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return getUserRole(email) === 'master_admin';
}
function actualAppRole(email: string | undefined | null): AppRole {
  if (!email) return 'viewer';
  return getUserRole(email);
}
// Effective role used for permission checks — the master admin can opt to
// preview a lower role; everyone else gets their stored role unchanged.
// NOTE: this needs to be called from a render path that subscribes to
// `useViewAsStore` so re-renders fire on preview toggle.
function resolveAppRole(email: string | undefined | null, override?: AppRole | null): AppRole {
  const real = actualAppRole(email);
  if (real === 'master_admin' && override) return override;
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

  // Resync when the board prop changes (realtime refreshHub updated the
  // canonical board). Only overwrite fields the user hasn't already edited.
  useEffect(() => {
    setName((curr) => (curr === '' || curr === board.name ? board.name : curr));
    setLocation((curr) => (curr === '' || curr === board.location ? board.location : curr));
    setColor((curr) => (curr === board.color ? board.color : curr));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id, board.name, board.location, board.color]);

  // Permission gates (driven by Admin Control → Permission Matrix).
  // Subscribing to BOTH stores ensures the modal re-renders the moment an
  // admin saves a change OR the user toggles View As — otherwise stale
  // permissions would stick around as long as the modal stays open.
  const viewAsOverride = useViewAsStore((s) => s.role);
  usePermsStore((s) => s.perms);
  const myRole       = resolveAppRole(getCurrentUser()?.email, viewAsOverride);
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
                        {canRemoveMem && !isMasterEmail(m.email) && (
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
                        {canRemoveMembers && !isMasterEmail(m.email) && (
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
// Drag-to-pan when the user has toggled View → Unlocked. Unlike useSpacePan
// (which requires holding space) this binds directly to the scroll container
// so any click-and-drag inside the grid scrolls it. Returns whether a drag is
// currently in progress (so the cell-click hover/select logic can suppress).
function useDragPan(
  scrollRef: MutableRefObject<HTMLDivElement | null>,
  enabled: boolean,
): boolean {
  const dragging = useRef(false);
  const lastPos  = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (!el) return;
    const onDown = (e: MouseEvent) => {
      // Don't hijack drags that originate inside an interactive element
      // (buttons, links, inputs) — only the empty cell area pans.
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || tag === 'SELECT') return;
      dragging.current = true;
      setIsDragging(true);
      lastPos.current  = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      el.scrollLeft -= dx;
      el.scrollTop  -= dy;
      lastPos.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setIsDragging(false);
    };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [enabled, scrollRef]);
  return isDragging;
}

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
  'Room Rent':        { bg: '#FFEDD5', text: '#EA580C' },
  'Short Term Rent':  { bg: '#EDE9FE', text: '#7C3AED' },
};
const AVAILABILITY_STYLE: Record<string, { bg: string; text: string }> = {
  'Available':     { bg: '#DCFCE7', text: '#16A34A' },
  'NOT Available': { bg: '#FEE2E2', text: '#DC2626' },
};
const VALID_STYLE: Record<string, { bg: string; text: string }> = {
  O: { bg: '#DCFCE7', text: '#16A34A' },
  X: { bg: '#FEE2E2', text: '#DC2626' },
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
// Condition (DB column `furnishing`) now also covers the two rental types.
const FURNISHING_OPTIONS: Furnishing[] = [
  'Fully Furnished',
  'Partly Furnished',
  'Bare Unit',
  'Room Rent',
  'Short Term Rent',
  '',
];
const AVAILABILITY_OPTIONS: Availability[] = ['Available', 'NOT Available', ''];
const VALID_OPTIONS: ValidStatus[] = ['O', 'X', ''];

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
  { key: 'agent',         label: 'Agent' },
  { key: 'callingStatus', label: 'Calling Status' },
  { key: 'valid',         label: 'Valid' },
  { key: 'listingType',   label: 'Listing Type' },
  { key: 'furnishing',    label: 'Condition' },          // DB column: furnishing
  { key: 'availability',  label: 'Availability' },
  { key: 'unitStatus',    label: 'Unit Status' },
  { key: 'askingRent',    label: 'Asking RENT' },
  { key: 'askingPrice',   label: 'Asking PRICE' },
  { key: 'lastUpdate',    label: 'Last Update' },
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
  'valid': 'valid', 'valid?': 'valid', 'validity': 'valid', 'verified': 'valid',
  'listing type': 'listingType', 'listingtype': 'listingType', 'listing': 'listingType',
  // "Furnishing" still maps to the renamed Condition column (same DB field).
  'condition': 'furnishing', 'furnishing': 'furnishing', 'furnished': 'furnishing', 'furnish': 'furnishing',
  'availability': 'availability', 'available': 'availability',
  'unit status': 'unitStatus', 'unitstatus': 'unitStatus', 'occupancy': 'unitStatus', 'tenancy status': 'unitStatus',
  'asking rent': 'askingRent', 'askingrent': 'askingRent', 'rent': 'askingRent', 'monthly rent': 'askingRent',
  'asking price': 'askingPrice', 'askingprice': 'askingPrice', 'price': 'askingPrice', 'sale price': 'askingPrice',
  'agent': 'agent', 'assigned': 'agent', 'assigned to': 'agent', 'agent name': 'agent', 'handled by': 'agent', 'owner agent': 'agent',
  'last update': 'lastUpdate', 'lastupdate': 'lastUpdate', 'updated': 'lastUpdate', 'updated at': 'lastUpdate', 'last contact': 'lastUpdate', 'last contacted': 'lastUpdate', 'date': 'lastUpdate',
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
// Normalise free-form CSV cell values to the canonical enums the DB CHECK
// constraints accept. Unknown / ambiguous → empty string (the row still
// imports, the field just stays blank instead of blocking the whole batch).
function normaliseCallingStatus(v: string): CallingStatus {
  const k = v.trim().toLowerCase();
  if (!k) return '';
  if (k === 'positive' || k === 'good' || k === 'interested' || k === 'yes') return 'Positive';
  if (k === 'negative' || k === 'bad'  || k === 'not interested' || k === 'no') return 'Negative';
  if (k === 'neutral'  || k === 'maybe' || k === 'follow up' || k === 'follow-up') return 'Neutral';
  return '';
}
function normaliseFurnishing(v: string): Furnishing {
  const k = v.trim().toLowerCase();
  if (!k) return '';
  if (k === 'fully furnished' || k === 'fully'  || k === 'ff') return 'Fully Furnished';
  if (k === 'partly furnished'|| k === 'partial'|| k === 'pf' || k === 'semi furnished' || k === 'semi') return 'Partly Furnished';
  if (k === 'bare unit'       || k === 'bare'   || k === 'unfurnished' || k === 'empty') return 'Bare Unit';
  if (k === 'room rent'       || k === 'room'   || k === 'room rental') return 'Room Rent';
  if (k === 'short term rent' || k === 'short term' || k === 'short-term rent' || k === 'short term rental' || k === 'str' || k === 'airbnb') return 'Short Term Rent';
  return '';
}
function normaliseAvailability(v: string): Availability {
  const k = v.trim().toLowerCase();
  if (!k) return '';
  if (k === 'available' || k === 'yes' || k === 'open' || k === 'ready') return 'Available';
  if (k === 'not available' || k === 'unavailable' || k === 'no' || k === 'closed' || k === 'taken' || k === 'rented' || k === 'sold') return 'NOT Available';
  return '';
}
function normaliseValid(v: string): ValidStatus {
  const k = v.trim().toLowerCase();
  if (!k) return '';
  if (k === 'o' || k === 'yes' || k === 'y' || k === 'true' || k === 'valid' || k === '✓' || k === '✔') return 'O';
  if (k === 'x' || k === 'no'  || k === 'n' || k === 'false' || k === 'invalid' || k === '✗' || k === '✘') return 'X';
  return '';
}
function normaliseListingType(v: string): ListingType {
  // Multi-select: keep recognised atoms ('Rent', 'Sale'), join with comma.
  // Accepts inputs like "rent", "Sale", "Rent / Sale", "rent,sale", etc.
  const atoms = v.split(/[\s,/|;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const out: string[] = [];
  for (const a of atoms) {
    if ((a === 'rent' || a === 'rental' || a === 'lease') && !out.includes('Rent')) out.push('Rent');
    if ((a === 'sale' || a === 'sell' || a === 'buy')     && !out.includes('Sale')) out.push('Sale');
  }
  return out.join(',');
}

function applyMapping(
  rawRows: string[][],
  mapping: Array<keyof Prospect | '__skip__'>,
): Prospect[] {
  return rawRows
    .map((cells, i) => {
      const row: Prospect = {
        id: String(Date.now() + i),
        name: '', unitNo: '', type: '', size: '', phone: '', agent: '', lastUpdate: '',
        callingStatus: '', valid: '', listingType: '', furnishing: '',
        availability: '', unitStatus: '', askingRent: '', askingPrice: '', remark: '',
      };
      mapping.forEach((sysKey, colIdx) => {
        if (sysKey === '__skip__') return;
        const raw = (cells[colIdx] ?? '').trim();
        // `valid` is the one column that still has a strict DB CHECK
        // (O / X / ''), so normalise loose inputs into the canonical set.
        if (sysKey === 'valid') { row.valid = normaliseValid(raw); return; }
        // Everything else (calling status, listing type, condition,
        // availability, unit status) is now free-form — any value the user
        // typed in the CSV becomes a usable chip. If the value isn't yet a
        // preset, the chip still renders (in a neutral grey) and a user with
        // `dropdowns.manage` can add it as a workspace preset later.
        (row as unknown as Record<string, string>)[sysKey] = raw;
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
    <div ref={ref} className="relative w-full flex items-center" style={{ minHeight: 36 }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-1.5 px-2 group" style={{ minHeight: 36 }}>
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
    <div ref={ref} className="relative w-full flex items-center" style={{ minHeight: 36 }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-1 px-2 group" style={{ minHeight: 36 }}>
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
    <div ref={ref} className="relative w-full flex items-center" style={{ minHeight: 36 }}>
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-2 group"
        style={{ minHeight: 36 }}>
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
// Click-through toggle: '' → 'O' → 'X' → '' (no popup needed for a 3-state cell).
function ValidDropdown({ value, onChange }: { value: ValidStatus; onChange: (v: ValidStatus) => void }) {
  const next: Record<ValidStatus, ValidStatus> = { '': 'O', 'O': 'X', 'X': '' };
  const style = value ? VALID_STYLE[value] : undefined;
  return (
    <button
      onClick={() => onChange(next[value])}
      className="w-full flex items-center justify-center hover:bg-blue-50/40 transition-colors"
      style={{ minHeight: 36 }}
      title="Click to toggle Valid → Invalid → clear">
      {value
        ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
            style={{ background: style?.bg, color: style?.text }}>{value}</span>
        : <span className="text-xs text-gray-300">—</span>}
    </button>
  );
}

// ─── Customisable single-select dropdown (Calling Status, Condition,
//      Availability, Unit Status). Reads options + colours from the workspace
//      `dropdown_presets` table; lets users with `dropdowns.manage` add new
//      options with a colour picker. The × remove affordance is gated by a
//      separate `dropdowns.remove_options` permission (destructive action). ──
function CustomDropdown({ value, presets, canManage, canRemove, onChange, onAddPreset, onRemovePreset }: {
  value: string;
  presets: DropdownPreset[];        // already filtered to one field
  canManage: boolean;
  canRemove: boolean;
  onChange: (v: string) => void;
  onAddPreset: (label: string, color: DropdownColor) => Promise<void> | void;
  onRemovePreset: (id: string) => Promise<void> | void;
}) {
  const [open, setOpen]     = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft]   = useState('');
  const [pickedColor, setPickedColor] = useState<DropdownColor>('teal');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setAdding(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Show the chip with the colour stored on its preset row. Unknown values
  // (e.g. legacy data with a preset that was later removed) get a neutral grey.
  const toneFor = (label: string): { background: string; color: string } => {
    const p = presets.find((x) => x.value === label);
    const pal = (p && AGENT_COLOR_PALETTE[p.color]) ?? AGENT_FALLBACK;
    return { background: pal.bg, color: pal.text };
  };

  const submitNew = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    await onAddPreset(trimmed, pickedColor);
    onChange(trimmed);
    setDraft(''); setAdding(false); setOpen(false); setPickedColor('teal');
  };

  return (
    <div ref={ref} className="relative w-full flex items-center" style={{ minHeight: 36 }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-1.5 px-2 group" style={{ minHeight: 36 }}>
        {value
          ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
              style={toneFor(value)}>{value}</span>
          : <span className="text-xs text-gray-300">—</span>}
        <ChevronDown size={11} className="ml-auto flex-shrink-0 text-gray-300 group-hover:text-gray-500" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-white rounded-lg border border-gray-100 py-1 z-50"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.10)' }}>
          {presets.length === 0 && !adding && (
            <p className="px-3 py-1.5 text-xs text-gray-400">No options yet.</p>
          )}
          {presets.map((p) => (
            <div key={p.id} className="flex items-center group/opt">
              <button onClick={() => { onChange(p.value); setOpen(false); }}
                className="flex-1 text-left px-3 py-1.5 text-xs hover:bg-gray-50">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-medium"
                  style={toneFor(p.value)}>{p.value}</span>
              </button>
              {canRemove && (
                <button onMouseDown={(e) => { e.preventDefault(); void onRemovePreset(p.id); }}
                  title="Remove option"
                  className="opacity-0 group-hover/opt:opacity-100 px-2 py-1 text-gray-300 hover:text-red-500 transition-opacity">
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          {value && (
            <button onClick={() => { onChange(''); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 border-t border-gray-100">Clear</button>
          )}
          {canManage && !adding && (
            <button onClick={() => setAdding(true)}
              className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 border-t border-gray-100"
              style={{ color: '#0F766E' }}>
              + Add custom…
            </button>
          )}
          {canManage && adding && (
            <div className="px-2 py-2 border-t border-gray-100 space-y-1.5">
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void submitNew(); if (e.key === 'Escape') { setAdding(false); setDraft(''); } }}
                placeholder="New option…"
                className="w-full px-2 py-1 border rounded text-xs outline-none focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB' }} />
              <div className="flex flex-wrap gap-1">
                {AGENT_COLOR_KEYS.map((key) => {
                  const pal = AGENT_COLOR_PALETTE[key];
                  const selected = pickedColor === key;
                  return (
                    <button key={key} type="button"
                      onMouseDown={(e) => { e.preventDefault(); setPickedColor(key as DropdownColor); }}
                      title={key}
                      className="w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{ background: pal.swatch, boxShadow: selected ? `0 0 0 2px white, 0 0 0 4px ${pal.swatch}` : 'none' }}>
                      {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-1 pt-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                  style={{ background: AGENT_COLOR_PALETTE[pickedColor].bg, color: AGENT_COLOR_PALETTE[pickedColor].text }}>
                  {draft.trim() || 'Preview'}
                </span>
                <div className="flex gap-1">
                  <button onMouseDown={(e) => { e.preventDefault(); setAdding(false); setDraft(''); setPickedColor('teal'); }}
                    className="text-[10px] text-gray-500 hover:text-gray-700 px-2 py-0.5">Cancel</button>
                  <button onMouseDown={(e) => { e.preventDefault(); void submitNew(); }}
                    disabled={!draft.trim()}
                    className="text-[10px] font-bold text-white px-2 py-0.5 rounded disabled:opacity-40"
                    style={{ background: '#1EC9C4' }}>Add</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Customisable multi-select (Listing Type). Stores a comma-separated value,
//      reads options from `dropdown_presets`, supports + Add custom + colour
//      and an optional × remove (gated by `dropdowns.remove_options`).
function CustomMultiDropdown({ value, presets, canManage, canRemove, onChange, onAddPreset, onRemovePreset }: {
  value: string;                    // comma-separated, e.g. 'Rent,Sale'
  presets: DropdownPreset[];        // filtered to one field
  canManage: boolean;
  canRemove: boolean;
  onChange: (v: string) => void;
  onAddPreset: (label: string, color: DropdownColor) => Promise<void> | void;
  onRemovePreset: (id: string) => Promise<void> | void;
}) {
  const [open, setOpen]     = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft]   = useState('');
  const [pickedColor, setPickedColor] = useState<DropdownColor>('teal');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setAdding(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const selected = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
    onChange(next.join(','));
  };
  const toneFor = (label: string) => {
    const p = presets.find((x) => x.value === label);
    const pal = (p && AGENT_COLOR_PALETTE[p.color]) ?? AGENT_FALLBACK;
    return { background: pal.bg, color: pal.text };
  };

  const submitNew = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    await onAddPreset(trimmed, pickedColor);
    // Add the new value to the selected set on this row immediately.
    if (!selected.includes(trimmed)) onChange([...selected, trimmed].join(','));
    setDraft(''); setAdding(false); setPickedColor('teal');
  };

  return (
    <div ref={ref} className="relative w-full flex items-center" style={{ minHeight: 36 }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-1 px-2 group" style={{ minHeight: 36 }}>
        {selected.length > 0
          ? <div className="flex flex-wrap gap-1 overflow-hidden">
              {selected.map((s) => (
                <span key={s} className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap"
                  style={toneFor(s)}>{s}</span>
              ))}
            </div>
          : <span className="text-xs text-gray-300">—</span>}
        <ChevronDown size={11} className="ml-auto flex-shrink-0 text-gray-300 group-hover:text-gray-500" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-white rounded-lg border border-gray-100 py-1 z-50"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.10)' }}>
          {presets.length === 0 && !adding && (
            <p className="px-3 py-1.5 text-xs text-gray-400">No options yet.</p>
          )}
          {presets.map((p) => {
            const checked = selected.includes(p.value);
            return (
              <div key={p.id} className="flex items-center group/opt">
                <button onClick={() => toggle(p.value)}
                  className="flex-1 flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-gray-50">
                  <span className="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: checked ? '#1EC9C4' : '#D1D5DB', background: checked ? '#1EC9C4' : 'transparent' }}>
                    {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-medium"
                    style={toneFor(p.value)}>{p.value}</span>
                </button>
                {canRemove && (
                  <button onMouseDown={(e) => { e.preventDefault(); void onRemovePreset(p.id); }}
                    title="Remove option"
                    className="opacity-0 group-hover/opt:opacity-100 px-2 py-1 text-gray-300 hover:text-red-500 transition-opacity">
                    <X size={11} />
                  </button>
                )}
              </div>
            );
          })}
          {selected.length > 0 && (
            <button onClick={() => onChange('')}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 border-t border-gray-100">Clear all</button>
          )}
          {canManage && !adding && (
            <button onClick={() => setAdding(true)}
              className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 border-t border-gray-100"
              style={{ color: '#0F766E' }}>
              + Add custom…
            </button>
          )}
          {canManage && adding && (
            <div className="px-2 py-2 border-t border-gray-100 space-y-1.5">
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void submitNew(); if (e.key === 'Escape') { setAdding(false); setDraft(''); } }}
                placeholder="New option…"
                className="w-full px-2 py-1 border rounded text-xs outline-none focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB' }} />
              <div className="flex flex-wrap gap-1">
                {AGENT_COLOR_KEYS.map((key) => {
                  const pal = AGENT_COLOR_PALETTE[key];
                  const isSelected = pickedColor === key;
                  return (
                    <button key={key} type="button"
                      onMouseDown={(e) => { e.preventDefault(); setPickedColor(key as DropdownColor); }}
                      title={key}
                      className="w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{ background: pal.swatch, boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 4px ${pal.swatch}` : 'none' }}>
                      {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-1 pt-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                  style={{ background: AGENT_COLOR_PALETTE[pickedColor].bg, color: AGENT_COLOR_PALETTE[pickedColor].text }}>
                  {draft.trim() || 'Preview'}
                </span>
                <div className="flex gap-1">
                  <button onMouseDown={(e) => { e.preventDefault(); setAdding(false); setDraft(''); setPickedColor('teal'); }}
                    className="text-[10px] text-gray-500 hover:text-gray-700 px-2 py-0.5">Cancel</button>
                  <button onMouseDown={(e) => { e.preventDefault(); void submitNew(); }}
                    disabled={!draft.trim()}
                    className="text-[10px] font-bold text-white px-2 py-0.5 rounded disabled:opacity-40"
                    style={{ background: '#1EC9C4' }}>Add</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
    <button onDoubleClick={() => setEditing(true)} className="w-full flex items-center px-2 hover:bg-blue-50/40 transition-colors" style={{ minHeight: 36, justifyContent: align === 'center' ? 'center' : undefined }}>
      <span className="text-xs truncate" style={{ fontFamily: mono ? 'JetBrains Mono, monospace' : undefined, color: value ? '#2B3340' : '#D1D5DB' }}>{value || placeholder}</span>
    </button>
  );
}

// ─── Phone cell wrapper ─────────────────────────────────────────────────────
// TextCell + WhatsAppButton in one. The WA launcher is only shown when the
// cell is being hovered OR its popup is currently open; that pairing keeps
// the cell visually clean while preventing the "disappearing button" feel
// once the popup is up and the cursor leaves the cell to reach it.
function PhoneCell({ row, onChange, agentName, boardName, templates, lang, onLangChange, canSend, onManageTemplates, align = 'left', mono = false, placeholder = '' }: {
  row: Prospect;
  onChange: (v: string) => void;
  agentName: string;
  boardName?: string;
  templates: WaTemplate[];
  lang: WaLang;
  onLangChange: (next: WaLang) => void;
  canSend: boolean;
  onManageTemplates?: () => void;
  align?: 'left' | 'center';
  mono?: boolean;
  placeholder?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const showLauncher = canSend && !!row.phone && (hovered || popupOpen);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-full flex items-center"
      style={{ minHeight: 36 }}>
      <div className="flex-1 min-w-0">
        <TextCell value={row.phone} onChange={onChange} align={align} mono={mono} placeholder={placeholder} />
      </div>
      {showLauncher && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <WhatsAppButton
            row={row}
            agentName={agentName}
            boardName={boardName}
            templates={templates}
            lang={lang}
            onLangChange={onLangChange}
            onOpenChange={setPopupOpen}
            onManageTemplates={onManageTemplates}
          />
        </div>
      )}
    </div>
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
  valid:         string[];
  furnishing:    string[];
  availability:  string[];
  unitStatus:    string[];
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

function FilterBar({ filters, setFilters, agentOptions, callingOptions, conditionOptions, availabilityOptions, unitStatusOptions, onClose }: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  agentOptions: string[];
  callingOptions: string[];
  conditionOptions: string[];
  availabilityOptions: string[];
  unitStatusOptions: string[];
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-[#FAFBFC] overflow-x-auto whitespace-nowrap">
      <span className="text-xs font-semibold text-gray-500 flex-shrink-0">Filters</span>
      {[
        { label: 'Agent',        key: 'agent'         as const, opts: agentOptions },
        { label: 'Status',       key: 'callingStatus' as const, opts: callingOptions },
        { label: 'Valid',        key: 'valid'         as const, opts: VALID_OPTIONS.filter(Boolean) },
        { label: 'Condition',    key: 'furnishing'    as const, opts: conditionOptions },
        { label: 'Availability', key: 'availability'  as const, opts: availabilityOptions },
        { label: 'Unit Status',  key: 'unitStatus'    as const, opts: unitStatusOptions },
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

      <button onClick={() => setFilters({ callingStatus: [], valid: [], furnishing: [], availability: [], unitStatus: [], agent: [], askingRentRange: [0, RENT_MAX], askingPriceRange: [0, PRICE_MAX] })} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 flex-shrink-0"><X size={12} /> Clear</button>
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
                <p className="text-xs" style={{ color: '#9CA3AF' }}>System fields: Name · Unit No · Type · Size · Phone · Agent · Calling Status · Valid · Listing Type · Condition · Availability · Unit Status · Asking RENT · Asking PRICE · Last Update · Remark</p>
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

// ─── Column resize handle ────────────────────────────────────────────────────
// 6px-wide invisible grip on the right edge of each header cell. Drag to
// resize; commits + persists on mouseup. Hidden entirely when the user lacks
// `columns.resize` so viewers don't see a misleading affordance.
function ColumnResizer({ width, onResize }: {
  width: number;
  onResize: (next: number) => void;
}) {
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      // Clamp to a sane range so a column can't disappear or grow off-screen.
      const next = Math.max(60, Math.min(600, Math.round(startW + delta)));
      onResize(next);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  return (
    <div
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      title="Drag to resize"
      style={{
        position: 'absolute',
        top: 0, right: -3, bottom: 0,
        width: 6, cursor: 'col-resize', zIndex: 2,
      }}
      // Visible teal hover stripe so users can find the handle.
      className="group/resize">
      <div className="opacity-0 group-hover/resize:opacity-100 transition-opacity"
        style={{ position: 'absolute', top: 4, bottom: 4, right: 2, width: 2, background: '#1EC9C4', borderRadius: 1 }} />
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
  selectKey?: 'callingStatus' | 'listingType' | 'furnishing' | 'availability' | 'valid' | 'unitStatus';
  options?: string[]; // for custom-select columns
}

const BASE_COLUMNS: ColDef[] = [
  { key: 'name',          label: 'Name',           width: 220, type: 'text',   fixed: true },
  { key: 'unitNo',        label: 'Unit No',        width: 96,  type: 'text',   fixed: true, mono: true },
  { key: 'type',          label: 'Type',           width: 72,  type: 'text',   fixed: true, align: 'center' },
  { key: 'size',          label: 'Size (sqft)',    width: 88,  type: 'text',   fixed: true, align: 'center', mono: true },
  { key: 'phone',         label: 'Phone',          width: 180, type: 'text',   fixed: true, mono: true },
  // Agent now lives in the identity rail (left of the data columns).
  { key: 'agent',         label: 'Agent',          width: 130, type: 'readonly', fixed: true },
  { key: 'callingStatus', label: 'Calling Status', width: 130, type: 'select', fixed: true, selectKey: 'callingStatus' },
  { key: 'valid',         label: 'Valid',          width: 80,  type: 'select', fixed: true, selectKey: 'valid' },
  { key: 'listingType',   label: 'Listing Type',   width: 120, type: 'select', fixed: true, selectKey: 'listingType' },
  // "Condition" replaces "Furnishing" — DB column is still `furnishing`.
  { key: 'furnishing',    label: 'Condition',      width: 168, type: 'select', fixed: true, selectKey: 'furnishing' },
  { key: 'availability',  label: 'Availability',   width: 130, type: 'select', fixed: true, selectKey: 'availability' },
  // Unit Status — workspace-wide presets + ad-hoc custom values.
  { key: 'unitStatus',    label: 'Unit Status',    width: 140, type: 'select', fixed: true, selectKey: 'unitStatus' },
  { key: 'askingRent',    label: 'Asking RENT',    width: 110, type: 'text',   fixed: true, mono: true, placeholder: 'RM —' },
  { key: 'askingPrice',   label: 'Asking PRICE',   width: 120, type: 'text',   fixed: true, mono: true, placeholder: 'RM —' },
  { key: 'remark',        label: 'Remark',         width: 200, type: 'text',   fixed: true, placeholder: 'Add note...' },
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
    <div ref={ref} className="relative w-full flex items-center" style={{ minHeight: 36 }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-1.5 px-2 group" style={{ minHeight: 36 }}>
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
  const viewAsOverride = useViewAsStore((s) => s.role);
  // Subscribing here makes EVERY downstream `can(...)` call re-evaluate the
  // moment an admin saves a matrix change — modals, buttons, drag/drop UI,
  // recycle bin actions all stay in sync without page refresh.
  usePermsStore((s) => s.perms);
  const myRole      = resolveAppRole(me?.email, viewAsOverride);
  const can         = (key: string) => canDo(myRole, key);

  // ── Board state (hydrated from Supabase on mount) ────────────────────────
  const [boards, setBoards] = useState<Board[]>([]);
  const [view, setView]     = useState<'board' | 'grid'>('board');
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [showNewBoard, setShowNewBoard]         = useState(false);
  const [arrangeMode, setArrangeMode]           = useState(false);
  const [manageBoardId, setManageBoardId]       = useState<string | null>(null);
  const [manageFolderId, setManageFolderId]     = useState<string | null>(null);
  const [boardMembers, setBoardMembers]         = useState<Record<string, BoardMember[]>>({});
  const [boardProspects, setBoardProspects]     = useState<Record<string, Prospect[]>>({});
  const [folders, setFolders]                   = useState<Folder[]>([]);
  const [folderMembers, setFolderMembers]       = useState<Record<string, BoardMember[]>>({});
  const [agentPresets, setAgentPresets]         = useState<AgentPreset[]>([]);
  const [dropdownPresets, setDropdownPresets]   = useState<DropdownPreset[]>([]);
  const [recycleBin, setRecycleBin]             = useState<RecycledItem[]>([]);
  const [loadingHub, setLoadingHub]             = useState(true);
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

  // ── Profile lookup helpers (Supabase user_id ↔ email/name) ───────────────
  const directory = useAuthStore((s) => s.directory);
  const profileById = useMemo(() => {
    const m = new Map<string, { email: string; name: string }>();
    for (const p of directory) m.set(p.id, { email: p.email, name: p.display_name || p.email.split('@')[0] });
    return m;
  }, [directory]);
  const profileByEmail = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    for (const p of directory) m.set(p.email.toLowerCase(), { id: p.id, name: p.display_name || p.email.split('@')[0] });
    return m;
  }, [directory]);

  const boardFromApi = useCallback((r: boardsApi.Board): Board => {
    const owner = profileById.get(r.ownerId);
    return {
      id: r.id, name: r.name, location: r.location, color: r.color,
      ownerEmail: owner?.email ?? '',
      ownerName:  owner?.name  ?? (owner?.email?.split('@')[0] ?? ''),
      folderId:   r.folderId,
    };
  }, [profileById]);

  const folderFromApi = useCallback((r: foldersApi.Folder): Folder => {
    const owner = profileById.get(r.ownerId);
    return {
      id: r.id, name: r.name,
      ownerEmail: owner?.email ?? '',
      ownerName:  owner?.name  ?? (owner?.email?.split('@')[0] ?? ''),
    };
  }, [profileById]);

  const memberFromApi = useCallback((m: membersApi.BoardMember | membersApi.FolderMember): BoardMember => {
    const p = profileById.get(m.userId);
    return {
      id: m.userId, // Use the user_id as the local member identifier — unique.
      email: p?.email ?? '',
      role: m.role as BoardMember['role'],
    };
  }, [profileById]);

  // Suppress realtime-driven refreshes during big batch operations
  // (loadDemoData inserts ~15k rows — without this the realtime listener
  // would fire refreshHub() after every row and freeze the page).
  const suppressRealtime = useRef(false);

  // ── Boot: hydrate everything from Supabase on first mount ────────────────
  const refreshHub = useCallback(async () => {
    try {
      const [b, p, f, bm, fm, ag, dp, rb] = await Promise.all([
        boardsApi.listBoards(),
        prospectsApi.listAllProspects(),
        foldersApi.listFolders(),
        membersApi.listAllBoardMembers(),
        membersApi.listAllFolderMembers(),
        agentsApi.listAgentPresets(),
        dropdownPresetsApi.listDropdownPresets(),
        recycleApi.listRecycleBin(),
      ]);
      setDropdownPresets(dp);

      setBoards(b.map(boardFromApi));
      setBoardProspects(p);
      setFolders(f.map(folderFromApi));

      const bmGrouped: Record<string, BoardMember[]> = {};
      for (const m of bm) {
        (bmGrouped[m.boardId] ??= []).push(memberFromApi(m));
      }
      setBoardMembers(bmGrouped);

      const fmGrouped: Record<string, BoardMember[]> = {};
      for (const m of fm) {
        (fmGrouped[m.folderId] ??= []).push(memberFromApi(m));
      }
      setFolderMembers(fmGrouped);

      setAgentPresets(ag.map((a) => ({ id: a.id, name: a.name, color: a.color })));
      // Map each recycle row into the matching discriminated-union variant.
      const mappedRecycle: RecycledItem[] = rb.map((r): RecycledItem => {
        const deletedBy = profileById.get(r.deletedBy ?? '')?.email ?? '';
        if (r.kind === 'board') {
          return { kind: 'board', id: r.id, deletedAt: r.deletedAt, deletedBy,
            payload: r.payload as { board: unknown; prospects: unknown; members: unknown } };
        }
        if (r.kind === 'folder') {
          return { kind: 'folder', id: r.id, deletedAt: r.deletedAt, deletedBy,
            payload: r.payload as { folder: unknown; members: unknown } };
        }
        return { kind: 'prospect', id: r.id, deletedAt: r.deletedAt, deletedBy,
          payload: r.payload as { boardId: string; prospect: unknown; customValues: unknown } };
      });
      setRecycleBin(mappedRecycle);
    } catch (e) {
      notifyError('Could not load Prospect Hub data', e);
    } finally {
      setLoadingHub(false);
    }
  }, [boardFromApi, folderFromApi, memberFromApi, profileById]);

  useEffect(() => { void refreshHub(); }, [refreshHub]);

  // ── Realtime: any change anywhere triggers a full refetch (simple + safe). ─
  // Channel name includes a random suffix so two tabs of the same user don't
  // clobber each other's subscription.
  useEffect(() => {
    // Debounce burst events (e.g. bulk inserts) so we refetch at most once per
    // 500ms instead of once per row.
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (suppressRealtime.current) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { void refreshHub(); }, 500);
    };
    const channelName = `prospect-hub-${Math.random().toString(36).slice(2, 8)}`;
    const ch = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' },         scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' },      scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' },        scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_members' },  scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folder_members' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_presets' },     scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dropdown_presets' },  scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recycle_bin' },       scheduleRefresh)
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(ch);
    };
  }, [refreshHub]);

  // ── Agent preset CRUD ─────────────────────────────────────────────────────
  // Generate a real UUID client-side and send it through to Supabase — the
  // optimistic preset uses the SAME id that will land in the DB, so any
  // downstream reference (e.g. an agent column dropdown) survives the
  // realtime round-trip without orphans.
  const addAgentPreset = (name: string, color: string): AgentPreset => {
    if (!can('agents.manage')) return { id: '', name, color };
    const trimmed = name.trim();
    const existing = agentPresets.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const id = crypto.randomUUID();
    const optimistic: AgentPreset = { id, name: trimmed, color };
    setAgentPresets((prev) => [...prev, optimistic]);
    void agentsApi.createAgentPreset({ id, name: trimmed, color })
      .catch((e) => {
        console.error('addAgentPreset', e);
        setAgentPresets((prev) => prev.filter((p) => p.id !== id));
      });
    return optimistic;
  };
  const removeAgentPreset = async (id: string) => {
    if (!can('agents.manage')) return;
    setAgentPresets((prev) => prev.filter((p) => p.id !== id));
    try { await agentsApi.deleteAgentPreset(id); }
    catch (e) { notifyError('Could not remove agent', e); void refreshHub(); }
  };

  // Workspace-wide dropdown preset CRUD — gated by `dropdowns.manage` (add)
  // and `dropdowns.remove_options` (delete). Used by every customisable column
  // (Calling Status, Listing Type, Condition, Availability, Unit Status).
  // Optimistic; realtime broadcast keeps every open tab in sync.
  const addDropdownPreset = async (field: DropdownField, value: string, color: DropdownColor) => {
    if (!can('dropdowns.manage')) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    // De-dupe case-insensitively against existing options for the same field.
    if (dropdownPresets.some((p) => p.field === field && p.value.toLowerCase() === trimmed.toLowerCase())) return;
    try {
      const created = await dropdownPresetsApi.addDropdownPreset(field, trimmed, color);
      setDropdownPresets((prev) => [...prev, created]);
    } catch (e) { notifyError('Could not add option', e); }
  };
  const removeDropdownPreset = async (id: string) => {
    if (!can('dropdowns.remove_options')) return;
    // Optimistic remove. Existing row values that referenced this option
    // stay as-is — the chip just renders in a neutral grey until cleaned up
    // or re-assigned. (Cascading-rewrite isn't safe by default — the agent
    // may have meant the value, just not the preset.)
    setDropdownPresets((prev) => prev.filter((p) => p.id !== id));
    try { await dropdownPresetsApi.removeDropdownPreset(id); }
    catch (e) { notifyError('Could not remove option', e); void refreshHub(); }
  };

  const memberCounts: Record<string, number> = {};
  const updatedPcts: Record<string, number> = {};
  for (const b of visibleBoards) {
    memberCounts[b.id] = 1 + (boardMembers[b.id]?.length ?? 0); // owner + invited
    const arr = boardProspects[b.id] ?? [];
    const updated = arr.filter((p) => p.lastUpdate && p.lastUpdate.length > 0).length;
    updatedPcts[b.id] = arr.length === 0 ? 0 : Math.round((updated / arr.length) * 100);
  }

  const updateBoard = async (id: string, patch: { name: string; location: string; color: string }) => {
    if (!can('boards.edit')) return;
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    if (activeBoard?.id === id) setActiveBoard((prev) => (prev ? { ...prev, ...patch } : prev));
    try { await boardsApi.updateBoard(id, patch); }
    catch (e) { notifyError('Could not update board', e); void refreshHub(); }
  };

  // Invite — email gets resolved to a Supabase user_id via the profile
  // directory. Refetch the directory once before failing, since the invitee
  // might have signed up in another tab since the last load.
  const resolveInvite = async (email: string): Promise<{ id: string; name: string } | null> => {
    const cleaned = email.trim().toLowerCase();
    const hit = profileByEmail.get(cleaned);
    if (hit) return hit;
    // Stale directory? Refetch and try again before alerting.
    const { refreshDirectory } = await import('@/lib/auth');
    await refreshDirectory();
    const dir = useAuthStore.getState().directory;
    const fresh = dir.find((p) => p.email.toLowerCase() === cleaned);
    if (!fresh) return null;
    return { id: fresh.id, name: fresh.display_name || cleaned.split('@')[0] };
  };

  const inviteBoardMember = async (boardId: string, email: string) => {
    if (!can('boards.invite_members')) return;
    const target = await resolveInvite(email);
    if (!target) { notifyError(`No user found with email ${email}`, 'Ask them to sign up first.'); return; }
    const member: BoardMember = { id: target.id, email, role: 'viewer' };
    setBoardMembers((prev) => ({ ...prev, [boardId]: [...(prev[boardId] ?? []), member] }));
    try { await membersApi.addBoardMember(boardId, target.id, 'viewer'); notifySuccess(`${email} invited`); }
    catch (e) { notifyError('Could not invite member', e); void refreshHub(); }
  };

  const removeBoardMember = async (boardId: string, memberId: string) => {
    if (!can('boards.remove_members')) return;
    const list = boardMembers[boardId] ?? [];
    const target = list.find((m) => m.id === memberId);
    if (target && isMasterEmail(target.email)) return;
    setBoardMembers((prev) => ({ ...prev, [boardId]: (prev[boardId] ?? []).filter((m) => m.id !== memberId) }));
    try { await membersApi.removeBoardMember(boardId, memberId); }
    catch (e) { notifyError('Could not remove member', e); void refreshHub(); }
  };

  const inviteFolderMember = async (folderId: string, email: string) => {
    if (!can('folders.invite_members')) return;
    const target = await resolveInvite(email);
    if (!target) { notifyError(`No user found with email ${email}`, 'Ask them to sign up first.'); return; }
    const member: BoardMember = { id: target.id, email, role: 'viewer' };
    setFolderMembers((prev) => ({ ...prev, [folderId]: [...(prev[folderId] ?? []), member] }));
    try { await membersApi.addFolderMember(folderId, target.id, 'viewer'); notifySuccess(`${email} invited to folder`); }
    catch (e) { notifyError('Could not invite member', e); void refreshHub(); }
  };

  const removeFolderMember = async (folderId: string, memberId: string) => {
    if (!can('folders.remove_members')) return;
    const list = folderMembers[folderId] ?? [];
    const target = list.find((m) => m.id === memberId);
    if (target && isMasterEmail(target.email)) return;
    setFolderMembers((prev) => ({ ...prev, [folderId]: (prev[folderId] ?? []).filter((m) => m.id !== memberId) }));
    try { await membersApi.removeFolderMember(folderId, memberId); }
    catch (e) { notifyError('Could not remove member', e); void refreshHub(); }
  };

  // ── Folder mutations ──────────────────────────────────────────────────────
  // Auto-invite master admin to every new board/folder so they can see all work.
  const autoInviteMaster = async (kind: 'board' | 'folder', resourceId: string): Promise<void> => {
    // The board's creator (`OWNER_EMAIL`) is already the implicit admin of
    // their own board, so if they're also the master no auto-invite is needed.
    if (isMasterEmail(OWNER_EMAIL)) return;
    // Find any master_admin in the directory and auto-invite them. There can
    // be more than one in the future; pick the first.
    const masters = directory.filter((p) => p.role === 'master_admin');
    const master = masters[0];
    if (!master) return;
    try {
      if (kind === 'board') await membersApi.addBoardMember(resourceId, master.id, 'admin');
      else                  await membersApi.addFolderMember(resourceId, master.id, 'admin');
    } catch (e) { notifyError('Could not auto-invite master admin', e); }
  };

  const createFolder = async (name: string) => {
    if (!can('folders.create')) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const created = await foldersApi.createFolder(trimmed);
      const folder = folderFromApi(created);
      setFolders((prev) => [...prev, folder]);
      await autoInviteMaster('folder', folder.id);
    } catch (e) { notifyError('Could not create folder', e); }
  };

  const renameFolder = async (id: string, name: string) => {
    if (!can('folders.edit')) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: trimmed } : f)));
    try { await foldersApi.renameFolder(id, trimmed); }
    catch (e) { notifyError('Could not rename folder', e); void refreshHub(); }
  };

  const deleteFolder = async (id: string) => {
    if (!can('folders.delete')) return;
    const folder = folders.find((f) => f.id === id);
    try {
      if (folder) {
        await recycleApi.pushToRecycleBin('folder', { folder, members: folderMembers[id] ?? [] });
      }
      // Boards inside the folder are detached server-side via ON DELETE SET NULL.
      await foldersApi.deleteFolder(id);
      setBoards((prev) => prev.map((b) => (b.folderId === id ? { ...b, folderId: null } : b)));
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setFolderMembers((prev) => { const { [id]: _drop, ...rest } = prev; return rest; });
    } catch (e) { notifyError('Could not delete folder', e); void refreshHub(); }
  };

  const moveBoardToFolder = async (boardId: string, folderId: string | null) => {
    if (!can('folders.assign_boards')) return;
    setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, folderId } : b)));
    try { await boardsApi.updateBoard(boardId, { folderId }); }
    catch (e) { notifyError('Could not move board', e); void refreshHub(); }
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
  const unloadDemoData = async () => {
    if (!can('data.demo')) return;
    const myBoards = boards.filter((b) => b.ownerEmail.toLowerCase() === myEmail);
    if (myBoards.length === 0) {
      notifyError('Nothing to unload', 'You have no boards yet.');
      return;
    }
    const ok = await confirm({
      title: `Remove ${myBoards.length} board${myBoards.length === 1 ? '' : 's'}?`,
      description: `All prospects in your boards will be permanently deleted. Boards owned by other users won't be touched.`,
      confirmLabel: 'Remove all',
      destructive: true,
    });
    if (!ok) return;
    try {
      // FK ON DELETE CASCADE cleans prospects + memberships server-side.
      for (const b of myBoards) await boardsApi.deleteBoard(b.id);
      // Drop my folders too.
      const myFolders = folders.filter((f) => f.ownerEmail.toLowerCase() === myEmail);
      for (const f of myFolders) await foldersApi.deleteFolder(f.id);
      setActiveBoard(null);
      setView('board');
      await refreshHub();
    } catch (e) { notifyError('Could not remove your boards', e); void refreshHub(); }
  };

  // ── Load 50 × 300 demo dataset — uploads to Supabase board by board ───────
  // Each board does a single chunked insert via importProspects; the api layer
  // chunks 500 rows at a time so even the 300-row boards go in one request.
  const loadDemoData = async () => {
    if (!can('data.demo')) return;
    const ok = await confirm({
      title: 'Load demo data?',
      description: '50 demo project boards with 300 prospects each will be written to your Supabase database (about 15,000 rows total). This takes 20–60 seconds.',
      confirmLabel: 'Load demo',
    });
    if (!ok) return;
    suppressRealtime.current = true;
    setLoadingHub(true);
    try {
      const seed = generateDemoSeed(OWNER_EMAIL, OWNER_NAME, 50, 300);
      const folderIdMap = new Map<string, string>();
      for (const f of seed.folders) {
        const created = await foldersApi.createFolder(f.name);
        folderIdMap.set(f.id, created.id);
      }
      for (const b of seed.boards) {
        const newFolderId = b.folderId ? (folderIdMap.get(b.folderId) ?? null) : null;
        const created = await boardsApi.createBoard({
          name: b.name, location: b.location, color: b.color, folderId: newFolderId,
        });
        const rowsForBoard = seed.prospects[b.id] ?? [];
        if (rowsForBoard.length) {
          await prospectsApi.importProspects(created.id, rowsForBoard, 'append');
        }
      }
    } catch (e) {
      notifyError('Demo data load failed partway through', e);
    } finally {
      suppressRealtime.current = false;
      await refreshHub();
    }
  };

  const totalAll = Object.values(boardProspects).reduce((s, arr) => s + arr.length, 0);

  const deleteBoard = async (id: string) => {
    if (!can('boards.delete')) return;
    const board = boards.find((b) => b.id === id);
    try {
      if (board) {
        await recycleApi.pushToRecycleBin('board', {
          board, prospects: boardProspects[id] ?? [], members: boardMembers[id] ?? [],
        });
      }
      await boardsApi.deleteBoard(id);
      setBoards((prev) => prev.filter((b) => b.id !== id));
      setBoardProspects((prev) => { const { [id]: _drop, ...rest } = prev; return rest; });
      setBoardMembers((prev) => { const { [id]: _drop, ...rest } = prev; return rest; });
      if (activeBoard?.id === id) { setActiveBoard(null); setView('board'); }
    } catch (e) { notifyError('Could not delete board', e); void refreshHub(); }
  };

  const createBoard = async (name: string, location: string, color: string) => {
    if (!can('boards.create')) return;
    try {
      const created = await boardsApi.createBoard({ name, location, color });
      const newBoard = boardFromApi(created);
      setBoards((prev) => [...prev, newBoard]);
      setBoardProspects((prev) => ({ ...prev, [newBoard.id]: [] }));
      await autoInviteMaster('board', newBoard.id);
    } catch (e) { notifyError('Could not create board', e); }
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
  const [filters, setFilters] = useState<Filters>({ callingStatus: [], valid: [], furnishing: [], availability: [], unitStatus: [], agent: [], askingRentRange: [0, RENT_MAX], askingPriceRange: [0, PRICE_MAX] });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [rowMenu, setRowMenu] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAddField, setShowAddField] = useState(false);

  // ── Dynamic columns (base + custom) ──────────────────────────────────────
  // Widths start at the BASE_COLUMNS defaults, then get patched in after
  // `user_preferences.column_widths` loads from Supabase (see the prefs
  // useEffect further down). Resizes write back to that row, so the layout
  // follows the user across devices.
  const [columns, setColumns] = useState<ColDef[]>(() => BASE_COLUMNS.map((c) => ({ ...c })));
  // Custom field values: { rowId: { colKey: value } }
  const [customValues, setCustomValues] = useState<Record<string, Record<string, string>>>({});

  // Debounce column-width writes so dragging a resizer doesn't fire one
  // round-trip per pixel — only the final width hits the DB.
  const colWidthSaveTimer = useRef<number | null>(null);
  const colWidthPending   = useRef<Record<string, number>>({});

  const renameColumn = (key: string, label: string) => {
    if (!can('columns.edit')) return;
    setColumns((prev) => prev.map((c) => c.key === key ? { ...c, label } : c));
  };
  const resizeColumn = (key: string, width: number) => {
    if (!can('columns.resize')) return;
    setColumns((prev) => prev.map((c) => c.key === key ? { ...c, width } : c));
    colWidthPending.current[key] = width;
    if (colWidthSaveTimer.current != null) window.clearTimeout(colWidthSaveTimer.current);
    colWidthSaveTimer.current = window.setTimeout(() => {
      // Merge into the latest snapshot of all custom widths so a partial
      // save doesn't wipe widths the user resized earlier in the session.
      const widths: Record<string, number> = {};
      for (const c of columnsRef.current) widths[c.key] = c.width;
      Object.assign(widths, colWidthPending.current);
      colWidthPending.current = {};
      colWidthSaveTimer.current = null;
      void prefsApi.saveUserPreferences({ columnWidths: widths }).catch(() => { /* non-critical */ });
    }, 400);
  };
  const deleteColumn = (key: string) => {
    if (!can('columns.delete')) return;
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
    if (!can('columns.create')) return;
    const key = `custom_${Date.now()}`;
    const colType: ColType = type === 'dropdown' ? 'custom-select' : 'text';
    setColumns((prev) => [...prev, { key, label, width: 160, type: colType, fixed: false, placeholder: type === 'text' ? 'Add…' : undefined, options: type === 'dropdown' ? options : undefined }]);
  };

  // ── Space-pan ─────────────────────────────────────────────────────────────
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const isPanning = useSpacePan(gridScrollRef);

  // View → Locked/Unlocked. Unlocked enables click-drag panning + zoom
  // controls so the grid behaves like a canvas. Persisted per-user in
  // Supabase via `user_preferences` — synced through the boot effect below.
  const [viewUnlocked, setViewUnlocked] = useState<boolean>(false);
  const [gridZoom, setGridZoom]         = useState<number>(1);
  const canPanZoom = can('view.pan_zoom');
  // Only enable drag-pan when both the permission and the unlock toggle are on.
  const isDragPanning = useDragPan(gridScrollRef, canPanZoom && viewUnlocked);

  // ── WhatsApp templates (per-user, Supabase-backed) ────────────────────
  const [waTemplates, setWaTemplates]   = useState<WaTemplate[]>([]);
  const [waLang, setWaLang]             = useState<WaLang>('en');
  const [showWaTemplates, setShowWaTemplates] = useState(false);
  const canManageWaTemplates = can('whatsapp.manage_templates');
  const canSendWa            = can('whatsapp.send');

  // ── User-pref boot + persistence ────────────────────────────────────────
  // One round-trip on mount pulls column widths, view state, WA templates
  // and lang. After that, mutations write through to the DB. `prefsReady`
  // gates the save effects so we don't clobber the just-loaded row with
  // the initial defaults during the first render.
  const columnsRef = useRef(columns);
  useEffect(() => { columnsRef.current = columns; }, [columns]);
  const prefsReady = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Lift any pre-migration `we.*` keys still in localStorage into the
        // user_preferences row before we read it back. After this runs
        // once per device, the localStorage keys are gone and this becomes
        // a no-op on subsequent boots.
        const migrated = await prefsApi.migrateLegacyLocalPrefs();
        if (migrated > 0) notifySuccess(`Restored ${migrated} preference${migrated === 1 ? '' : 's'} from this device`);
        const p = await prefsApi.loadUserPreferences();
        if (cancelled) return;
        // Patch the column defaults with the user's saved widths.
        if (Object.keys(p.columnWidths).length > 0) {
          setColumns((prev) => prev.map((c) => (p.columnWidths[c.key] != null ? { ...c, width: p.columnWidths[c.key] } : c)));
        }
        setViewUnlocked(p.viewUnlocked);
        // Clamp to the same range the zoom buttons enforce, so a corrupt
        // value can't break the UI.
        const z = p.viewZoom;
        setGridZoom(Number.isFinite(z) && z >= 0.5 && z <= 2 ? z : 1);
        // First-time users get the factory templates. We persist them so
        // the editor doesn't open empty on the next visit.
        if (p.waTemplates.length === 0) {
          setWaTemplates(DEFAULT_WA_TEMPLATES);
          void prefsApi.saveUserPreferences({ waTemplates: DEFAULT_WA_TEMPLATES });
        } else {
          setWaTemplates(p.waTemplates);
        }
        setWaLang(p.waLang);
      } catch { /* offline / first-boot — keep defaults */ }
      finally { if (!cancelled) prefsReady.current = true; }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!prefsReady.current) return;
    void prefsApi.saveUserPreferences({ viewUnlocked }).catch(() => { /* non-critical */ });
  }, [viewUnlocked]);
  useEffect(() => {
    if (!prefsReady.current) return;
    void prefsApi.saveUserPreferences({ viewZoom: gridZoom }).catch(() => { /* non-critical */ });
  }, [gridZoom]);
  useEffect(() => {
    if (!prefsReady.current) return;
    void prefsApi.saveUserPreferences({ waLang }).catch(() => { /* non-critical */ });
  }, [waLang]);

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

  // ── Agent filter dropdown options.
  // Combines the workspace-wide preset list with any agent names that appear
  // on existing rows — so presets are pickable even before they've been
  // assigned, and legacy free-text agents stay surfaced.
  const agentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of agentPresets) {
      const name = p.name.trim();
      if (name) set.add(name);
    }
    for (const r of rows) {
      const a = r.agent.trim();
      if (a) set.add(a);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows, agentPresets]);

  // ── Bucket the workspace dropdown_presets by field for O(1) lookup in
  //    cell renders and filter chips.
  const dropdownPresetsByField = useMemo(() => {
    const out: Record<DropdownField, DropdownPreset[]> = {
      calling_status: [], listing_type: [], furnishing: [], availability: [], unit_status: [],
    };
    for (const p of dropdownPresets) {
      if (out[p.field]) out[p.field].push(p);
    }
    // Each field preserves the DB `position` ordering (already sorted by API).
    return out;
  }, [dropdownPresets]);

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
    const validSet   = new Set(filters.valid);
    const furnishSet = new Set(filters.furnishing);
    const availSet   = new Set(filters.availability);
    const unitStSet  = new Set(filters.unitStatus);
    const agentSet   = new Set(filters.agent);
    const fullRent  = filters.askingRentRange[0]  === 0 && filters.askingRentRange[1]  === RENT_MAX;
    const fullPrice = filters.askingPriceRange[0] === 0 && filters.askingPriceRange[1] === PRICE_MAX;
    return rows.filter((r) => {
      const matchSearch = !q || r.name.toLowerCase().includes(q) || r.unitNo.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q);
      if (!matchSearch) return false;
      const matchQuick   = quickView === 'All' || r.listingType.split(',').map((s) => s.trim()).includes(quickView);
      if (!matchQuick) return false;
      if (callingSet.size > 0 && !callingSet.has(r.callingStatus)) return false;
      if (validSet.size   > 0 && !validSet.has(r.valid))           return false;
      if (furnishSet.size > 0 && !furnishSet.has(r.furnishing))    return false;
      if (availSet.size   > 0 && !availSet.has(r.availability))    return false;
      if (unitStSet.size  > 0 && !unitStSet.has(r.unitStatus))     return false;
      if (agentSet.size   > 0 && !agentSet.has(r.agent))           return false;
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
    if (!can('rows.edit')) return;
    if (key === 'lastUpdate') {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, lastUpdate: value as string } : r)));
      return;
    }
    if (key === 'agent') {
      const stamp = nowMyt();
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, agent: value as string, lastUpdate: stamp } : r)));
      // `agent` is not mapped to a DB column in api/prospects FIELD_MAP — skip server write.
      return;
    }
    const stamp = nowMyt();
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value, lastUpdate: stamp } : r)));
    void prospectsApi.updateProspectField(id, key, value).catch((e) => {
      notifyError('Could not save the cell change', e);
      void refreshHub();
    });
  };

  const updateCustom = (rowId: string, colKey: string, value: string) => {
    if (!can('rows.edit')) return;
    const stamp = nowMyt();
    setCustomValues((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] ?? {}), [colKey]: value },
    }));
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, lastUpdate: stamp } : r)));
    // Custom-field write to Supabase — only fires once the field is actually
    // a real DB-backed custom_fields row (synthetic local-only keys, which
    // start with `custom_`, may not have a server id yet).
    if (!colKey.startsWith('custom_')) {
      void import('@/api/custom-fields').then((m) => m.setCustomValue(rowId, colKey, value))
        .catch((e) => console.error('setCustomValue', e));
    }
  };

  const setCellValue = (rowId: string, colKey: string, value: string) => {
    const isSystemKey = BASE_COLUMNS.some((c) => c.key === colKey);
    if (isSystemKey) {
      updateRow(rowId, colKey as keyof Prospect, value as Prospect[keyof Prospect]);
    } else {
      updateCustom(rowId, colKey, value);
    }
  };

  const addRow = async () => {
    if (!can('rows.create')) return;
    // Adding a row requires an active board to attach it to — folder-aggregate
    // view drops new rows into the first board in the folder.
    const targetBoardId =
      activeBoard?.id
      ?? (folderView && folderViewBoardIds.length ? folderViewBoardIds[0] : null);
    if (!targetBoardId) {
      notifyError('Open a board first', 'Prospect rows need to live in a board.');
      return;
    }
    try {
      const created = await prospectsApi.createProspect(targetBoardId);
      setRows((prev) => [...prev, created]);
      setTimeout(() => {
        const el = gridScrollRef.current;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }, 50);
    } catch (e) { notifyError('Could not add prospect row', e); }
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
  const pushProspectsToBin = async (ids: string[]) => {
    for (const id of ids) {
      const prospect = rows.find((r) => r.id === id);
      if (!prospect) continue;
      try {
        await recycleApi.pushToRecycleBin('prospect', {
          boardId: prospectHomeBoardId(id), prospect, customValues: customValues[id] ?? {},
        });
      } catch (e) { notifyError('Could not move item to recycle bin', e); }
    }
  };

  const deleteRow = async (id: string) => {
    if (!can('rows.delete')) return;
    await pushProspectsToBin([id]);
    setRows((p) => p.filter((r) => r.id !== id));
    setSelectedRows((p) => { const s = new Set(p); s.delete(id); return s; });
    setCustomValues((p) => { const n = { ...p }; delete n[id]; return n; });
    try { await prospectsApi.deleteProspect(id); }
    catch (e) { notifyError('Could not delete prospect', e); void refreshHub(); }
  };
  const deleteSelected = async () => {
    if (!can('rows.bulk_delete')) return;
    const ids = Array.from(selectedRows);
    await pushProspectsToBin(ids);
    setRows((p) => p.filter((r) => !selectedRows.has(r.id)));
    setCustomValues((p) => {
      const n = { ...p };
      selectedRows.forEach((id) => delete n[id]);
      return n;
    });
    setSelectedRows(new Set());
    try { await prospectsApi.deleteProspects(ids); }
    catch (e) { notifyError('Could not delete selected prospects', e); void refreshHub(); }
  };
  // ── Recycle Bin: restore + permanently purge ──────────────────────────────
  // Restore is best-effort: the DB has already cascaded the deletes, so we
  // recreate the snapshot in fresh rows and drop the bin entry.
  const restoreFromBin = async (id: string) => {
    if (!can('recycle.restore')) return;
    const item = recycleBin.find((x) => x.id === id);
    if (!item) return;
    try {
      if (item.kind === 'board') {
        const p = item.payload as { board: Board; prospects: Prospect[]; members: BoardMember[] };
        const created = await boardsApi.createBoard({
          name: p.board.name, location: p.board.location, color: p.board.color, folderId: p.board.folderId,
        });
        if (p.prospects.length) {
          await prospectsApi.importProspects(created.id, p.prospects, 'append');
        }
        for (const m of p.members) {
          const target = profileByEmail.get(m.email.toLowerCase());
          if (target) await membersApi.addBoardMember(created.id, target.id, m.role as membersApi.MemberRole);
        }
      } else if (item.kind === 'folder') {
        const p = item.payload as { folder: Folder; members: BoardMember[] };
        const created = await foldersApi.createFolder(p.folder.name);
        for (const m of p.members) {
          const target = profileByEmail.get(m.email.toLowerCase());
          if (target) await membersApi.addFolderMember(created.id, target.id, m.role as membersApi.MemberRole);
        }
      } else if (item.kind === 'prospect') {
        const p = item.payload as { boardId: string; prospect: Prospect; customValues: Record<string, string> };
        if (p.boardId !== '__default__') {
          await prospectsApi.importProspects(p.boardId, [p.prospect], 'append');
        }
      }
      await recycleApi.purgeRecycleItem(id);
      setRecycleBin((prev) => prev.filter((x) => x.id !== id));
      await refreshHub();
    } catch (e) { notifyError('Could not restore item', e); void refreshHub(); }
  };
  const purgeFromBin = async (id: string) => {
    if (!can('recycle.purge')) return;
    setRecycleBin((prev) => prev.filter((x) => x.id !== id));
    try { await recycleApi.purgeRecycleItem(id); }
    catch (e) { notifyError('Could not purge item', e); void refreshHub(); }
  };
  const emptyBin = async () => {
    if (!can('recycle.purge')) return;
    setRecycleBin([]);
    try { await recycleApi.purgeAllRecycleItems(); }
    catch (e) { notifyError('Could not empty recycle bin', e); void refreshHub(); }
  };

  const duplicateRow = async (id: string) => {
    if (!can('rows.duplicate')) return;
    const src = rows.find((r) => r.id === id);
    if (!src) return;
    try {
      const created = await prospectsApi.duplicateProspect(id);
      setRows((prev) => { const idx = prev.findIndex((r) => r.id === id); const next = [...prev]; next.splice(idx + 1, 0, created); return next; });
      if (customValues[id]) setCustomValues((p) => ({ ...p, [created.id]: { ...p[id] } }));
    } catch (e) { notifyError('Could not duplicate prospect', e); }
    setRowMenu(null);
  };

  // ── Import to Clients module ─────────────────────────────────────────────
  // Snapshots a prospect row into the Clients module so it can carry follow-up
  // state and tasks. Idempotent on prospectId — the server-side RPC refreshes
  // snapshot fields when re-imported.
  const [importedClients, setImportedClients] = useState<Client[]>([]);
  const importedProspectIds = useMemo(
    () => new Set(importedClients.map((c) => c.prospectId).filter(Boolean) as string[]),
    [importedClients],
  );
  useEffect(() => { listClients().then(setImportedClients).catch(() => {}); }, []);

  const [importToast, setImportToast] = useState<{ name: string; created: boolean } | null>(null);

  const importRowAsClient = async (id: string) => {
    const src = rows.find((r) => r.id === id);
    if (!src) return;
    try {
      const wasImported = importedProspectIds.has(src.id);
      const client = await importFromProspect(src.id);
      const fresh = await listClients();
      setImportedClients(fresh);
      setImportToast({ name: client.name, created: !wasImported });
    } catch (err) {
      notifyError('Could not import to Clients', err);
      setImportToast({ name: src.name || 'client', created: false });
    }
    setRowMenu(null);
    setTimeout(() => setImportToast(null), 2800);
  };

  const toggleRow   = (id: string) => setSelectedRows((p) => { const s = new Set(p); if (s.has(id)) s.delete(id); else s.add(id); return s; });
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
  // Imports always target a real board on the server; folder-aggregate mode
  // imports into the first board in the folder. Default-rows view (no board
  // open) gets a friendly error.
  const handleImport = async (imported: Prospect[], mode: ImportMode) => {
    if (!can('data.import')) return;
    const targetBoardId =
      activeBoard?.id
      ?? (folderView && folderViewBoardIds.length ? folderViewBoardIds[0] : null);
    if (!targetBoardId) {
      notifyError('Open a board first', 'Import targets a single board.');
      return;
    }
    try {
      const rowsWithoutId = imported.map(({ id: _omit, ...rest }) => rest);
      await prospectsApi.importProspects(targetBoardId, rowsWithoutId, mode === 'replace' ? 'replace' : 'append');
      await refreshHub();
    } catch (e) {
      notifyError('Import failed', e);
    } finally {
      setShowImport(false);
    }
  };

  const totalWidth = columns.reduce((s, c) => s + c.width, 0) + 40 + 40 + 80; // +checkbox +rowNo +addfield

  // Banner shows whenever the real master admin is previewing as a different role.
  const realRole    = actualAppRole(me?.email);
  const isPreviewing = realRole === 'master_admin' && myRole !== 'master_admin';
  const previewDef  = APP_ROLES.find((r) => r.id === myRole);

  // Empty-state branches — show a friendly screen until data hydrates AND
  // a separate one for users who genuinely have nothing yet (fresh signup,
  // no boards owned, no boards invited to).
  const hubIsTrulyEmpty =
    !loadingHub
    && boards.length === 0
    && visibleBoards.length === 0
    && visibleFolders.length === 0
    && view === 'board';
  const canCreateAnything = can('boards.create') || can('folders.create');

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
            onClick={() => setViewAsRole(null)}
            className="ml-auto px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-white/20 transition-colors">
            Stop preview
          </button>
        </div>
      )}

      {/* ── Loading state — shown while the first refreshHub() is in flight.
            Prevents the "blank screen flash" right after signup/login. ── */}
      {loadingHub && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin" style={{ color: '#1EC9C4' }} />
            <p className="text-sm" style={{ color: '#9CA3AF' }}>Loading your boards…</p>
          </div>
        </div>
      )}

      {/* ── Friendly empty state for fresh-signup users with zero boards.
            Distinct from the "you have boards but the list is empty in this
            filter" state, which the board overview handles itself. ── */}
      {hubIsTrulyEmpty && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md w-full bg-white rounded-2xl border p-8 text-center" style={{ borderColor: '#F1F5F9' }}>
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ background: '#DAF3F2' }}>
              <Target size={26} style={{ color: '#0F766E' }} />
            </div>
            <h2 className="text-lg font-bold" style={{ color: '#1A202C' }}>Nothing here yet</h2>
            <p className="text-sm mt-2" style={{ color: '#6B7280' }}>
              {canCreateAnything
                ? <>You don't have any boards yet. Create your first one to start tracking prospects.</>
                : <>You haven't been invited to any boards yet. Ask your master admin to invite you, or to grant your role permission to create boards.</>}
            </p>
            {can('boards.create') && (
              <button
                onClick={() => setShowNewBoard(true)}
                className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
                style={{ background: '#1EC9C4' }}>
                <Plus size={14} strokeWidth={2.5} /> New Board
              </button>
            )}
            {!canCreateAnything && (
              <p className="text-[11px] mt-4" style={{ color: '#9CA3AF' }}>
                Signed in as <strong>{me?.email}</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Hide the rest of the hub while the loader or empty state is showing. */}
      {!loadingHub && !hubIsTrulyEmpty && (<>
      {/* ── Toolbar (grid view only) ──────────────────────────────── */}
      {/* `flex-wrap` lets the right-side actions (Filter / View / Import /
          Export) drop to a second row on narrow viewports instead of
          getting clipped off the right edge. The `flex-1` spacer is
          replaced with `ml-auto` on the first action so wrapping doesn't
          leave a phantom-wide gap on its own row. */}
      {view === 'grid' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
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

          {/* Search — gated by view.filter (the catalog covers both
              "filters and search" under one key on purpose). */}
          {can('view.filter') && (
            <div className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1.5 bg-white flex-1 max-w-xs focus-within:border-[#1EC9C4] transition-colors">
              <Search size={13} style={{ color: '#A1A9B6' }} />
              <input className="flex-1 text-xs outline-none bg-transparent placeholder:text-gray-300" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')}><X size={11} className="text-gray-300 hover:text-gray-500" /></button>}
            </div>
          )}

          {/* Right-side action group — `ml-auto` pushes it as far right as
              the current row allows, and on narrow viewports it wraps to a
              second row instead of being clipped. */}
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
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
              {(filters.callingStatus.length > 0 || filters.valid.length > 0 || filters.furnishing.length > 0 || filters.availability.length > 0 || filters.unitStatus.length > 0 || filters.agent.length > 0) && <span className="w-2 h-2 rounded-full bg-[#1EC9C4]" />}
            </button>
          )}

          {/* View — locked = normal interactions; unlocked = drag-to-pan + zoom.
              Rendered as a single segment-control so the buttons always read
              as one unit. Each segment carries its own border so the dividers
              are consistent and the heights match. */}
          {canPanZoom && (() => {
            const baseBorder    = viewUnlocked ? '#1EC9C4' : '#E5E7EB';
            const segBg         = viewUnlocked ? '#DAF3F2' : '#FFFFFF';
            const segText       = viewUnlocked ? '#1EC9C4' : '#6B7280';
            const segHover      = viewUnlocked ? 'hover:bg-[#CDEFEC]' : 'hover:bg-gray-50';
            const segClass = `inline-flex items-center justify-center h-7 px-2.5 border-y text-xs font-semibold transition-colors ${segHover} disabled:opacity-40 disabled:cursor-not-allowed`;
            return (
              <div className="inline-flex items-stretch flex-shrink-0 rounded-lg overflow-hidden"
                style={{ border: `1px solid ${baseBorder}` }}>
                <button
                  onClick={() => setViewUnlocked((v) => !v)}
                  title={viewUnlocked ? 'Lock view (return to normal interactions)' : 'Unlock view (drag to pan, zoom in/out)'}
                  className={`inline-flex items-center gap-1.5 h-7 px-3 ${segHover} transition-colors`}
                  style={{ background: segBg, color: segText, borderRight: `1px solid ${baseBorder}` }}>
                  {viewUnlocked ? <Unlock size={12} /> : <Lock size={12} />}
                  <span className="text-xs font-semibold leading-none">View</span>
                </button>
                <button onClick={() => setGridZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 100) / 100))}
                  disabled={!viewUnlocked || gridZoom <= 0.5}
                  title="Zoom out"
                  className={segClass}
                  style={{ background: segBg, color: segText, borderColor: baseBorder, borderRight: `1px solid ${baseBorder}`, minWidth: 26 }}>
                  −
                </button>
                <button onClick={() => setGridZoom(1)}
                  disabled={!viewUnlocked}
                  title="Reset zoom"
                  className={`${segClass} tabular-nums`}
                  style={{ background: segBg, color: segText, borderColor: baseBorder, borderRight: `1px solid ${baseBorder}`, minWidth: 44 }}>
                  {Math.round(gridZoom * 100)}%
                </button>
                <button onClick={() => setGridZoom((z) => Math.min(2, Math.round((z + 0.1) * 100) / 100))}
                  disabled={!viewUnlocked || gridZoom >= 2}
                  title="Zoom in"
                  className={segClass}
                  style={{ background: segBg, color: segText, borderColor: baseBorder, minWidth: 26 }}>
                  +
                </button>
              </div>
            );
          })()}

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
            const visibleIds = new Set(newVisible.map((b) => b.id));
            const invisible = boards.filter((b) => !visibleIds.has(b.id));
            const next = [...newVisible, ...invisible];
            setBoards(next);
            void boardsApi.reorderBoards(next.map((b) => b.id))
              .catch((e) => { notifyError('Could not save new board order', e); void refreshHub(); });
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
            onChange: (next) => { setViewAsRole(next); },
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
      {view === 'grid' && showFilter && (
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          agentOptions={agentOptions}
          callingOptions={dropdownPresetsByField.calling_status.map((p) => p.value)}
          conditionOptions={dropdownPresetsByField.furnishing.map((p) => p.value)}
          availabilityOptions={dropdownPresetsByField.availability.map((p) => p.value)}
          unitStatusOptions={dropdownPresetsByField.unit_status.map((p) => p.value)}
          onClose={() => setShowFilter(false)}
        />
      )}

      {/* ── Grid (grid only) ────────────────────────────────────────────── */}
      {view === 'grid' && (() => {
        // Prepend a "Project" column when in folder-aggregate view so each row
        // shows which board it's from (read-only, with the board's color dot).
        const displayColumns: ColDef[] = folderView
          ? [{ key: 'projectName', label: 'Project', width: 180, type: 'readonly', fixed: true }, ...columns]
          : columns;
        const displayTotalWidth = displayColumns.reduce((s, c) => s + c.width, 0) + 40 + 40 + 80;

        // ── Frozen left columns ────────────────────────────────────────────
        // Sticky-pin the identifier columns (and the checkbox/row-# rail) so
        // they stay visible when scrolling horizontally. The frozen set ends
        // at Phone — matching the existing teal divider that already separated
        // identity columns from data columns.
        const FROZEN_KEYS = folderView
          ? ['projectName', 'name', 'unitNo', 'type', 'size', 'phone']
          : ['name', 'unitNo', 'type', 'size', 'phone'];
        const FROZEN_BASE_OFFSET = 80; // checkbox(40) + row #(40)
        const frozenLeftMap = new Map<string, number>();
        {
          let cum = FROZEN_BASE_OFFSET;
          for (const col of displayColumns) {
            if (FROZEN_KEYS.includes(col.key)) {
              frozenLeftMap.set(col.key, cum);
              cum += col.width;
            }
          }
        }
        const isFrozenCol = (key: string) => frozenLeftMap.has(key);
        // z-index ladder: header non-frozen > header frozen-intersection
        //   header (top:0)             = 10
        //   header frozen-intersection = 20  (must beat scrolling non-frozen body & header)
        //   body frozen cell           = 5
        //   body non-frozen cell       = 0 (default)
        const Z_HEADER         = 10;
        const Z_HEADER_FROZEN  = 20;
        const Z_BODY_FROZEN    = 5;

        // Virtualization window: only render rows that fall in the current viewport
        // (plus a small overscan above and below for smoother scroll).
        //
        // CSS `zoom` scales the rendered row height, so a 37px row at 80% zoom
        // takes ~29.6px in the scroll container's coordinate space. scrollTop /
        // clientHeight are in the container's (post-zoom) coords, so divide
        // ROW_HEIGHT_PX × zoom to get the right index. Topbar / bottompad
        // spacers stay in natural row coords — they're inside the zoomed table,
        // so the zoom scales them automatically.
        const totalRows       = filtered.length;
        const effectiveRowPx  = ROW_HEIGHT_PX * gridZoom;
        const startIdx   = Math.max(0, Math.floor(scrollTop / effectiveRowPx) - ROW_OVERSCAN);
        const endIdx     = Math.min(totalRows, Math.ceil((scrollTop + viewportH) / effectiveRowPx) + ROW_OVERSCAN);
        const visibleRows = filtered.slice(startIdx, endIdx);
        const topPad     = startIdx * ROW_HEIGHT_PX;
        const bottomPad  = Math.max(0, (totalRows - endIdx) * ROW_HEIGHT_PX);
        const spacerColSpan = displayColumns.length + 3;
        return (
        <div ref={gridScrollRef} className="flex-1 overflow-auto"
        style={{
          cursor: (isDragPanning || isPanning) ? 'grabbing' : viewUnlocked ? 'grab' : 'default',
          userSelect: (isDragPanning || isPanning) ? 'none' : undefined,
        }}>
        {/* `border-collapse: separate` keeps each cell on its own paint layer —
            required so sticky frozen cells render their borders consistently
            (collapse-mode shares borders between cells, which corrupts the
            teal Phone divider and column lines once cells become sticky).
            `zoom` is the simplest "make whole sheet bigger/smaller" — every
            modern browser scales layout + scrollable bounds together, which
            keeps the existing virtualisation math correct. */}
        <table style={{ minWidth: displayTotalWidth, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', width: displayTotalWidth, zoom: gridZoom }}>
          <colgroup>
            <col style={{ width: 40 }} />
            <col style={{ width: 40 }} />
            {displayColumns.map((c) => <col key={c.key} style={{ width: c.width }} />)}
            <col style={{ width: 80 }} />
          </colgroup>

          {/* ── Header row ── */}
          {/* `position:sticky` lives on each <th> (not the <tr>) so a header
              cell can be both top-sticky (frozen header) and left-sticky
              (frozen column) at the same time. */}
          <thead>
            {/* With border-collapse:separate the <tr>'s borderBottom no longer
                paints — we put a heavier borderBottom on every <th> instead. */}
            <tr style={{ background: '#F8FAFB' }}>
              <th
                style={{
                  width: 40,
                  borderRight: '1px solid #E5E7EB',
                  borderBottom: '2px solid #E5E7EB',
                  position: 'sticky', top: 0, left: 0, zIndex: Z_HEADER_FROZEN,
                  background: '#F8FAFB',
                }}
                className="px-2 py-2.5">
                <input type="checkbox" checked={selectedRows.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll} className="w-3.5 h-3.5 rounded accent-[#1EC9C4] cursor-pointer" />
              </th>
              <th
                style={{
                  width: 40,
                  borderRight: '2px solid #1EC9C4',
                  borderBottom: '2px solid #E5E7EB',
                  color: '#A1A9B6', fontSize: 11, fontWeight: 600,
                  position: 'sticky', top: 0, left: 40, zIndex: Z_HEADER_FROZEN,
                  background: '#F8FAFB',
                }}
                className="px-2 py-2.5 text-center">#</th>

              {displayColumns.map((col) => {
                const frozen = isFrozenCol(col.key);
                // The synthesised "Project" column in folder view isn't part of
                // the real column list, so it can't be resized (no persistence
                // target). Everything else is resizable when the perm is held.
                const resizable = can('columns.resize') && col.key !== 'projectName';
                return (
                  <th key={col.key}
                    style={{
                      borderRight: col.key === 'phone' ? '2px solid #1EC9C4' : '1px solid #E5E7EB',
                      borderBottom: '2px solid #E5E7EB',
                      fontWeight: 600, fontSize: 11, color: '#6B7280',
                      padding: '6px 8px', whiteSpace: 'nowrap',
                      position: 'sticky',
                      top: 0,
                      // Every sticky th needs an opaque background — once it's on
                      // its own paint layer, the <tr>'s background no longer
                      // shows through and body cells scroll visibly under it.
                      background: '#F8FAFB',
                      ...(frozen ? { left: frozenLeftMap.get(col.key), zIndex: Z_HEADER_FROZEN } : { zIndex: Z_HEADER }),
                    }}>
                    <HeaderCell col={col} onRename={renameColumn} onDelete={deleteColumn} canEdit={can('columns.edit')} canDelete={can('columns.delete')} />
                    {resizable && (
                      <ColumnResizer width={col.width} onResize={(w) => resizeColumn(col.key, w)} />
                    )}
                  </th>
                );
              })}

              {/* Add Field button — gated by columns.create */}
              <th
                style={{
                  borderLeft: '1px solid #E5E7EB',
                  borderBottom: '2px solid #E5E7EB',
                  width: 80,
                  position: 'sticky', top: 0, zIndex: Z_HEADER, background: '#F8FAFB',
                }}
                className="px-2 py-2.5">
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
                  style={{ background: rowBg }}
                  className="group hover:bg-blue-50/60 transition-colors">

                  {/* Checkbox */}
                  <td
                    style={{
                      width: 40,
                      borderRight: '1px solid #E5E7EB',
                      borderBottom: '1px solid #E5E7EB',
                      position: 'sticky', left: 0, zIndex: Z_BODY_FROZEN,
                      background: rowBg,
                    }}
                    className="px-2 py-0 h-9 text-center">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleRow(row.id)}
                      className="w-3.5 h-3.5 rounded accent-[#1EC9C4] cursor-pointer" />
                  </td>

                  {/* Row number + menu */}
                  <td
                    style={{
                      width: 40,
                      borderRight: '2px solid #1EC9C4',
                      borderBottom: '1px solid #E5E7EB',
                      fontSize: 11, color: '#A1A9B6', textAlign: 'center',
                      position: 'sticky', left: 40, zIndex: Z_BODY_FROZEN,
                      background: rowBg,
                    }}
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
                    const frozen = isFrozenCol(col.key);
                    // Sticky cells need their own background — the <tr> bg falls
                    // behind once the cell is on its own paint layer. Mirror the
                    // row's stripe (or fill/select tint) onto the cell itself.
                    const cellBg = isFilling ? 'rgba(59,130,246,0.06)' : frozen ? rowBg : undefined;

                    return (
                      <td
                        key={col.key}
                        data-rowid={row.id}
                        data-colkey={col.key}
                        onClick={() => setActiveCell({ rowId: row.id, colKey: col.key })}
                        style={{
                          height: 36, padding: 0,
                          borderRight: col.key === 'phone' ? '2px solid #1EC9C4' : '1px solid #E5E7EB',
                          borderBottom: '1px solid #E5E7EB',
                          verticalAlign: 'middle',
                          outline: isActive ? '2px solid #1EC9C4' : isFilling ? '2px solid #3B82F6' : 'none',
                          outlineOffset: '-2px',
                          background: cellBg,
                          ...(frozen
                            ? { position: 'sticky', left: frozenLeftMap.get(col.key), zIndex: Z_BODY_FROZEN }
                            : { position: 'relative' }),
                        }}>

                        {/* Select cells — all single-select dropdowns share one
                            component; presets + colours come from the workspace
                            `dropdown_presets` table. */}
                        {col.type === 'select' && col.selectKey === 'callingStatus' && (
                          <CustomDropdown value={row.callingStatus}
                            presets={dropdownPresetsByField.calling_status}
                            canManage={can('dropdowns.manage')} canRemove={can('dropdowns.remove_options')}
                            onChange={(v) => updateRow(row.id, 'callingStatus', v as CallingStatus)}
                            onAddPreset={(label, color) => addDropdownPreset('calling_status', label, color)}
                            onRemovePreset={removeDropdownPreset} />
                        )}
                        {col.type === 'select' && col.selectKey === 'listingType' && (
                          <CustomMultiDropdown value={row.listingType}
                            presets={dropdownPresetsByField.listing_type}
                            canManage={can('dropdowns.manage')} canRemove={can('dropdowns.remove_options')}
                            onChange={(v) => updateRow(row.id, 'listingType', v)}
                            onAddPreset={(label, color) => addDropdownPreset('listing_type', label, color)}
                            onRemovePreset={removeDropdownPreset} />
                        )}
                        {col.type === 'select' && col.selectKey === 'furnishing' && (
                          <CustomDropdown value={row.furnishing}
                            presets={dropdownPresetsByField.furnishing}
                            canManage={can('dropdowns.manage')} canRemove={can('dropdowns.remove_options')}
                            onChange={(v) => updateRow(row.id, 'furnishing', v as Furnishing)}
                            onAddPreset={(label, color) => addDropdownPreset('furnishing', label, color)}
                            onRemovePreset={removeDropdownPreset} />
                        )}
                        {col.type === 'select' && col.selectKey === 'availability' && (
                          <CustomDropdown value={row.availability}
                            presets={dropdownPresetsByField.availability}
                            canManage={can('dropdowns.manage')} canRemove={can('dropdowns.remove_options')}
                            onChange={(v) => updateRow(row.id, 'availability', v as Availability)}
                            onAddPreset={(label, color) => addDropdownPreset('availability', label, color)}
                            onRemovePreset={removeDropdownPreset} />
                        )}
                        {col.type === 'select' && col.selectKey === 'valid' &&
                          <ValidDropdown value={row.valid} onChange={(v) => updateRow(row.id, 'valid', v)} />}
                        {col.type === 'select' && col.selectKey === 'unitStatus' && (
                          <CustomDropdown value={row.unitStatus}
                            presets={dropdownPresetsByField.unit_status}
                            canManage={can('dropdowns.manage')} canRemove={can('dropdowns.remove_options')}
                            onChange={(v) => updateRow(row.id, 'unitStatus', v)}
                            onAddPreset={(label, color) => addDropdownPreset('unit_status', label, color)}
                            onRemovePreset={removeDropdownPreset} />
                        )}

                        {/* Custom-select cells */}
                        {col.type === 'custom-select' && (
                          <CustomSelectCell
                            value={getCellValue(row, col.key)}
                            options={col.options ?? []}
                            onChange={(v) => updateCustom(row.id, col.key, v)}
                          />
                        )}

                        {/* Text cells — double-click to edit */}
                        {col.type === 'text' && col.key !== 'phone' && (
                          <TextCell
                            value={cellValue}
                            onChange={(v) => setCellValue(row.id, col.key, v)}
                            align={col.align ?? 'left'}
                            mono={col.mono ?? false}
                            placeholder={col.placeholder ?? ''}
                          />
                        )}

                        {/* Phone cell — same TextCell as other text cells, but
                            with a WhatsApp button overlay on hover that opens
                            wa.me?text=Hi <name>, in a new tab. */}
                        {col.type === 'text' && col.key === 'phone' && (
                          <PhoneCell
                            row={row}
                            onChange={(v) => setCellValue(row.id, col.key, v)}
                            agentName={OWNER_NAME}
                            // Folder-aggregate view: each row may live in a
                            // different board, so resolve via the row→board
                            // map. Single-board view: just the active board.
                            boardName={folderView
                              ? (prospectToBoard.get(row.id)?.name ?? '')
                              : (activeBoard?.name ?? '')}
                            templates={waTemplates}
                            lang={waLang}
                            onLangChange={setWaLang}
                            canSend={canSendWa}
                            onManageTemplates={canManageWaTemplates ? () => setShowWaTemplates(true) : undefined}
                            align={col.align ?? 'left'}
                            mono={col.mono ?? false}
                            placeholder={col.placeholder ?? ''}
                          />
                        )}

                        {/* Project column — folder-aggregate view only */}
                        {col.type === 'readonly' && col.key === 'projectName' && (
                          <div className="w-full flex items-center gap-2 px-2" style={{ minHeight: 36 }}>
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
                          <div className="w-full flex items-center px-2" style={{ minHeight: 36 }}>
                            <span className="text-xs truncate" style={{
                              fontFamily: col.mono ? 'JetBrains Mono, monospace' : undefined,
                              color: cellValue ? '#6B7280' : '#D1D5DB',
                            }}>
                              {cellValue || '—'}
                            </span>
                          </div>
                        )}

                        {/* Fill handle dot — bottom-right corner of active cell.
                            Hidden entirely when the role lacks rows.edit, so
                            read-only viewers don't see a misleading affordance. */}
                        {isActive && (col.type === 'text') && can('rows.edit') && (
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

                  <td style={{ borderLeft: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }} />
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

      {showWaTemplates && (
        <WaTemplatesModal
          initial={waTemplates}
          onSave={(next) => {
            setWaTemplates(next);
            void prefsApi.saveUserPreferences({ waTemplates: next }).catch(() => { /* non-critical */ });
          }}
          onClose={() => setShowWaTemplates(false)}
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
      </>)}

      {/* NewBoardModal lives OUTSIDE the `!hubIsTrulyEmpty` gate so the empty
          state's "+ New Board" CTA can actually open it — before this fix the
          modal was rendered conditionally with the rest of the hub UI, so
          clicking "+ New Board" from the empty card silently set state with
          nothing to mount. */}
      {showNewBoard && (
        <NewBoardModal onClose={() => setShowNewBoard(false)} onCreate={createBoard} />
      )}
    </div>
  );
}
