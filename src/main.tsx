import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { bootAuth } from '@/lib/auth';
import { bootPermissions, subscribePermissionsRealtime } from '@/lib/permissions';

// One-time wipe of legacy localStorage left over from the pre-Supabase build.
// Runs once per browser (flag prevents re-runs). Preserves only `we.auth`
// (Supabase session) and the migration flag itself.
const MIGRATION_FLAG = 'we.migrated.v1';
function purgeLegacyLocalStorage(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATION_FLAG) === '1') return;
  const KEEP = new Set([MIGRATION_FLAG, 'we.auth']);
  const toDrop: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('we.') && !KEEP.has(k)) toDrop.push(k);
  }
  for (const k of toDrop) localStorage.removeItem(k);
  localStorage.setItem(MIGRATION_FLAG, '1');
}

// Hydrate auth + permissions before rendering so synchronous guards
// (RequireAuth, canDo) see the real state on first render.
async function start(): Promise<void> {
  purgeLegacyLocalStorage();
  await Promise.all([bootAuth(), bootPermissions()]);
  subscribePermissionsRealtime();
  createRoot(document.getElementById('root')!).render(<App />);
}

void start();
