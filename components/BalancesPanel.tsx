import { fmt } from '../lib/format';
import type { Balances } from '../lib/types';
import { EmptyState, SkeletonRows } from './Panel';

const decimals = (currency: string) => (currency === 'USDT' ? 2 : 5);

export function BalancesPanel({ balances, loaded }: { balances: Balances | null; loaded: boolean }) {
  if (!loaded) return <SkeletonRows rows={4} />;
  if (!balances) return <EmptyState title="Balances are not connected" hint="Point this screen at the ledger service to see available and locked funds." />;
  const entries = Object.entries(balances);
  if (entries.length === 0) return <EmptyState title="No funds yet" hint="Deposit funds to start trading." />;

  return (
    <table className="w-full border-collapse text-sm">
      <thead className="text-left text-xs text-muted">
        <tr>
          <th className="px-3 py-1 font-normal">Asset</th>
          <th className="px-3 py-1 text-right font-normal">Available</th>
          <th className="px-3 py-1 text-right font-normal">In orders</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([currency, b]) => (
          <tr key={currency} className="border-t border-line">
            <th scope="row" className="px-3 py-2 text-left font-medium">
              {currency}
            </th>
            <td className="num px-3 py-2 text-right">{fmt(b.available, decimals(currency))}</td>
            <td className="num px-3 py-2 text-right text-muted">{fmt(b.locked, decimals(currency))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
