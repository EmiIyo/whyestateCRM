import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Search, X, Trash2, Check, MapPin,
  Calendar as CalendarIcon, ChevronDown, Users, AlertTriangle, Sparkles,
  Pencil, ArrowRight, ClipboardList, Filter,
} from 'lucide-react';
import {
  listClients, createClient, updateClient, deleteClient,
  addTask, toggleTask, deleteTask, convertToListing,
  isOverdue, isToday, isUpcoming, fmtDate,
  CLIENT_TYPES, CLIENT_STAGES, STAGE_TONES, TYPE_TONES, PRIORITY_TONES,
  type Client, type ClientStage, type ClientType, type ClientTask, type TaskPriority,
} from '@/api/clients';
import { supabase } from '@/lib/supabase';

type ViewMode = 'tasks' | 'kanban' | 'list';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [view, setView]       = useState<ViewMode>('tasks');
  const [query, setQuery]     = useState('');
  const [typeFilter, setTypeFilter]   = useState<ClientType | 'All'>('All');
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);

  const refresh = useCallback(async () => {
    try { setClients(await listClients()); }
    catch (e) { console.error('listClients failed', e); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Realtime: re-fetch when anyone in the workspace mutates clients or tasks.
  useEffect(() => {
    const ch = supabase.channel('clients-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' },      () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_tasks' }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [refresh]);

  // Keep the open `editing` modal in sync with refreshed data.
  useEffect(() => {
    if (!editing) return;
    const fresh = clients.find((c) => c.id === editing.id);
    if (fresh && fresh !== editing) setEditing(fresh);
  }, [clients, editing]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (typeFilter !== 'All' && c.type !== typeFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.boardName ?? '').toLowerCase().includes(q) ||
        c.propertyInterest.toLowerCase().includes(q)
      );
    });
  }, [clients, query, typeFilter]);

  // ─── Task buckets (derived) ────────────────────────────────────────────────
  // Each "task row" is { client, task | follow-up } so we can render them
  // in one feed sorted by date. Follow-ups are synthesised from the client's
  // nextFollowUp field — they're not real tasks but live in the same view.
  type FeedItem =
    | { kind: 'task';  client: Client; task: ClientTask }
    | { kind: 'follow'; client: Client; date: string };

  const allFeedItems: FeedItem[] = useMemo(() => {
    const arr: FeedItem[] = [];
    for (const c of filtered) {
      for (const t of c.tasks) {
        if (t.done) continue;
        arr.push({ kind: 'task', client: c, task: t });
      }
      if (c.nextFollowUp && c.stage !== 'Closed Won' && c.stage !== 'Closed Lost') {
        arr.push({ kind: 'follow', client: c, date: c.nextFollowUp });
      }
    }
    return arr;
  }, [filtered]);

  const overdueItems  = allFeedItems.filter((it) => isOverdue(it.kind === 'task' ? it.task.dueDate : it.date));
  const todayItems    = allFeedItems.filter((it) => isToday(it.kind === 'task' ? it.task.dueDate : it.date));
  const upcomingItems = allFeedItems.filter((it) => isUpcoming(it.kind === 'task' ? it.task.dueDate : it.date, 14));

  // Stats
  const stats = useMemo(() => ({
    total:    clients.length,
    active:   clients.filter((c) => c.stage !== 'Closed Won' && c.stage !== 'Closed Lost').length,
    dueToday: clients.filter((c) =>
      isToday(c.nextFollowUp) || c.tasks.some((t) => !t.done && isToday(t.dueDate))
    ).length,
    readyToConvert: clients.filter((c) => c.stage === 'Closed Won' && !c.convertedListingId).length,
  }), [clients]);

  return (
    <div className="flex-1 overflow-auto" style={{ background: '#F5F7FA' }}>
      <div className="max-w-[1280px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1A202C' }}>Clients</h1>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
              Nurture follow-ups and tasks · convert to Listings when ready
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: '#1EC9C4' }}>
              <Plus size={13} strokeWidth={2.5} /> New Client
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard icon={<Users size={16} />}              label="Total clients"      value={stats.total}          tone={{ bg: '#E0F2FE', text: '#0369A1' }} />
          <StatCard icon={<Sparkles size={16} />}           label="Active pipeline"    value={stats.active}         tone={{ bg: '#EDE9FE', text: '#7C3AED' }} />
          <StatCard icon={<AlertTriangle size={16} />}      label="Follow-ups today"   value={stats.dueToday}       tone={{ bg: '#FEF3C7', text: '#92400E' }} />
          <StatCard icon={<ArrowRight size={16} />}         label="Ready to convert"   value={stats.readyToConvert} tone={{ bg: '#DCFCE7', text: '#15803D' }} />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl border px-4 py-3 mb-4" style={{ borderColor: '#F1F5F9' }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, phone, project…"
              className="w-full pl-7 pr-3 py-1.5 rounded-lg border text-xs outline-none focus:border-[#1EC9C4]"
              style={{ borderColor: '#E5E7EB' }} />
          </div>

          {/* Type filter */}
          <div className="relative">
            <Filter size={12} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ClientType | 'All')}
              className="pl-7 pr-7 py-1.5 rounded-lg border text-xs outline-none appearance-none cursor-pointer bg-white"
              style={{ borderColor: '#E5E7EB' }}>
              <option value="All">All types</option>
              {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown size={11} className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* View switcher */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg border" style={{ borderColor: '#E5E7EB', background: '#F8FAFB' }}>
            {(['tasks', 'kanban', 'list'] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors capitalize ${view === v ? 'bg-white text-[#1A202C] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {clients.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : view === 'tasks' ? (
          <TaskFeed
            overdue={overdueItems}
            today={todayItems}
            upcoming={upcomingItems}
            onOpenClient={(c) => setEditing(c)}
            onToggleTask={async (taskId, currentDone) => { await toggleTask(taskId, !currentDone); await refresh(); }}
          />
        ) : view === 'kanban' ? (
          <KanbanBoard
            clients={filtered}
            onOpenClient={(c) => setEditing(c)}
            onStageChange={async (c, stage) => { await updateClient(c.id, { stage }); await refresh(); }}
          />
        ) : (
          <ListView
            clients={filtered}
            onOpenClient={(c) => setEditing(c)}
            onDelete={(c) => setConfirmDelete(c)}
            onConvert={async (c) => { await convertToListing(c.id); await refresh(); }}
          />
        )}
      </div>

      {/* Modals */}
      {(creating || editing) && (
        <ClientModal
          client={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={async (patch) => {
            try {
              if (editing) await updateClient(editing.id, patch);
              else await createClient({
                name: patch.name ?? '', phone: patch.phone ?? '', email: patch.email ?? '',
                type: patch.type ?? 'Lead', stage: patch.stage ?? 'New', source: 'manual',
                propertyInterest: patch.propertyInterest ?? '', budget: patch.budget ?? '',
                lastContact: patch.lastContact ?? '', nextFollowUp: patch.nextFollowUp ?? '',
                notes: patch.notes ?? '',
              });
              setCreating(false); setEditing(null); await refresh();
            } catch (e) { console.error('save client failed', e); }
          }}
          onAddTask={async (title, due, prio) => {
            if (!editing) return;
            try { await addTask(editing.id, title, due, prio); await refresh(); }
            catch (e) { console.error('addTask failed', e); }
          }}
          onToggleTask={async (taskId) => {
            if (!editing) return;
            const t = editing.tasks.find((x) => x.id === taskId);
            if (!t) return;
            try { await toggleTask(taskId, !t.done); await refresh(); }
            catch (e) { console.error('toggleTask failed', e); }
          }}
          onDeleteTask={async (taskId) => {
            if (!editing) return;
            try { await deleteTask(taskId); await refresh(); }
            catch (e) { console.error('deleteTask failed', e); }
          }}
          onConvert={async () => {
            if (!editing) return;
            try { await convertToListing(editing.id); setEditing(null); await refresh(); }
            catch (e) { console.error('convert failed', e); }
          }}
          onDelete={() => {
            if (!editing) return;
            setConfirmDelete(editing); setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          name={confirmDelete.name}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            try { await deleteClient(confirmDelete.id); setConfirmDelete(null); await refresh(); }
            catch (e) { console.error('deleteClient failed', e); }
          }}
        />
      )}
    </div>
  );
}

// ─── Sub: StatCard ──────────────────────────────────────────────────────────
function StatCard({ icon, label, value, tone }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: { bg: string; text: string };
}) {
  return (
    <div className="bg-white rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: '#F1F5F9' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: tone.bg, color: tone.text }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{label}</p>
        <p className="text-xl font-bold leading-tight" style={{ color: '#1A202C' }}>{value}</p>
      </div>
    </div>
  );
}

// ─── Sub: EmptyState ────────────────────────────────────────────────────────
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: '#F1F5F9' }}>
      <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3"
        style={{ background: '#DAF3F2' }}>
        <Users size={26} style={{ color: '#0F766E' }} />
      </div>
      <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>No clients yet</h3>
      <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: '#9CA3AF' }}>
        Import a row from Prospect Hub via the row menu, or create a client here to start tracking follow-ups and tasks.
      </p>
      <button onClick={onCreate}
        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-90"
        style={{ background: '#1EC9C4' }}>
        <Plus size={13} strokeWidth={2.5} /> New Client
      </button>
    </div>
  );
}

// ─── Sub: TaskFeed (default view — task-oriented) ───────────────────────────
function TaskFeed({ overdue, today, upcoming, onOpenClient, onToggleTask }: {
  overdue:  Array<{ kind: 'task'; client: Client; task: ClientTask } | { kind: 'follow'; client: Client; date: string }>;
  today:    Array<{ kind: 'task'; client: Client; task: ClientTask } | { kind: 'follow'; client: Client; date: string }>;
  upcoming: Array<{ kind: 'task'; client: Client; task: ClientTask } | { kind: 'follow'; client: Client; date: string }>;
  onOpenClient: (c: Client) => void;
  onToggleTask: (taskId: string, currentDone: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <TaskColumn title="Overdue"  count={overdue.length}  items={overdue}  toneText="#B91C1C" dot="#EF4444"
        onOpenClient={onOpenClient} onToggleTask={onToggleTask} emptyHint="Nothing past due — nice." />
      <TaskColumn title="Today"    count={today.length}    items={today}    toneText="#0F766E" dot="#1EC9C4"
        onOpenClient={onOpenClient} onToggleTask={onToggleTask} emptyHint="No tasks scheduled for today." />
      <TaskColumn title="Upcoming · 14d" count={upcoming.length} items={upcoming} toneText="#7C3AED" dot="#8B5CF6"
        onOpenClient={onOpenClient} onToggleTask={onToggleTask} emptyHint="Nothing in the next two weeks." />
    </div>
  );
}

function TaskColumn({ title, count, items, toneText, dot, onOpenClient, onToggleTask, emptyHint }: {
  title: string;
  count: number;
  items: Array<{ kind: 'task'; client: Client; task: ClientTask } | { kind: 'follow'; client: Client; date: string }>;
  toneText: string;
  dot: string;
  onOpenClient: (c: Client) => void;
  onToggleTask: (taskId: string, currentDone: boolean) => void;
  emptyHint: string;
}) {
  // Sort by date asc, with empty dates last
  const sorted = [...items].sort((a, b) => {
    const ad = a.kind === 'task' ? a.task.dueDate : a.date;
    const bd = b.kind === 'task' ? b.task.dueDate : b.date;
    if (!ad && !bd) return 0;
    if (!ad) return 1;
    if (!bd) return -1;
    return ad.localeCompare(bd);
  });
  return (
    <div className="bg-white rounded-2xl border" style={{ borderColor: '#F1F5F9' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#F1F5F9' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
          <h3 className="text-sm font-bold" style={{ color: toneText }}>{title}</h3>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: '#F3F4F6', color: '#6B7280' }}>{count}</span>
      </div>
      <div className="p-2 space-y-1.5 max-h-[600px] overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: '#9CA3AF' }}>{emptyHint}</p>
        ) : (
          sorted.map((it, idx) => (
            <TaskCard key={(it.kind === 'task' ? it.task.id : `f_${it.client.id}`) + idx}
              item={it} onOpenClient={onOpenClient} onToggleTask={onToggleTask} />
          ))
        )}
      </div>
    </div>
  );
}

function TaskCard({ item, onOpenClient, onToggleTask }: {
  item: { kind: 'task'; client: Client; task: ClientTask } | { kind: 'follow'; client: Client; date: string };
  onOpenClient: (c: Client) => void;
  onToggleTask: (taskId: string, currentDone: boolean) => void;
}) {
  const date = item.kind === 'task' ? item.task.dueDate : item.date;
  const title = item.kind === 'task' ? item.task.title : 'Follow up';
  const stageTone = STAGE_TONES[item.client.stage];

  return (
    <div className="group rounded-xl border px-3 py-2.5 hover:border-[#1EC9C4] transition-colors cursor-pointer"
      style={{ borderColor: '#F1F5F9', background: '#FBFCFD' }}
      onClick={() => onOpenClient(item.client)}>
      <div className="flex items-start gap-2">
        {item.kind === 'task' ? (
          <button onClick={(e) => { e.stopPropagation(); onToggleTask(item.task.id, item.task.done); }}
            className="mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 hover:border-[#1EC9C4]"
            style={{ borderColor: '#D1D5DB' }}>
            {item.task.done && <Check size={11} className="text-[#1EC9C4]" strokeWidth={3} />}
          </button>
        ) : (
          <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#FEF3C7' }}>
            <CalendarIcon size={9} style={{ color: '#92400E' }} strokeWidth={2.5} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight truncate" style={{ color: '#1A202C' }}>{title}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] font-bold truncate" style={{ color: '#6B7280' }}>{item.client.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
              style={{ background: stageTone.bg, color: stageTone.text }}>{item.client.stage}</span>
            {date && (
              <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
                {fmtDate(date)}
              </span>
            )}
            {item.kind === 'task' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                style={{ background: PRIORITY_TONES[item.task.priority].bg, color: PRIORITY_TONES[item.task.priority].text }}>
                {item.task.priority}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub: KanbanBoard (stage view) ──────────────────────────────────────────
function KanbanBoard({ clients, onOpenClient, onStageChange }: {
  clients: Client[];
  onOpenClient: (c: Client) => void;
  onStageChange: (c: Client, stage: ClientStage) => void;
}) {
  const stagesOrdered: ClientStage[] = ['New', 'Engaged', 'Qualified', 'Proposal', 'Negotiating', 'Closed Won'];

  const [dragId, setDragId] = useState<string | null>(null);
  const onDragStart = (id: string) => setDragId(id);
  const onDragEnd   = () => setDragId(null);
  const onDropStage = (stage: ClientStage) => {
    if (!dragId) return;
    const c = clients.find((x) => x.id === dragId);
    if (c && c.stage !== stage) onStageChange(c, stage);
    setDragId(null);
  };

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stagesOrdered.length}, minmax(220px, 1fr))` }}>
      {stagesOrdered.map((stage) => {
        const items = clients.filter((c) => c.stage === stage);
        const tone = STAGE_TONES[stage];
        return (
          <div key={stage}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDropStage(stage)}
            className="bg-white rounded-2xl border flex flex-col min-h-[400px]"
            style={{ borderColor: '#F1F5F9' }}>
            <div className="px-3 py-2.5 border-b flex items-center justify-between" style={{ borderColor: '#F1F5F9' }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tone.dot }} />
                <h3 className="text-xs font-bold truncate" style={{ color: tone.text }}>{stage}</h3>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: tone.bg, color: tone.text }}>{items.length}</span>
            </div>
            <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-[560px]">
              {items.length === 0 && (
                <p className="text-[10px] text-center py-4" style={{ color: '#D1D5DB' }}>—</p>
              )}
              {items.map((c) => (
                <div key={c.id}
                  draggable
                  onDragStart={() => onDragStart(c.id)}
                  onDragEnd={onDragEnd}
                  onClick={() => onOpenClient(c)}
                  className="rounded-xl border px-2.5 py-2 hover:border-[#1EC9C4] cursor-pointer transition-colors"
                  style={{ borderColor: '#F1F5F9', background: '#FBFCFD', opacity: dragId === c.id ? 0.4 : 1 }}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold truncate" style={{ color: '#1A202C' }}>{c.name}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: TYPE_TONES[c.type].bg, color: TYPE_TONES[c.type].text }}>{c.type}</span>
                  </div>
                  {c.propertyInterest && (
                    <p className="text-[10px] truncate mt-0.5" style={{ color: '#9CA3AF' }}>{c.propertyInterest}</p>
                  )}
                  {c.nextFollowUp && (
                    <p className="text-[10px] flex items-center gap-1 mt-1"
                      style={{ color: isOverdue(c.nextFollowUp) ? '#B91C1C' : '#6B7280' }}>
                      <CalendarIcon size={9} /> {fmtDate(c.nextFollowUp)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sub: ListView ──────────────────────────────────────────────────────────
function ListView({ clients, onOpenClient, onDelete, onConvert }: {
  clients: Client[];
  onOpenClient: (c: Client) => void;
  onDelete: (c: Client) => void;
  onConvert: (c: Client) => void;
}) {
  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-2xl border py-10 text-center" style={{ borderColor: '#F1F5F9' }}>
        <p className="text-xs" style={{ color: '#9CA3AF' }}>No clients match the current filter.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#F1F5F9' }}>
      <table className="w-full text-xs">
        <thead style={{ background: '#F8FAFB' }}>
          <tr style={{ color: '#6B7280' }}>
            <th className="text-left px-4 py-2.5 font-bold">Client</th>
            <th className="text-left px-3 py-2.5 font-bold">Type</th>
            <th className="text-left px-3 py-2.5 font-bold">Stage</th>
            <th className="text-left px-3 py-2.5 font-bold">Interest</th>
            <th className="text-left px-3 py-2.5 font-bold">Budget</th>
            <th className="text-left px-3 py-2.5 font-bold">Next follow-up</th>
            <th className="text-right px-3 py-2.5 font-bold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c, i) => {
            const stage = STAGE_TONES[c.stage];
            const tt = TYPE_TONES[c.type];
            const overdueFlag = isOverdue(c.nextFollowUp);
            return (
              <tr key={c.id} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderTop: i === 0 ? 'none' : '1px solid #F1F5F9' }}>
                <td className="px-4 py-2.5 cursor-pointer" onClick={() => onOpenClient(c)}>
                  <p className="font-bold text-[#1A202C]">{c.name}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>{c.phone || '—'}</p>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: tt.bg, color: tt.text }}>{c.type}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: stage.bg, color: stage.text }}>{c.stage}</span>
                </td>
                <td className="px-3 py-2.5 max-w-[200px]">
                  <span className="truncate block" style={{ color: '#4B4F55' }}>{c.propertyInterest || '—'}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span style={{ color: '#4B4F55' }}>{c.budget || '—'}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span style={{ color: overdueFlag ? '#B91C1C' : '#4B4F55', fontWeight: overdueFlag ? 700 : 400 }}>
                    {fmtDate(c.nextFollowUp)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {c.stage === 'Closed Won' && !c.convertedListingId && (
                      <button onClick={() => onConvert(c)} title="Convert to Listing"
                        className="text-[10px] font-bold px-2 py-1 rounded-md text-white hover:opacity-90"
                        style={{ background: '#22C55E' }}>
                        Convert →
                      </button>
                    )}
                    {c.convertedListingId && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md"
                        style={{ background: '#F3F4F6', color: '#6B7280' }}>
                        ✓ Converted
                      </span>
                    )}
                    <button onClick={() => onOpenClient(c)} title="Edit"
                      className="p-1.5 rounded-md hover:bg-gray-100">
                      <Pencil size={12} className="text-gray-400" />
                    </button>
                    <button onClick={() => onDelete(c)} title="Delete"
                      className="p-1.5 rounded-md hover:bg-red-50">
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sub: ClientModal (create / edit + task drawer) ─────────────────────────
function ClientModal({ client, onClose, onSave, onAddTask, onToggleTask, onDeleteTask, onConvert, onDelete }: {
  client: Client | null;
  onClose: () => void;
  onSave: (patch: Partial<Client>) => void;
  onAddTask: (title: string, due: string, prio: TaskPriority) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onConvert: () => void;
  onDelete: () => void;
}) {
  const editing = client !== null;
  const [name, setName]   = useState(client?.name ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [email, setEmail] = useState(client?.email ?? '');
  const [type, setType]   = useState<ClientType>(client?.type ?? 'Lead');
  const [stage, setStage] = useState<ClientStage>(client?.stage ?? 'New');
  const [propertyInterest, setPropertyInterest] = useState(client?.propertyInterest ?? '');
  const [budget, setBudget] = useState(client?.budget ?? '');
  const [lastContact, setLastContact]   = useState(client?.lastContact ?? '');
  const [nextFollowUp, setNextFollowUp] = useState(client?.nextFollowUp ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');

  const [taskTitle, setTaskTitle]   = useState('');
  const [taskDue, setTaskDue]       = useState('');
  const [taskPrio, setTaskPrio]     = useState<TaskPriority>('medium');

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const submit = () => {
    if (!name.trim()) { nameRef.current?.focus(); return; }
    onSave({
      name: name.trim(), phone: phone.trim(), email: email.trim(),
      type, stage,
      propertyInterest: propertyInterest.trim(), budget: budget.trim(),
      lastContact, nextFollowUp, notes,
    });
  };

  const submitTask = () => {
    if (!taskTitle.trim()) return;
    onAddTask(taskTitle.trim(), taskDue, taskPrio);
    setTaskTitle(''); setTaskDue(''); setTaskPrio('medium');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-[min(880px,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-hidden flex flex-col"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: '#F1F5F9' }}>
          <div className="min-w-0">
            <h3 className="text-base font-bold truncate" style={{ color: '#1A202C' }}>
              {editing ? client!.name : 'New Client'}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {editing && client!.source === 'prospect' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: '#DAF3F2', color: '#0F766E' }}>Imported from Prospect Hub</span>
              )}
              {editing && client!.boardName && (
                <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
                  <MapPin size={9} className="inline -mt-0.5 mr-0.5" />
                  {client!.boardName}{client!.unitNo ? ` · ${client!.unitNo}` : ''}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={15} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 flex-1 overflow-hidden">
          {/* Left: details */}
          <div className="overflow-y-auto px-6 py-5 space-y-3.5 border-r" style={{ borderColor: '#F1F5F9' }}>
            <Row label="Name">
              <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB' }} />
            </Row>

            <div className="grid grid-cols-2 gap-3">
              <Row label="Phone">
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                  style={{ borderColor: '#E5E7EB' }} />
              </Row>
              <Row label="Email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                  style={{ borderColor: '#E5E7EB' }} />
              </Row>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Row label="Type">
                <select value={type} onChange={(e) => setType(e.target.value as ClientType)}
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white focus:border-[#1EC9C4]"
                  style={{ borderColor: '#E5E7EB' }}>
                  {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Row>
              <Row label="Stage">
                <select value={stage} onChange={(e) => setStage(e.target.value as ClientStage)}
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white focus:border-[#1EC9C4]"
                  style={{ borderColor: '#E5E7EB' }}>
                  {CLIENT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Row>
            </div>

            <Row label="Property Interest">
              <input value={propertyInterest} onChange={(e) => setPropertyInterest(e.target.value)}
                placeholder="e.g. 2br condo, Bukit Jalil"
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB' }} />
            </Row>

            <Row label="Budget">
              <input value={budget} onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. RM 3,500/mo or RM 800,000"
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB' }} />
            </Row>

            <div className="grid grid-cols-2 gap-3">
              <Row label="Last Contact">
                <input type="date" value={lastContact} onChange={(e) => setLastContact(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                  style={{ borderColor: '#E5E7EB' }} />
              </Row>
              <Row label="Next Follow-up">
                <input type="date" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                  style={{ borderColor: '#E5E7EB' }} />
              </Row>
            </div>

            <Row label="Notes">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                placeholder="Conversation history, preferences, blockers…"
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4] resize-none"
                style={{ borderColor: '#E5E7EB' }} />
            </Row>
          </div>

          {/* Right: tasks drawer (only when editing — new clients save first) */}
          <div className="overflow-y-auto px-6 py-5">
            {editing ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold flex items-center gap-1.5" style={{ color: '#1A202C' }}>
                    <ClipboardList size={14} /> Tasks
                  </h4>
                  <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
                    {client!.tasks.filter((t) => !t.done).length} open · {client!.tasks.filter((t) => t.done).length} done
                  </span>
                </div>

                {/* Add task form */}
                <div className="rounded-xl border p-3 mb-3" style={{ borderColor: '#F1F5F9', background: '#FBFCFD' }}>
                  <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitTask(); }}
                    placeholder="Add a task — e.g. Send floor plan"
                    className="w-full px-2.5 py-1.5 rounded-lg border outline-none text-xs focus:border-[#1EC9C4]"
                    style={{ borderColor: '#E5E7EB' }} />
                  <div className="flex items-center gap-1.5 mt-2">
                    <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)}
                      className="flex-1 px-2 py-1 rounded-lg border text-xs outline-none focus:border-[#1EC9C4]"
                      style={{ borderColor: '#E5E7EB' }} />
                    <select value={taskPrio} onChange={(e) => setTaskPrio(e.target.value as TaskPriority)}
                      className="px-2 py-1 rounded-lg border text-xs outline-none bg-white focus:border-[#1EC9C4]"
                      style={{ borderColor: '#E5E7EB' }}>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <button onClick={submitTask} disabled={!taskTitle.trim()}
                      className="px-3 py-1 rounded-lg text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
                      style={{ background: '#1EC9C4' }}>
                      Add
                    </button>
                  </div>
                </div>

                {/* Task list */}
                <div className="space-y-1.5">
                  {client!.tasks.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: '#9CA3AF' }}>No tasks yet — add the first one above.</p>
                  ) : (
                    client!.tasks.map((t) => {
                      const overdueFlag = !t.done && isOverdue(t.dueDate);
                      return (
                        <div key={t.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-2 group"
                          style={{ borderColor: overdueFlag ? '#FECACA' : '#F1F5F9', background: t.done ? '#F9FAFB' : '#FFFFFF' }}>
                          <button onClick={() => onToggleTask(t.id)}
                            className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 hover:border-[#1EC9C4]"
                            style={{ borderColor: t.done ? '#1EC9C4' : '#D1D5DB', background: t.done ? '#1EC9C4' : 'transparent' }}>
                            {t.done && <Check size={11} className="text-white" strokeWidth={3} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate"
                              style={{ color: t.done ? '#9CA3AF' : '#1A202C', textDecoration: t.done ? 'line-through' : 'none' }}>
                              {t.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {t.dueDate && (
                                <span className="text-[10px]" style={{ color: overdueFlag ? '#B91C1C' : '#9CA3AF' }}>
                                  {fmtDate(t.dueDate)}
                                </span>
                              )}
                              <span className="text-[9px] font-bold px-1 py-0.5 rounded uppercase"
                                style={{ background: PRIORITY_TONES[t.priority].bg, color: PRIORITY_TONES[t.priority].text }}>
                                {t.priority}
                              </span>
                            </div>
                          </div>
                          <button onClick={() => onDeleteTask(t.id)}
                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-opacity">
                            <Trash2 size={11} className="text-red-400" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-xl border p-6 text-center" style={{ borderColor: '#F1F5F9', background: '#FBFCFD' }}>
                <ClipboardList size={22} className="mx-auto mb-2" style={{ color: '#9CA3AF' }} />
                <p className="text-xs" style={{ color: '#9CA3AF' }}>
                  Save the client first to start adding tasks and follow-ups.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t" style={{ borderColor: '#F1F5F9', background: '#F8FAFB' }}>
          <div className="flex items-center gap-2">
            {editing && stage === 'Closed Won' && !client!.convertedListingId && (
              <button onClick={onConvert}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white hover:opacity-90"
                style={{ background: '#22C55E' }}>
                Convert to Listing <ArrowRight size={12} strokeWidth={2.5} />
              </button>
            )}
            {editing && client!.convertedListingId && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-md"
                style={{ background: '#DCFCE7', color: '#15803D' }}>
                ✓ Converted to Listing
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editing && (
              <button onClick={onDelete}
                className="px-3 py-1.5 rounded-xl text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50">
                Delete
              </button>
            )}
            <button onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={submit} disabled={!name.trim()}
              className="px-5 py-1.5 rounded-xl text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
              style={{ background: '#1EC9C4' }}>
              {editing ? 'Save' : 'Create Client'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: '#6B7280' }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Sub: ConfirmDeleteModal ────────────────────────────────────────────────
function ConfirmDeleteModal({ name, onCancel, onConfirm }: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] overflow-hidden"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>Delete Client</h3>
          <p className="text-xs mt-1.5" style={{ color: '#6B7280' }}>
            Permanently delete <span className="font-bold">{name}</span> and all associated tasks?
            This cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-3 border-t" style={{ borderColor: '#F1F5F9', background: '#F8FAFB' }}>
          <button onClick={onCancel}
            className="px-4 py-1.5 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-white hover:opacity-90"
            style={{ background: '#EF4444' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
