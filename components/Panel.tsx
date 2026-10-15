import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface PanelProps {
  area: 'chart' | 'book' | 'form' | 'orders' | 'trades' | 'balances';
  title: string;
  /** Whether the panel shows on small screens. Always visible from 1024px. */
  active: boolean;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ area, title, active, actions, className, children }: PanelProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        `area-${area}`,
        'min-h-0 min-w-0 shrink-0 flex-col bg-surface lg:shrink',
        active ? 'flex' : 'hidden lg:flex',
        className,
      )}
    >
      <header className="flex min-h-11 items-center justify-between gap-2 border-b border-line px-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {actions}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-1 p-4">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-[40ch] text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function SkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-4 rounded-sm bg-raised" />
      ))}
    </div>
  );
}
