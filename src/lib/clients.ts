// Clients module — task-oriented CRM layer that sits between Prospect Hub
// (raw leads) and Listings (the future module a converted client becomes).
// Each client carries follow-up state and a task list so agents can run
// nurture cadences without touching the prospect grid.

const KEY_CLIENTS = 'we.clients';

export type ClientType  = 'Buyer' | 'Tenant' | 'Seller' | 'Landlord' | 'Lead';
// Stage drives the kanban. Closed Won = ready to convert to Listing.
export type ClientStage =
  | 'New'
  | 'Engaged'
  | 'Qualified'
  | 'Proposal'
  | 'Negotiating'
  | 'Closed Won'
  | 'Closed Lost';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface ClientTask {
  id: string;
  title: string;
  done: boolean;
  dueDate: string;    // ISO date (yyyy-mm-dd) or empty
  priority: TaskPriority;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  type: ClientType;
  stage: ClientStage;
  source: 'prospect' | 'manual' | 'import';
  // When imported from Prospect Hub, we keep a back-link so the user can
  // jump back to the source row. Snapshot fields (boardName, unitNo, …) are
  // copied so the client survives even if the prospect row is later deleted.
  prospectId?: string;
  boardName?: string;
  unitNo?: string;
  propertyInterest: string;
  budget: string;
  lastContact: string;     // ISO date or empty
  nextFollowUp: string;    // ISO date or empty — drives "Follow-ups due"
  notes: string;
  ownerEmail: string;
  createdAt: string;
  convertedListingId?: string;  // set when converted into a Listing
  tasks: ClientTask[];
}

export const CLIENT_TYPES: ClientType[] = ['Buyer', 'Tenant', 'Seller', 'Landlord', 'Lead'];
export const CLIENT_STAGES: ClientStage[] = [
  'New', 'Engaged', 'Qualified', 'Proposal', 'Negotiating', 'Closed Won', 'Closed Lost',
];

export const STAGE_TONES: Record<ClientStage, { bg: string; text: string; dot: string }> = {
  'New':         { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
  'Engaged':     { bg: '#E0F2FE', text: '#0369A1', dot: '#3B82F6' },
  'Qualified':   { bg: '#EDE9FE', text: '#7C3AED', dot: '#8B5CF6' },
  'Proposal':    { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  'Negotiating': { bg: '#FFEDD5', text: '#9A3412', dot: '#F97316' },
  'Closed Won':  { bg: '#DCFCE7', text: '#15803D', dot: '#22C55E' },
  'Closed Lost': { bg: '#FEE2E2', text: '#B91C1C', dot: '#EF4444' },
};

export const TYPE_TONES: Record<ClientType, { bg: string; text: string }> = {
  'Buyer':    { bg: '#DCFCE7', text: '#15803D' },
  'Tenant':   { bg: '#E0F2FE', text: '#0369A1' },
  'Seller':   { bg: '#FEF3C7', text: '#92400E' },
  'Landlord': { bg: '#EDE9FE', text: '#7C3AED' },
  'Lead':     { bg: '#F3F4F6', text: '#374151' },
};

export const PRIORITY_TONES: Record<TaskPriority, { bg: string; text: string }> = {
  high:   { bg: '#FEE2E2', text: '#B91C1C' },
  medium: { bg: '#FEF3C7', text: '#92400E' },
  low:    { bg: '#E0F2FE', text: '#0369A1' },
};

// ─── Persistence ────────────────────────────────────────────────────────────
export function listClients(): Client[] {
  try {
    const raw = localStorage.getItem(KEY_CLIENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveClients(rows: Client[]): void {
  try { localStorage.setItem(KEY_CLIENTS, JSON.stringify(rows)); } catch { /* ignore */ }
}

// ─── CRUD ───────────────────────────────────────────────────────────────────
function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createClient(input: Omit<Client, 'id' | 'createdAt' | 'tasks'> & { tasks?: ClientTask[] }): Client {
  const client: Client = {
    ...input,
    id: genId('cli'),
    createdAt: new Date().toISOString(),
    tasks: input.tasks ?? [],
  };
  saveClients([client, ...listClients()]);
  return client;
}

export function updateClient(id: string, patch: Partial<Client>): void {
  saveClients(listClients().map((c) => (c.id === id ? { ...c, ...patch } : c)));
}

export function deleteClient(id: string): void {
  saveClients(listClients().filter((c) => c.id !== id));
}

// ─── Tasks (nested under a client) ──────────────────────────────────────────
export function addTask(clientId: string, title: string, dueDate = '', priority: TaskPriority = 'medium'): void {
  const trimmed = title.trim();
  if (!trimmed) return;
  const task: ClientTask = {
    id: genId('tsk'),
    title: trimmed, done: false, dueDate, priority,
    createdAt: new Date().toISOString(),
  };
  saveClients(listClients().map((c) =>
    c.id === clientId ? { ...c, tasks: [task, ...c.tasks] } : c,
  ));
}

export function toggleTask(clientId: string, taskId: string): void {
  saveClients(listClients().map((c) =>
    c.id === clientId
      ? { ...c, tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) }
      : c,
  ));
}

export function deleteTask(clientId: string, taskId: string): void {
  saveClients(listClients().map((c) =>
    c.id === clientId
      ? { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }
      : c,
  ));
}

// ─── Import from Prospect Hub ───────────────────────────────────────────────
// Takes a prospect snapshot + the originating board name, and creates (or
// updates) a Client. Idempotent on prospectId so re-import is safe.
export interface ProspectImportSeed {
  prospectId:    string;
  name:          string;
  phone:         string;
  unitNo?:       string;
  boardName?:    string;
  listingType?:  string;
  askingRent?:   string;
  askingPrice?:  string;
  callingStatus?: string;
  remark?:       string;
  agent?:        string;
}

// Derive an opinionated client type from the prospect listing type.
function inferType(listingType?: string): ClientType {
  const lt = (listingType ?? '').toLowerCase();
  if (lt.includes('rent') && lt.includes('sale')) return 'Lead';
  if (lt.includes('rent'))                        return 'Tenant';
  if (lt.includes('sale'))                        return 'Buyer';
  return 'Lead';
}

// Derive an opinionated initial stage from the calling status.
function inferStage(callingStatus?: string): ClientStage {
  const cs = (callingStatus ?? '').toLowerCase();
  if (cs === 'positive') return 'Engaged';
  if (cs === 'negative') return 'Closed Lost';
  return 'New';
}

// Build a budget label "RM <rent>/mo  ·  RM <price>" from whichever fields are set.
function buildBudget(rent?: string, price?: string): string {
  const parts: string[] = [];
  if (rent && rent.trim())  parts.push(`RM ${rent.trim()}/mo`);
  if (price && price.trim()) parts.push(`RM ${price.trim()}`);
  return parts.join('  ·  ');
}

// Property interest label combines unit + board for context.
function buildInterest(boardName?: string, unitNo?: string, listingType?: string): string {
  const bits: string[] = [];
  if (unitNo)     bits.push(unitNo);
  if (boardName)  bits.push(boardName);
  const head = bits.join(' · ');
  if (listingType) return head ? `${head} (${listingType})` : listingType;
  return head;
}

export function importFromProspect(seed: ProspectImportSeed, ownerEmail: string): { client: Client; created: boolean } {
  const existing = listClients().find((c) => c.prospectId === seed.prospectId);
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = (() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  if (existing) {
    // Refresh the snapshot fields, but keep stage / tasks / follow-up alive.
    const patch: Partial<Client> = {
      name:    seed.name || existing.name,
      phone:   seed.phone || existing.phone,
      unitNo:  seed.unitNo ?? existing.unitNo,
      boardName: seed.boardName ?? existing.boardName,
      propertyInterest: buildInterest(seed.boardName, seed.unitNo, seed.listingType) || existing.propertyInterest,
      budget:  buildBudget(seed.askingRent, seed.askingPrice) || existing.budget,
      notes:   seed.remark || existing.notes,
    };
    updateClient(existing.id, patch);
    return { client: { ...existing, ...patch }, created: false };
  }

  const client = createClient({
    name:    seed.name || 'Untitled Client',
    phone:   seed.phone || '',
    email:   '',
    type:    inferType(seed.listingType),
    stage:   inferStage(seed.callingStatus),
    source:  'prospect',
    prospectId: seed.prospectId,
    boardName: seed.boardName,
    unitNo:    seed.unitNo,
    propertyInterest: buildInterest(seed.boardName, seed.unitNo, seed.listingType),
    budget:  buildBudget(seed.askingRent, seed.askingPrice),
    lastContact: today,
    nextFollowUp: nextWeek,
    notes:   seed.remark ?? '',
    ownerEmail,
    tasks: [
      {
        id: genId('tsk'),
        title: `Follow up with ${seed.name}`,
        done: false,
        dueDate: nextWeek,
        priority: 'medium',
        createdAt: new Date().toISOString(),
      },
    ],
  });
  return { client, created: true };
}

// ─── Conversion → Listing (third module, scaffolded) ────────────────────────
// Once the Listings module is wired, this will create the actual Listing row
// and write the id back here. For now we just stamp it.
export function convertToListing(clientId: string): string {
  const listingId = genId('lst');
  updateClient(clientId, { convertedListingId: listingId, stage: 'Closed Won' });
  return listingId;
}

// ─── Derived helpers (selectors) ────────────────────────────────────────────
// "Today" / "Overdue" / "Upcoming" buckets used by the dashboard cards.
export function isOverdue(iso: string | undefined): boolean {
  if (!iso) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}
export function isToday(iso: string | undefined): boolean {
  if (!iso) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
}
export function isUpcoming(iso: string | undefined, days = 7): boolean {
  if (!iso) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const limit = new Date(today); limit.setDate(limit.getDate() + days);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  return d.getTime() > today.getTime() && d.getTime() <= limit.getTime();
}

export function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}
