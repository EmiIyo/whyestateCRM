import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Trash2,
  Mail, MapPin, FileText, Check, Loader2, ExternalLink, Link as LinkIcon, AlertCircle, Pencil,
} from 'lucide-react';
import {
  listEvents, createEvent, updateEvent, deleteEvent,
  monthGridDays, isSameDay, fmtMonth, fmtTime, isoFromDateTime,
  EVENT_COLORS, EVENT_TITLE_PRESETS, type CalEvent,
} from '@/api/calendar';
import {
  isGoogleConnected, linkGoogleCalendar, unlinkGoogle,
  pushEventToGoogleCalendar, deleteEventFromGoogleCalendar,
} from '@/api/google';
import { getCurrentUser, listAllUsers, getAvatarColor, getAvatarImage } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { notifyError, notifySuccess } from '@/lib/notify';
import { confirm } from '@/components/ConfirmDialog';
import { listBoards } from '@/api/boards';

interface GoogleState {
  connected: boolean;
  email?: string | null;
}

type ViewMode = 'month' | 'agenda';

export default function CalendarPage() {
  const me = getCurrentUser();
  const myEmail = me?.email ?? '';

  const [cursor, setCursor]         = useState(new Date());
  const [view, setView]             = useState<ViewMode>('month');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
  const [newEventSeed, setNewEventSeed] = useState<{ start: Date } | null>(null);

  const [events, setEvents] = useState<CalEvent[]>([]);
  const [google, setGoogle] = useState<GoogleState>({ connected: false });

  const refresh = useCallback(async () => {
    try {
      const [evs, conn] = await Promise.all([listEvents(), isGoogleConnected()]);
      setEvents(evs);
      setGoogle({ connected: conn.connected, email: conn.email });
    } catch (e) { notifyError('Could not load calendar', e); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const ch = supabase.channel('calendar-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [refresh]);

  // When Supabase finishes the Google OAuth handshake, the session is updated.
  // Re-pull the connection status so the "Connected · …" badge appears
  // without the user having to refresh.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'USER_UPDATED' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void refresh();
      }
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [refresh]);

  const days = useMemo(() => monthGridDays(cursor), [cursor]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const k = new Date(e.start).toDateString();
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [events]);

  const goPrev  = () => { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); };
  const goNext  = () => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); };
  const goToday = () => setCursor(new Date());

  const openNewAt = (day: Date) => {
    const start = new Date(day);
    const now = new Date();
    if (isSameDay(day, now)) start.setHours(now.getHours() + 1, 0, 0, 0);
    else start.setHours(10, 0, 0, 0);
    setNewEventSeed({ start });
  };

  const upcoming = useMemo(() => {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    return [...events]
      .filter((e) => new Date(e.start) >= t0)
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [events]);

  return (
    <div className="flex-1 overflow-auto" style={{ background: '#F5F7FA' }}>
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1A202C' }}>Calendar</h1>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Schedule viewings, sync to Google Calendar</p>
          </div>
          <div className="flex items-center gap-2">
            {google.connected ? (
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Disconnect Google Calendar?',
                    description: `Your CRM events stay where they are; we just stop pushing them to ${google.email ?? 'Google'}.`,
                    confirmLabel: 'Disconnect',
                  });
                  if (!ok) return;
                  try {
                    await unlinkGoogle();
                    notifySuccess('Google Calendar disconnected');
                    await refresh();
                  } catch (e) {
                    notifyError('Could not disconnect', e);
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors hover:bg-gray-50"
                style={{ borderColor: '#D1F2EF', color: '#0F766E', background: '#F0FBFA' }}>
                <GoogleDot /> Connected · {google.email}
              </button>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await linkGoogleCalendar();
                    // linkGoogleCalendar redirects the browser; lines below
                    // only run if the SDK errors before navigation.
                  } catch (e) {
                    notifyError('Could not start Google sign-in', e);
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors hover:border-[#1EC9C4] hover:text-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}>
                <GoogleDot /> Connect Google Calendar
              </button>
            )}
            <button onClick={() => openNewAt(selectedDay ?? new Date())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: '#1EC9C4' }}>
              <Plus size={13} strokeWidth={2.5} /> New Event
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between bg-white rounded-2xl border px-4 py-3 mb-4" style={{ borderColor: '#F1F5F9' }}>
          <div className="flex items-center gap-3">
            <button onClick={goPrev} className="p-1.5 rounded-lg border hover:bg-gray-50" style={{ borderColor: '#E5E7EB' }}>
              <ChevronLeft size={14} className="text-gray-500" />
            </button>
            <button onClick={goNext} className="p-1.5 rounded-lg border hover:bg-gray-50" style={{ borderColor: '#E5E7EB' }}>
              <ChevronRight size={14} className="text-gray-500" />
            </button>
            <button onClick={goToday}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-gray-50"
              style={{ borderColor: '#E5E7EB', color: '#374151' }}>
              Today
            </button>
            <span className="text-base font-bold ml-2" style={{ color: '#1A202C' }}>{fmtMonth(cursor)}</span>
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-lg border" style={{ borderColor: '#E5E7EB', background: '#F8FAFB' }}>
            {(['month', 'agenda'] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors capitalize ${view === v ? 'bg-white text-[#1A202C] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {events.length === 0 && (
          <div className="mb-3 rounded-2xl border px-4 py-3 flex items-center gap-3"
            style={{ borderColor: '#D1F2EF', background: '#F0FBFA' }}>
            <CalendarIcon size={18} style={{ color: '#0F766E' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#0F766E' }}>No events yet</p>
              <p className="text-[11px]" style={{ color: '#0F766E', opacity: 0.85 }}>
                Click <strong>New Event</strong> above, or double-click any day in the grid to schedule one.
              </p>
            </div>
          </div>
        )}
        {view === 'month' ? (
          <MonthGrid
            days={days}
            cursor={cursor}
            eventsByDay={eventsByDay}
            selectedDay={selectedDay}
            onPickDay={(d) => setSelectedDay(d)}
            onCreateAt={openNewAt}
            onEditEvent={(e) => setEditingEvent(e)}
          />
        ) : (
          <AgendaList events={upcoming} onEdit={(e) => setEditingEvent(e)} />
        )}
      </div>

      {(newEventSeed || editingEvent) && (
        <EventModal
          existing={editingEvent}
          seed={newEventSeed}
          myEmail={myEmail}
          googleConnected={google.connected}
          onClose={() => { setNewEventSeed(null); setEditingEvent(null); }}
          onSaved={() => { setNewEventSeed(null); setEditingEvent(null); void refresh(); }}
          onDeleted={() => { setEditingEvent(null); void refresh(); }}
        />
      )}
      {/* ConnectGoogleModal kept in source for the day real OAuth lands —
          right now the Google buttons fire a coming-soon toast instead. */}
    </div>
  );
}

// ─── Month grid ─────────────────────────────────────────────────────────────
function MonthGrid({
  days, cursor, eventsByDay, selectedDay, onPickDay, onCreateAt, onEditEvent,
}: {
  days: Date[];
  cursor: Date;
  eventsByDay: Map<string, CalEvent[]>;
  selectedDay: Date | null;
  onPickDay: (d: Date) => void;
  onCreateAt: (d: Date) => void;
  onEditEvent: (e: CalEvent) => void;
}) {
  const today = new Date();
  const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#F1F5F9' }}>
      <div className="grid grid-cols-7" style={{ background: '#F8FAFB', borderBottom: '1px solid #F1F5F9' }}>
        {weekLabels.map((l) => (
          <div key={l} className="text-[10px] font-bold uppercase tracking-wider py-2.5 text-center" style={{ color: '#6B7280' }}>
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(106px, 1fr)' }}>
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = isSameDay(d, today);
          const isSelected = !!selectedDay && isSameDay(d, selectedDay);
          const list = eventsByDay.get(d.toDateString()) ?? [];
          return (
            <div key={i}
              onClick={() => onPickDay(d)}
              onDoubleClick={() => onCreateAt(d)}
              className="relative group/cell border-r border-b cursor-pointer transition-colors"
              style={{
                borderColor: '#F1F5F9',
                background: isSelected ? '#F0FBFA' : inMonth ? 'white' : '#FAFBFC',
                color: inMonth ? '#1A202C' : '#9CA3AF',
              }}>
              <div className="flex items-start justify-between px-2 pt-1.5">
                <span className={`text-xs font-semibold inline-flex items-center justify-center ${isToday ? 'w-5 h-5 rounded-full text-white' : ''}`}
                  style={isToday ? { background: '#1EC9C4' } : undefined}>
                  {d.getDate()}
                </span>
                <button onClick={(e) => { e.stopPropagation(); onCreateAt(d); }}
                  className="opacity-0 group-hover/cell:opacity-100 w-5 h-5 rounded-full flex items-center justify-center hover:bg-[#DAF3F2] transition-all"
                  title="New event">
                  <Plus size={11} className="text-gray-400 group-hover/cell:text-[#0F766E]" />
                </button>
              </div>
              <div className="px-1.5 pb-1 space-y-0.5">
                {list.slice(0, 3).map((e) => (
                  <button key={e.id}
                    onClick={(ev) => { ev.stopPropagation(); onEditEvent(e); }}
                    className="w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate text-left hover:opacity-90"
                    style={{ background: e.color + '22', color: e.color, borderLeft: `2px solid ${e.color}` }}>
                    <span className="font-bold tabular-nums">{fmtTime(e.start)}</span>
                    <span className="truncate">{e.title}</span>
                    {e.googleEventId && <GoogleDot small />}
                  </button>
                ))}
                {list.length > 3 && (
                  <p className="text-[9px] italic px-1.5" style={{ color: '#9CA3AF' }}>+{list.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Agenda list ────────────────────────────────────────────────────────────
function AgendaList({ events, onEdit }: { events: CalEvent[]; onEdit: (e: CalEvent) => void }) {
  if (events.length === 0) {
    return (
      <div className="bg-white rounded-2xl border p-10 text-center" style={{ borderColor: '#F1F5F9' }}>
        <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: '#F3F4F6' }}>
          <CalendarIcon size={20} className="text-gray-300" />
        </div>
        <p className="text-sm font-medium" style={{ color: '#6B7280' }}>No upcoming events</p>
        <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Click <strong>New Event</strong> or double-click any day in Month view to add one.</p>
      </div>
    );
  }
  const groups: Record<string, CalEvent[]> = {};
  for (const e of events) {
    const day = new Date(e.start); day.setHours(0, 0, 0, 0);
    const k = day.toDateString();
    (groups[k] = groups[k] ?? []).push(e);
  }
  return (
    <div className="bg-white rounded-2xl border" style={{ borderColor: '#F1F5F9' }}>
      {Object.entries(groups).map(([k, list], idx) => {
        const d = new Date(k);
        return (
          <div key={k} className={idx === 0 ? '' : 'border-t'} style={{ borderColor: '#F1F5F9' }}>
            <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: '#F8FAFB' }}>
              <span className="text-xs font-bold" style={{ color: '#1A202C' }}>
                {d.toLocaleDateString('en-MY', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'white', color: '#6B7280' }}>{list.length}</span>
            </div>
            <ul>
              {list.map((e) => (
                <li key={e.id}>
                  <button onClick={() => onEdit(e)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left">
                    <div className="w-1 self-stretch rounded-full" style={{ background: e.color }} />
                    <div className="text-xs font-bold tabular-nums w-24 flex-shrink-0" style={{ color: '#374151' }}>
                      {fmtTime(e.start)} – {fmtTime(e.end)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1A202C' }}>{e.title}</p>
                      {e.location && (
                        <p className="text-[11px] truncate flex items-center gap-1" style={{ color: '#6B7280' }}>
                          <MapPin size={10} /> {e.location}
                        </p>
                      )}
                    </div>
                    {e.googleEventId && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex items-center gap-1"
                        style={{ background: '#E0F2FE', color: '#0369A1' }}>
                        <GoogleDot small /> Synced
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ─── Event create/edit modal ────────────────────────────────────────────────
function EventModal({
  existing, seed, myEmail, googleConnected, onClose, onSaved, onDeleted,
}: {
  existing: CalEvent | null;
  seed: { start: Date } | null;
  myEmail: string;
  googleConnected: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const initial: CalEvent = existing ?? {
    id: '',
    title: '',
    start: (seed?.start ?? new Date()).toISOString(),
    end:   new Date((seed?.start ?? new Date()).getTime() + 60 * 60_000).toISOString(),
    allDay: false,
    color: EVENT_COLORS[0],
    ownerId: '',
    attendees: [],
    clients: [],
  };
  void myEmail;

  const [title,    setTitle]    = useState(initial.title);
  const [date,     setDate]     = useState(toDateInput(initial.start));
  const [startTime, setStartTime] = useState(toTimeInput(initial.start));
  const [endTime,   setEndTime]   = useState(toTimeInput(initial.end));
  const [location, setLocation] = useState(initial.location ?? '');
  const [notes,    setNotes]    = useState(initial.notes ?? '');
  const [color,    setColor]    = useState(initial.color);
  const [attendees, setAttendees] = useState<string[]>(initial.attendees ?? []);
  const [clients,   setClients]   = useState<string[]>(initial.clients ?? []);
  const [listing,   setListing]   = useState<string>(initial.listing ?? '');
  const [syncGoogle, setSyncGoogle] = useState<boolean>(!!initial.googleEventId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const save = async () => {
    setError(null);
    if (!title.trim()) { setError('Please enter a title.'); return; }
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const dateObj = new Date(date + 'T00:00:00');
    if (Number.isNaN(dateObj.getTime())) { setError('Invalid date.'); return; }
    const startIso = isoFromDateTime(dateObj, sh, sm);
    const endIso   = isoFromDateTime(dateObj, eh, em);
    if (new Date(endIso) <= new Date(startIso)) { setError('End must be after start.'); return; }
    setBusy(true);
    try {
      let savedId: string | null = existing?.id ?? null;
      if (existing) {
        await updateEvent(existing.id, {
          title: title.trim(), start: startIso, end: endIso,
          location: location.trim() || null,
          notes: notes.trim() || null,
          attendees,
          clients: clients.length ? clients : [],
          listing: listing.trim() || null,
          color,
          allDay: false,
        });
        notifySuccess('Event updated');
      } else {
        const created = await createEvent({
          title: title.trim(), start: startIso, end: endIso,
          location: location.trim() || null,
          notes: notes.trim() || null,
          attendees,
          clients: clients.length ? clients : [],
          listing: listing.trim() || null,
          color,
          allDay: false,
        });
        savedId = created.id;
        notifySuccess('Event created');
      }

      // Real Google Calendar sync — fires only when the toggle is on AND
      // the user has linked Google. We push then stamp the returned event
      // id back onto the row so a future "Delete" can also remove the
      // Google side.
      if (syncGoogle && googleConnected && savedId) {
        try {
          const { id: gcalId } = await pushEventToGoogleCalendar({
            summary: title.trim(),
            description: notes.trim() || undefined,
            location: location.trim() || undefined,
            start: startIso,
            end:   endIso,
            allDay: false,
            attendees,
          });
          await updateEvent(savedId, {
            googleEventId: gcalId,
            syncedAt: new Date().toISOString(),
          });
          notifySuccess('Synced to Google Calendar');
        } catch (gcalErr) {
          // Don't fail the local save — surface a separate toast so the
          // user knows the local event saved but the Google push didn't.
          notifyError('Saved locally, but Google sync failed', gcalErr);
        }
      }

      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(msg);
      notifyError('Could not save the event', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-[480px] max-h-[90vh] flex flex-col overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '22' }}>
              <CalendarIcon size={15} style={{ color }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: '#1A202C' }}>{existing ? 'Edit event' : 'New event'}</h3>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                {googleConnected ? 'You can sync this event to Google Calendar' : 'Connect Google Calendar to sync events'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 pb-5 space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: '#6B7280' }}>Title</label>
            <TitlePicker value={title} onChange={setTitle} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
            </Field>
            <Field label="Start">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
            </Field>
            <Field label="End">
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
                style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
            </Field>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: '#6B7280' }}>Location</label>
            <LocationPicker value={location} onChange={setLocation} />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block flex items-center gap-1.5" style={{ color: '#6B7280' }}>
              Clients
              <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0 rounded" style={{ background: '#FEF3C7', color: '#92400E' }}>Soon</span>
            </label>
            <ChipInput value={clients} onChange={setClients} placeholder="Add a client name and press Enter" />
            <p className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>
              Will link to the Clients module once it ships.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block flex items-center gap-1.5" style={{ color: '#6B7280' }}>
              Listing
              <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0 rounded" style={{ background: '#FEF3C7', color: '#92400E' }}>Soon</span>
            </label>
            <input value={listing} onChange={(e) => setListing(e.target.value)}
              placeholder="Listing reference (e.g. project / unit)"
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
              style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
            <p className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>
              Will link to the Properties / Listings module once it ships.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: '#6B7280' }}>Attendees</label>
            <AttendeesPicker
              value={attendees}
              onChange={setAttendees}
              excludeEmail={myEmail}
            />
          </div>

          <Field label="Notes" icon={<FileText size={12} />}>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else for this event…" rows={3}
              className="w-full pl-8 pr-3 py-2 rounded-lg border outline-none text-sm resize-y focus:border-[#1EC9C4]"
              style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
          </Field>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>Color</p>
            <div className="flex items-center gap-2">
              {EVENT_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ background: c, boxShadow: c === color ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none' }}>
                  {c === color && <Check size={12} className="text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <label className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${googleConnected ? 'hover:bg-[#F0FBFA]' : 'opacity-60 cursor-not-allowed'}`}
            style={{ borderColor: syncGoogle ? '#1EC9C4' : '#E5E7EB', background: syncGoogle ? '#F0FBFA' : 'white' }}>
            <input type="checkbox" checked={syncGoogle} disabled={!googleConnected}
              onChange={(e) => setSyncGoogle(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#1EC9C4]" />
            <div className="flex-1">
              <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#1A202C' }}>
                <GoogleDot small /> Sync to Google Calendar
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>
                {googleConnected
                  ? 'Push this event to your connected Google account.'
                  : 'Connect Google Calendar first to enable syncing.'}
              </p>
              {existing?.googleEventId && (
                <p className="text-[10px] mt-1 inline-flex items-center gap-1" style={{ color: '#0F766E' }}>
                  <ExternalLink size={9} /> Already synced
                </p>
              )}
            </div>
          </label>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#991B1B' }}>
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100" style={{ background: '#F8FAFB' }}>
          {existing ? (
            confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1 rounded-lg border" style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>Cancel</button>
                <button onClick={async () => {
                  try {
                    // Best-effort remove from Google first; even if Google
                    // 404s we still want the local delete to proceed.
                    if (existing.googleEventId) {
                      try { await deleteEventFromGoogleCalendar(existing.googleEventId); }
                      catch (gErr) { notifyError('Could not remove from Google Calendar', gErr); }
                    }
                    await deleteEvent(existing.id);
                    notifySuccess('Event deleted');
                  } catch (e) {
                    notifyError('Could not delete the event', e);
                  }
                  onDeleted();
                }}
                  className="text-xs font-semibold px-3 py-1 rounded-lg text-white" style={{ background: '#DC2626' }}>Yes, delete</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border hover:bg-red-50"
                style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                <Trash2 size={12} /> Delete
              </button>
            )
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={busy}
              className="px-5 py-1.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: '#1EC9C4' }}>
              {busy && <Loader2 size={13} className="animate-spin" />}
              {existing ? 'Save changes' : 'Create event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ConnectGoogleModal removed — Google Calendar integration now fires a
// "coming soon" toast directly from the connect button. The real OAuth modal
// will live here once the Calendar API client id is provisioned.

// ─── Title picker — preset appointment types + free text ───────────────────
function TitlePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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

  const lower = value.trim().toLowerCase();
  const candidates = EVENT_TITLE_PRESETS.filter((p) => !lower || p.toLowerCase().includes(lower));

  return (
    <div ref={wrapRef} className="relative">
      <input value={value}
        onChange={(e) => { onChange(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoFocus
        placeholder="Tenant Appointment, Viewing at Millerz Square…"
        className="w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
        style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 py-1"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {candidates.length > 0 && (
            <>
              <div className="px-3 pt-1 pb-1.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                Quick picks
              </div>
              {candidates.map((p) => (
                <button key={p} onClick={() => { onChange(p); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left">
                  <CalendarIcon size={12} className="text-gray-400" />
                  <span style={{ color: '#374151' }}>{p}</span>
                  {value === p && <Check size={11} className="ml-auto text-[#1EC9C4]" strokeWidth={3} />}
                </button>
              ))}
            </>
          )}
          {value.trim() && !EVENT_TITLE_PRESETS.includes(value.trim() as never) && (
            <>
              {candidates.length > 0 && <div className="my-1 border-t border-gray-100" />}
              <button onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left">
                <Pencil size={11} className="text-gray-400" />
                <span style={{ color: '#374151' }}>Use custom: <strong className="truncate">{value.trim()}</strong></span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Generic chip input — used for the Clients field ────────────────────────
function ChipInput({ value, onChange, placeholder }: { value: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');

  const add = (s: string) => {
    const v = s.trim();
    if (!v) return;
    if (value.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...value, v]);
    setDraft('');
  };
  const remove = (s: string) => onChange(value.filter((x) => x !== s));

  return (
    <div className="w-full min-h-[42px] flex items-center flex-wrap gap-1.5 rounded-lg border px-2 py-1.5 focus-within:border-[#1EC9C4]"
      style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }}>
      {value.map((s) => (
        <span key={s}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
          style={{ background: 'white', border: '1px solid #FDE68A', color: '#92400E' }}>
          {s}
          <button onClick={() => remove(s)} className="ml-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-red-50"
            title={`Remove ${s}`}>
            <X size={9} className="text-gray-400 hover:text-red-500" />
          </button>
        </span>
      ))}
      <input value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
          else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => { if (draft.trim()) add(draft); }}
        placeholder={value.length ? '' : placeholder}
        className="flex-1 min-w-[140px] text-sm outline-none bg-transparent" />
    </div>
  );
}

// ─── Location picker — pick a Prospect Hub board (auto-fills name + subtitle)
// or type a custom address / meeting link.
interface PickerBoard {
  id: string;
  name: string;
  location: string;
  color: string;
}
function LocationPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<PickerBoard[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    listBoards()
      .then((rows) => { if (alive) setBoards(rows.map((b) => ({ id: b.id, name: b.name, location: b.location, color: b.color }))); })
      .catch(() => { /* picker just stays empty */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const lower = value.trim().toLowerCase();
  const candidates = boards.filter((b) => {
    if (!lower) return true;
    return b.name.toLowerCase().includes(lower) || (b.location ?? '').toLowerCase().includes(lower);
  });

  const pick = (b: PickerBoard) => {
    onChange(b.location ? `${b.name} · ${b.location}` : b.name);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <MapPin size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
        <input value={value}
          onChange={(e) => { onChange(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Pick a board or type address / meeting link"
          className="w-full pl-8 pr-3 py-2 rounded-lg border outline-none text-sm focus:border-[#1EC9C4]"
          style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }} />
      </div>
      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 py-1 max-h-64 overflow-auto"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {candidates.length > 0 ? (
            <>
              <div className="px-3 pt-1 pb-1.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                Project boards · {candidates.length}
              </div>
              {candidates.slice(0, 12).map((b) => (
                <button key={b.id} onClick={() => pick(b)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: b.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: '#2B3340' }}>{b.name}</p>
                    {b.location && (
                      <p className="text-[10px] truncate" style={{ color: '#9CA3AF' }}>{b.location}</p>
                    )}
                  </div>
                </button>
              ))}
              {candidates.length > 12 && (
                <div className="px-3 py-1.5 text-[10px] italic" style={{ color: '#9CA3AF' }}>
                  + {candidates.length - 12} more — keep typing to narrow…
                </div>
              )}
              <div className="my-1 border-t border-gray-100" />
            </>
          ) : (
            boards.length > 0 && (
              <div className="px-3 py-2 text-[10px] italic" style={{ color: '#9CA3AF' }}>No boards match — keep typing for a custom location.</div>
            )
          )}
          {value.trim() && (
            <button onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left">
              <MapPin size={13} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs" style={{ color: '#374151' }}>
                Use custom: <strong className="truncate">{value.trim()}</strong>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Attendees picker — chip list with autocomplete from the user directory ─
function AttendeesPicker({ value, onChange, excludeEmail }: {
  value: string[];
  onChange: (next: string[]) => void;
  excludeEmail?: string;
}) {
  const [draft, setDraft] = useState('');
  const [open, setOpen]   = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const lowerDraft = draft.trim().toLowerCase();
  const selectedSet = new Set(value.map((e) => e.toLowerCase()));
  const excludeLower = (excludeEmail ?? '').toLowerCase();
  const candidates = listAllUsers().filter((u) => {
    const e = u.email.toLowerCase();
    if (selectedSet.has(e)) return false;
    if (e === excludeLower) return false;
    if (!lowerDraft) return true;
    return u.name.toLowerCase().includes(lowerDraft) || e.includes(lowerDraft);
  });

  const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  const add = (email: string) => {
    const cleaned = email.trim();
    if (!cleaned) return;
    if (selectedSet.has(cleaned.toLowerCase())) return;
    onChange([...value, cleaned]);
    setDraft('');
  };
  const remove = (email: string) => onChange(value.filter((e) => e !== email));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      if (draft.trim()) {
        e.preventDefault();
        if (isEmail(draft.trim())) add(draft.trim());
      }
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div
        onClick={() => setOpen(true)}
        className="w-full min-h-[42px] flex items-center flex-wrap gap-1.5 rounded-lg border px-2 py-1.5 cursor-text focus-within:border-[#1EC9C4]"
        style={{ borderColor: '#E5E7EB', background: '#FAFBFC' }}>
        {value.map((email) => {
          const u = listAllUsers().find((x) => x.email.toLowerCase() === email.toLowerCase());
          const name = u?.name || email.split('@')[0];
          const initials = (u?.name || email).split(' ').map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
          return (
            <span key={email}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{ background: 'white', border: '1px solid #D1F2EF' }}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                style={{ background: u ? getAvatarColor(email) : '#9CA3AF' }}>
                {u && getAvatarImage(email)
                  ? <img src={getAvatarImage(email) as string} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[8px] font-bold text-white">{initials}</span>}
              </span>
              <span className="text-[11px] font-semibold" style={{ color: '#0F766E' }}>{name}</span>
              <button onClick={(e) => { e.stopPropagation(); remove(email); }}
                className="ml-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-red-50"
                title={`Remove ${name}`}>
                <X size={9} className="text-gray-400 hover:text-red-500" />
              </button>
            </span>
          );
        })}
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length ? '' : 'Pick a registered user or type an email'}
          className="flex-1 min-w-[140px] text-sm outline-none bg-transparent"
        />
      </div>

      {open && (candidates.length > 0 || (draft.trim() && isEmail(draft.trim()))) && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 py-1 max-h-64 overflow-auto"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {candidates.length > 0 && (
            <div className="px-3 pt-1 pb-1.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
              Registered users · {candidates.length}
            </div>
          )}
          {candidates.slice(0, 12).map((u) => {
            const initials = u.name.split(' ').map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
            return (
              <button key={u.email}
                onClick={() => add(u.email)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left">
                <span className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                  style={{ background: getAvatarColor(u.email) }}>
                  {getAvatarImage(u.email)
                    ? <img src={getAvatarImage(u.email) as string} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[9px] font-bold text-white">{initials}</span>}
                </span>
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
          {draft.trim() && isEmail(draft.trim()) && !selectedSet.has(draft.trim().toLowerCase()) && (
            <>
              {candidates.length > 0 && <div className="my-1 border-t border-gray-100" />}
              <button onClick={() => add(draft.trim())}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left">
                <Mail size={13} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs" style={{ color: '#374151' }}>
                  Invite external <strong>{draft.trim()}</strong>
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bits ───────────────────────────────────────────────────────────────────
function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: '#6B7280' }}>{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
        {children}
      </div>
    </div>
  );
}

function GoogleDot({ small = false, inverted = false }: { small?: boolean; inverted?: boolean }) {
  const size = small ? 11 : 14;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="flex-shrink-0">
      <path fill={inverted ? 'white' : '#4285F4'} d="M21.35 11.1H12v3.2h5.35c-.23 1.49-1.66 4.36-5.35 4.36-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.56-2.46C16.7 4.27 14.55 3.3 12 3.3 6.92 3.3 2.8 7.42 2.8 12.5s4.12 9.2 9.2 9.2c5.32 0 8.85-3.73 8.85-8.99 0-.6-.06-1.06-.15-1.61z" />
    </svg>
  );
}

function toDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
