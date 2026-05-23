import { LayoutDashboard, Sparkles } from 'lucide-react';

// Dashboard is intentionally a placeholder — the live KPI/pipeline data layer
// hasn't been built yet. Showing hard-coded mocks risked confusing users into
// trusting fake numbers, so we ship a friendly empty state until the real
// analytics pipeline is wired up.

export default function Dashboard(): React.ReactElement {
  return (
    <div className="flex-1 overflow-auto" style={{ background: '#F5F7FA' }}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl border p-10 text-center" style={{ borderColor: '#F1F5F9' }}>
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
            style={{ background: '#DAF3F2' }}>
            <LayoutDashboard size={26} style={{ color: '#0F766E' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#1A202C' }}>Dashboard coming soon</h1>
          <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: '#6B7280' }}>
            We're wiring real KPIs and pipeline analytics into this view.
            For now use <strong>Prospect Hub</strong>, <strong>Clients</strong>, and <strong>Calendar</strong> to run your day-to-day.
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-5 text-xs font-semibold" style={{ color: '#0F766E' }}>
            <Sparkles size={13} /> In development
          </div>
        </div>
      </div>
    </div>
  );
}
