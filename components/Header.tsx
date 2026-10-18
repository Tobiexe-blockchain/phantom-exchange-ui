import { ArrowDown, ArrowUp, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { config } from '../lib/config';
import { cn } from '../lib/cn';
import { fmt, fmtCompact, fmtPercent } from '../lib/format';
import { PAIRS } from '../lib/types';
import type { ConnectionStatus, PairInfo, Ticker } from '../lib/types';

interface HeaderProps {
  pair: PairInfo;
  onPairChange(id: string): void;
  ticker: Ticker | null;
  status: ConnectionStatus;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  live: 'Live',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  offline: 'Offline. Check the server.',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted">{label}</span>
      <span className="num text-sm">{value}</span>
    </div>
  );
}

export function Header({ pair, onPairChange, ticker, status }: HeaderProps) {
  const up = (ticker?.change24h ?? 0) >= 0;
  const StatusIcon = status === 'live' ? Wifi : status === 'offline' ? WifiOff : RefreshCw;

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-surface px-3 py-2 pt-[max(8px,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2">
        <label htmlFor="pair" className="sr-only">
          Trading pair
        </label>
        <select
          id="pair"
          value={pair.id}
          onChange={(e) => onPairChange(e.target.value)}
          className="num min-h-11 rounded-md border border-line bg-raised px-3 text-base font-medium"
        >
          {PAIRS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.base}/{p.quote}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <span className="text-xs text-muted">Last price</span>
        <span className={cn('num text-xl font-medium', ticker && (up ? 'text-up' : 'text-down'))}>
          {ticker ? fmt(ticker.last, pair.pricePrecision) : '...'}
        </span>
      </div>

      <div className="flex flex-col">
        <span className="text-xs text-muted">24h change</span>
        <span className={cn('num flex items-center gap-1 text-sm', ticker && (up ? 'text-up' : 'text-down'))}>
          {ticker ? (
            <>
              {up ? <ArrowUp size={12} strokeWidth={2} aria-hidden /> : <ArrowDown size={12} strokeWidth={2} aria-hidden />}
              {fmtPercent(ticker.change24h)}
            </>
          ) : (
            '...'
          )}
        </span>
      </div>

      <div className="hidden gap-6 sm:flex">
        <Stat label="24h high" value={ticker ? fmt(ticker.high24h, pair.pricePrecision) : '...'} />
        <Stat label="24h low" value={ticker ? fmt(ticker.low24h, pair.pricePrecision) : '...'} />
        <Stat label={`24h volume (${pair.base})`} value={ticker ? fmtCompact(ticker.volume24h) : '...'} />
      </div>

      <p role="status" className="ml-auto flex items-center gap-2 text-sm text-muted">
        <StatusIcon size={16} strokeWidth={1.8} aria-hidden />
        <span>
          {STATUS_LABEL[status]}
          {config.source !== 'engine' && status === 'live' ? ' (demo data)' : ''}
        </span>
      </p>
    </header>
  );
}
