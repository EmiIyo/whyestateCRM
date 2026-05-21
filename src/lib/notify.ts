// Centralised user feedback — every silent `console.error` should call one of
// these so the user actually sees what went wrong. Backed by sonner (already a
// dependency). Sentry/Logflare wiring can layer on top later without changing
// the call sites.

import { toast } from 'sonner';

export function notifySuccess(message: string, opts?: { description?: string }): void {
  toast.success(message, { description: opts?.description });
}

export function notifyInfo(message: string, opts?: { description?: string; duration?: number }): void {
  toast(message, { description: opts?.description, duration: opts?.duration });
}

export function notifyWarning(message: string, opts?: { description?: string }): void {
  toast.warning(message, { description: opts?.description });
}

// `notifyError` is the workhorse: pass any thrown value, get a sane toast.
// Logs to console too so developers still see the stack in DevTools.
export function notifyError(message: string, err?: unknown): void {
  const detail =
    err instanceof Error ? err.message
    : typeof err === 'string' ? err
    : err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string'
      ? (err as { message: string }).message
      : undefined;
  toast.error(message, { description: detail });
  if (err !== undefined) {
    // eslint-disable-next-line no-console
    console.error(message, err);
  }
}

// "Coming soon" for half-finished features (Google sync etc).
export function notifyComingSoon(feature: string): void {
  toast(`${feature} — coming soon`, {
    description: 'This integration is not wired up yet.',
    duration: 2200,
  });
}
