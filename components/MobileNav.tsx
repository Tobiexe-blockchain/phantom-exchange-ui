import { Activity, ArrowLeftRight, Layers, ListChecks } from 'lucide-react';
import { cn } from '../lib/cn';

export type Tab = 'chart' | 'book' | 'trade' | 'orders';

const TABS = [
  { id: 'chart', label: 'Chart', Icon: Activity },
  { id: 'book', label: 'Book', Icon: Layers },
  { id: 'trade', label: 'Trade', Icon: ArrowLeftRight },
  { id: 'orders', label: 'Orders', Icon: ListChecks },
] as const;

export function MobileNav({ tab, onChange }: { tab: Tab; onChange(t: Tab): void }) {
  return (
    <nav aria-label="Sections" className="z-[var(--z-sticky)] grid shrink-0 grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => onChange(id)}
          className={cn('flex min-h-14 flex-col items-center justify-center gap-1 text-xs', tab === id ? 'text-fg' : 'text-muted')}
        >
          <Icon size={20} strokeWidth={tab === id ? 2 : 1.6} aria-hidden />
          <span className={tab === id ? 'font-medium underline underline-offset-4' : ''}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
