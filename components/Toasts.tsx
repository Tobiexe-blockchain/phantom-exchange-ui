'use client';

import { useCallback, useState } from 'react';
import { X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );
  return { toasts, push, dismiss };
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss(id: number): void }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[var(--z-toast)] flex flex-col items-center gap-2 px-3 lg:bottom-4 lg:items-end">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-md border border-line bg-raised py-1 pl-3 pr-1 text-sm shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
          <span>{t.message}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => onDismiss(t.id)} className="flex min-h-11 min-w-11 items-center justify-center rounded-sm text-muted hover:text-fg">
            <X size={16} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
