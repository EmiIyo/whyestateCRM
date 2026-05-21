// Tiny helper for "are you sure you want to discard your changes?" prompts on
// modal close / route change. Wraps the dirty-state tracking + browser
// beforeunload listener so call-sites only need to compute `isDirty`.

import { useCallback, useEffect } from 'react';

export function useUnsavedGuard(isDirty: boolean): {
  /** Call when the user tries to close — returns true if it's safe to close. */
  confirmClose: () => boolean;
} {
  // Block accidental tab close / refresh while the form is dirty.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const confirmClose = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm('Discard your unsaved changes?');
  }, [isDirty]);

  return { confirmClose };
}
