// Global imperative confirm dialog — replaces `window.confirm()` everywhere.
// Mount <ConfirmHost /> once at the app root, then call the imperative
// `confirm(opts)` helper from anywhere. Radix backs the dialog so we get
// focus trap, Esc, backdrop click, aria-modal for free.

import { create } from 'zustand';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmState {
  opts: ConfirmOptions | null;
  resolver: ((ok: boolean) => void) | null;
  open: (opts: ConfirmOptions, resolver: (ok: boolean) => void) => void;
  close: (ok: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  opts: null,
  resolver: null,
  open: (opts, resolver) => set({ opts, resolver }),
  close: (ok) => {
    const r = get().resolver;
    set({ opts: null, resolver: null });
    if (r) r(ok);
  },
}));

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().open(opts, resolve);
  });
}

export function ConfirmHost(): React.ReactElement | null {
  const opts  = useConfirmStore((s) => s.opts);
  const close = useConfirmStore((s) => s.close);

  return (
    <AlertDialog open={!!opts} onOpenChange={(o) => { if (!o) close(false); }}>
      {opts && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts.title}</AlertDialogTitle>
            {opts.description && (
              <AlertDialogDescription>{opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>
              {opts.cancelLabel ?? 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={opts.destructive ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
            >
              {opts.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
