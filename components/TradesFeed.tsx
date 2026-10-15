import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '../lib/cn';
import { fmt, fmtTime } from '../lib/format';
import type { PairInfo, Trade } from '../lib/types';
import { EmptyState, SkeletonRows } from './Panel';

export function TradesFeed({ trades, pair, loaded }: { trades: Trade[]; pair: PairInfo; loaded: boolean }) {
  if (!loaded) return <SkeletonRows rows={10} />;
  if (trades.length === 0) return <EmptyState title="No trades yet" hint="Trades appear here as soon as two orders match." />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-3 gap-2 border-b border-line px-3 py-1 text-xs text-muted">
        <span>Price ({pair.quote})</span>
        <span className="text-right">Amount ({pair.base})</span>
        <span className="text-right">Time</span>
      </div>
      <ul className="flex-1 overflow-y-auto" aria-label="Recent trades, newest first">
        {trades.map((t) => {
          const buy = t.side === 'buy';
          return (
            <li key={t.id} className="grid grid-cols-3 gap-2 px-3 py-0.5 text-sm">
              <span className={cn('num flex items-center gap-1', buy ? 'text-up' : 'text-down')}>
                {buy ? <ArrowUp size={12} strokeWidth={2} aria-label="Buy" /> : <ArrowDown size={12} strokeWidth={2} aria-label="Sell" />}
                {fmt(t.price, pair.pricePrecision)}
              </span>
              <span className="num text-right">{fmt(t.amount, pair.amountPrecision)}</span>
              <span className="num text-right text-muted">{fmtTime(t.time)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
