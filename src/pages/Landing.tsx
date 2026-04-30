import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, LayoutGrid, Filter, Users, FileSpreadsheet, ShieldCheck, Zap, Check,
} from 'lucide-react';
import AuthModal from '@/components/AuthModal';
import { isAuthed } from '@/lib/auth';
import { ROUTE_PATHS } from '@/lib/index';

export default function Landing() {
  const [authOpen, setAuthOpen]   = useState(false);
  const [authMode, setAuthMode]   = useState<'signin' | 'signup'>('signin');
  const navigate = useNavigate();

  // If user is already authed, jump straight into the CRM.
  useEffect(() => {
    if (isAuthed()) navigate(ROUTE_PATHS.LEADS, { replace: true });
  }, [navigate]);

  const open = (mode: 'signin' | 'signup') => { setAuthMode(mode); setAuthOpen(true); };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FFFFFF' }}>
      {/* Top nav */}
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b" style={{ borderColor: '#F1F5F9' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src="/logo-wordmark.png" alt="whyEstate" className="h-9 w-auto select-none" draggable={false} />
          <div className="flex items-center gap-2">
            <button onClick={() => open('signin')}
              className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              style={{ color: '#374151' }}>
              Sign In
            </button>
            <button onClick={() => open('signup')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: '#1EC9C4' }}>
              Get Started <ArrowRight size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pt-20 pb-24" style={{ background: 'linear-gradient(180deg, #F0FFFE 0%, #FFFFFF 100%)' }}>
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-6"
            style={{ background: '#DAF3F2', color: '#0F766E' }}>
            <Zap size={11} /> Built for Malaysian property agents
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-5"
            style={{ color: '#0F172A' }}>
            Real estate sales,<br />
            <span style={{ color: '#1EC9C4' }}>finally organised.</span>
          </h1>
          <p className="text-base sm:text-lg max-w-2xl mx-auto mb-8" style={{ color: '#64748B' }}>
            Manage prospects, listings, and deals across every project board you run — without losing track of a single
            unit, contact, or follow-up.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={() => open('signup')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: '#1EC9C4', boxShadow: '0 8px 24px rgba(30,201,196,0.35)' }}>
              Get started free <ArrowRight size={16} strokeWidth={2.5} />
            </button>
            <button onClick={() => open('signin')}
              className="px-6 py-3 rounded-xl text-base font-semibold border hover:bg-gray-50 transition-colors"
              style={{ borderColor: '#E5E7EB', color: '#374151' }}>
              Sign in
            </button>
          </div>

          {/* Inline trust line */}
          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 mt-8 text-xs" style={{ color: '#94A3B8' }}>
            <span className="flex items-center gap-1.5"><Check size={12} style={{ color: '#10B981' }} /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Check size={12} style={{ color: '#10B981' }} /> Free for your first board</span>
            <span className="flex items-center gap-1.5"><Check size={12} style={{ color: '#10B981' }} /> KL &amp; Selangor focused</span>
          </div>
        </div>
      </section>

      {/* Hero preview card */}
      <section className="px-6 -mt-10 pb-20">
        <div className="max-w-5xl mx-auto rounded-2xl overflow-hidden border bg-white"
          style={{ borderColor: '#E5E7EB', boxShadow: '0 30px 80px rgba(15,23,42,0.12)' }}>
          <div className="grid gap-3 p-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {[
              { color: '#F97316', name: 'Millerz Square',  loc: 'Old Klang Road' },
              { color: '#1EC9C4', name: 'AKASA',           loc: 'Cheras' },
              { color: '#8B5CF6', name: 'The Rainz',       loc: 'Bukit Jalil' },
              { color: '#EF4444', name: 'Nidoz Residence', loc: 'Desa Petaling' },
            ].map((b) => (
              <div key={b.name} className="rounded-xl p-4 flex flex-col gap-1.5" style={{ background: b.color, minHeight: 116 }}>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/85">• PROJECT</span>
                <p className="text-sm font-bold text-white leading-tight">{b.name}</p>
                <p className="text-xs text-white/85 leading-tight">{b.loc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20" style={{ background: '#F8FAFC' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: '#0F172A' }}>
              Everything you need. Nothing you don't.
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: '#64748B' }}>
              Purpose-built for the way property agents actually work — from cold call to closed deal.
            </p>
          </div>

          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white p-6 border transition-all hover:-translate-y-0.5 hover:shadow-lg"
                style={{ borderColor: '#E5E7EB' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: f.bg }}>
                  <f.Icon size={20} style={{ color: f.color }} strokeWidth={2.2} />
                </div>
                <h3 className="text-base font-bold mb-1.5" style={{ color: '#0F172A' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto rounded-3xl text-center px-8 py-14"
          style={{ background: 'linear-gradient(135deg, #27B1AD 0%, #1EC9C4 100%)' }}>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Ready to clean up your prospect list?</h2>
          <p className="text-sm sm:text-base text-white/90 mb-6 max-w-xl mx-auto">
            Spin up your first project board in under a minute. No setup, no migration headaches.
          </p>
          <button onClick={() => open('signup')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold bg-white hover:bg-gray-50 transition-colors"
            style={{ color: '#0F766E' }}>
            Create your account <ArrowRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 border-t mt-auto" style={{ borderColor: '#F1F5F9' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo-icon.png" alt="" className="h-6 w-6 select-none" draggable={false} />
            <span className="text-xs" style={{ color: '#94A3B8' }}>© {new Date().getFullYear()} whyEstate. Built for Malaysian property agents.</span>
          </div>
          <div className="flex items-center gap-5 text-xs" style={{ color: '#94A3B8' }}>
            <a className="hover:text-[#1EC9C4] transition-colors" href="#features">Features</a>
            <a className="hover:text-[#1EC9C4] transition-colors" href="#" onClick={(e) => { e.preventDefault(); open('signin'); }}>Sign In</a>
            <a className="hover:text-[#1EC9C4] transition-colors" href="#" onClick={(e) => { e.preventDefault(); open('signup'); }}>Sign Up</a>
          </div>
        </div>
      </footer>

      <AuthModal open={authOpen} initialMode={authMode} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

const FEATURES: { title: string; desc: string; Icon: React.ElementType; color: string; bg: string }[] = [
  {
    title: 'Project Boards',
    desc:  'Group prospects by project — Millerz Square, AKASA, The Rainz — and switch between them instantly.',
    Icon:  LayoutGrid, color: '#1EC9C4', bg: '#DAF3F2',
  },
  {
    title: 'Multi-select Filters',
    desc:  'Slice your list by calling status, furnishing, asking-rent range, and more. No SQL needed.',
    Icon:  Filter, color: '#8B5CF6', bg: '#EDE9FE',
  },
  {
    title: 'Team Collaboration',
    desc:  'Invite editors and viewers per board. Everyone sees the same source of truth, in real time.',
    Icon:  Users, color: '#F97316', bg: '#FFEDD5',
  },
  {
    title: 'CSV Import & Export',
    desc:  'Bring your existing units in once. Export per-board CSVs whenever your developer asks for one.',
    Icon:  FileSpreadsheet, color: '#16A34A', bg: '#DCFCE7',
  },
  {
    title: 'Audit-friendly',
    desc:  'Every cell change is timestamped to Malaysia time. Stop arguing about who changed what, when.',
    Icon:  ShieldCheck, color: '#0EA5E9', bg: '#E0F2FE',
  },
  {
    title: 'Spreadsheet-fast',
    desc:  'Drag-fill cells, double-click to edit, ranged filters with sliders. Built for keyboards.',
    Icon:  Zap, color: '#EAB308', bg: '#FEF9C3',
  },
];
