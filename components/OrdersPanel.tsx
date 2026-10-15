'use client';

import { useEffect, useState } from 'react';
import { cn } from '../lib/cn';
import { fmt, fmtTime } from '../lib/format';
import type { ActionResult } from '../lib/feed/types';
import { PAIRS } from '../lib/types';
import type { Order } from '../lib/types';
import { EmptyState } from './Panel';

type View = 'open' | 'history';

const infoFor = (pairId: string) => PAIRS.find((p) => p.id === pairId) ?? PAIRS[0];

function CancelButton({ order, onCancel }: { order: Order; onCancel(id: string): Promise<ActionResult> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="min-h-11 min-w-11 rounded-sm border border-line px-3 text-sm hover:text-down">
        Cancel
      </button>
    );
  }
  return (
    <span className="flex gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onCancel(order.id);
          setBusy(false);
          setConfirming(false);
        }}
        className="min-h-11 rounded-sm border border-down px-3 text-sm text-down"
      >
        Cancel order
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-sm border border-line px-3 text-sm">
        Keep
      </button>
    </span>
  );
}

export function OrdersPanel({ orders, onCancel }: { orders: Order[]; onCancel(id: string): Promise<ActionResult> }) {
  const [view, setView] = useState<View>('open');
  const open = orders.filter((o) => o.status === 'open');
  const history = orders.filter((o) => o.status !== 'open');
  const rows = view === 'open' ? open : history;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Order lists" className="flex gap-2 border-b border-line px-3 py-1">
        {(['open', 'history'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn('min-h-11 rounded-sm border px-3 text-sm', view === v ? 'border-fg bg-raised' : 'border-transparent text-muted hover:text-fg')}
          >
            {v === 'open' ? `Open orders (${open.length})` : 'Order history'}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={view === 'open' ? 'No open orders' : 'No order history yet'}
          hint={view === 'open' ? 'Limit orders that have not matched wait here until they fill or you cancel them.' : 'Filled and cancelled orders show up here.'}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-1 font-normal">Time</th>
                <th className="px-3 py-1 font-normal">Pair</th>
                <th className="px-3 py-1 font-normal">Side</th>
                <th className="px-3 py-1 font-normal">Type</th>
                <th className="px-3 py-1 text-right font-normal">Price</th>
                <th className="px-3 py-1 text-right font-normal">Amount</th>
                <th className="px-3 py-1 text-right font-normal">Filled</th>
                <th className="px-3 py-1 text-right font-normal">{view === 'open' ? 'Action' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const p = infoFor(o.pair);
                return (
                  <tr key={o.id} className="border-t border-line hover:bg-raised">
                    <td className="num px-3 py-1 text-muted">{fmtTime(o.createdAt)}</td>
                    <td className="num px-3 py-1">{o.pair.replace('-', '/')}</td>
                    <td className={cn('px-3 py-1 font-medium', o.side === 'buy' ? 'text-up' : 'text-down')}>{o.side === 'buy' ? 'Buy' : 'Sell'}</td>
                    <td className="px-3 py-1">{o.type === 'limit' ? 'Limit' : 'Market'}</td>
                    <td className="num px-3 py-1 text-right">{o.price !== null ? fmt(o.price, p.pricePrecision) : 'Market'}</td>
                    <td className="num px-3 py-1 text-right">{fmt(o.amount, p.amountPrecision)}</td>
                    <td className="num px-3 py-1 text-right">{fmt(o.filled, p.amountPrecision)}</td>
                    <td className="px-3 py-1 text-right">
                      {view === 'open' ? (
                        <div className="flex justify-end">
                          <CancelButton order={o} onCancel={onCancel} />
                        </div>
                      ) : (
                        <span>{o.status === 'filled' ? 'Filled' : 'Cancelled'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
