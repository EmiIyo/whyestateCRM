import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { bootAuth } from '@/lib/auth';
import { bootPermissions, subscribePermissionsRealtime } from '@/lib/permissions';

// Hydrate auth + permissions before rendering so synchronous guards
// (RequireAuth, canDo) see the real state on first render.
async function start(): Promise<void> {
  await Promise.all([bootAuth(), bootPermissions()]);
  subscribePermissionsRealtime();
  createRoot(document.getElementById('root')!).render(<App />);
}

void start();
