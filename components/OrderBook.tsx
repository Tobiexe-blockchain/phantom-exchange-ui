import { cn } from '../lib/cn';
import { fmt } from '../lib/format';
import type { Book, Level, PairInfo } from '../lib/types';
import { EmptyState, SkeletonRows } from './Panel';

const DEPTH = 12;

function Row({ level, total, max, side, pair }: { level: Level; total: number; max: number; side: 'bid' | 'ask'; pair: PairInfo }) {
  const pct = max > 0 ? Math.min(100, (total / max) * 100) : 0;
  return (
    <li className="relative grid grid-cols-3 gap-2 px-3 py-0.5 text-sm">
      <span
        aria-hidden
        className={cn('absolute inset-y-0 right-0', side === 'bid' ? 'bg-up-soft' : 'bg-down-soft')}
        style={{ width: `${pct}%` }}
      />
      <span className={cn('num relative', side === 'bid' ? 'text-up' : 'text-down')}>{fmt(level.price, pair.pricePrecision)}</span>
      <span className="num relative text-right">{fmt(level.amount, pair.amountPrecision)}</span>
      <span className="num relative text-right text-muted">{fmt(total, pair.amountPrecision)}</span>
    </li>
  );
}

function withTotals(levels: Level[]) {
  let sum = 0;
  return levels.map((l) => ({ level: l, total: (sum += l.amount) }));
}

export function OrderBook({ book, pair, loaded }: { book: Book; pair: PairInfo; loaded: boolean }) {
  if (!loaded) return <SkeletonRows rows={14} />;
  if (book.bids.length === 0 && book.asks.length === 0) {
    return <EmptyState title="The book is empty" hint="Place a limit order to create the first bid or ask." />;
  }

  const asks = withTotals(book.asks.slice(0, DEPTH));
  const bids = withTotals(book.bids.slice(0, DEPTH));
  const max = Math.max(asks.at(-1)?.total ?? 0, bids.at(-1)?.total ?? 0);
  const bestAsk = book.asks[0]?.price;
  const bestBid = book.bids[0]?.price;
  const spread = bestAsk !== undefined && bestBid !== undefined ? bestAsk - bestBid : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-3 gap-2 border-b border-line px-3 py-1 text-xs text-muted">
        <span>Price ({pair.quote})</span>
        <span className="text-right">Amount ({pair.base})</span>
        <span className="text-right">Total ({pair.base})</span>
      </div>
      <ul aria-label="Asks, lowest price last" className="flex flex-1 flex-col justify-end overflow-hidden">
        {[...asks].reverse().map(({ level, total }) => (
          <Row key={level.price} level={level} total={total} max={max} side="ask" pair={pair} />
        ))}
      </ul>
      <div className="num flex items-center justify-between gap-2 border-y border-line bg-raised px-3 py-1 text-sm">
        <span>Spread</span>
        <span>{spread !== null ? `${fmt(spread, pair.pricePrecision)} (${fmt((spread / bestAsk!) * 100, 3)}%)` : 'No spread'}</span>
      </div>
      <ul aria-label="Bids, highest price first" className="flex-1 overflow-hidden">
        {bids.map(({ level, total }) => (
          <Row key={level.price} level={level} total={total} max={max} side="bid" pair={pair} />
        ))}
      </ul>
    </div>
  );
}
