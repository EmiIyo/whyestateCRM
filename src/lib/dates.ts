// Shared date/time formatters — every page used to have its own slightly
// different `fmtDate`/`fmtTime`. One source of truth now; locale defaults to
// en-MY to match the rest of the product.

const LOCALE = 'en-MY';
const TZ = 'Asia/Kuala_Lumpur';

export function fmtDate(iso: string | null | undefined, opts?: { fallback?: string }): string {
  if (!iso) return opts?.fallback ?? '—';
  try {
    return new Date(iso).toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return opts?.fallback ?? iso;
  }
}

export function fmtDateTime(iso: string | null | undefined, opts?: { fallback?: string }): string {
  if (!iso) return opts?.fallback ?? '—';
  try {
    return new Date(iso).toLocaleString(LOCALE, {
      timeZone: TZ,
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return opts?.fallback ?? iso;
  }
}

export function fmtTime(iso: string | null | undefined, opts?: { fallback?: string }): string {
  if (!iso) return opts?.fallback ?? '—';
  try {
    return new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return opts?.fallback ?? iso;
  }
}

export function fmtMonth(d: Date): string {
  return d.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
}

export function fmtDayShort(d: Date): string {
  return d.toLocaleDateString(LOCALE, { weekday: 'short', day: '2-digit', month: 'short' });
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    const days = Math.floor(diff / 86400);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return fmtDate(iso);
  } catch { return '—'; }
}
