'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { aggregate } from '../lib/candles';
import { cn } from '../lib/cn';
import { fmt } from '../lib/format';
import type { Candle, PairInfo } from '../lib/types';
import { EmptyState } from './Panel';

const TIMEFRAMES = [1, 5, 15] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const toBar = (c: Candle) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close });

export function TimeframeSwitch({ value, onChange }: { value: Timeframe; onChange(v: Timeframe): void }) {
  return (
    <div role="group" aria-label="Chart timeframe" className="flex gap-2">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          type="button"
          aria-pressed={value === tf}
          onClick={() => onChange(tf)}
          className={cn(
            'num min-h-11 min-w-11 rounded-sm border px-3 text-sm transition-colors duration-150',
            value === tf ? 'border-fg bg-raised text-fg' : 'border-line text-muted hover:text-fg',
          )}
        >
          {tf}m
        </button>
      ))}
    </div>
  );
}

export function Chart({ candles, pair, timeframe }: { candles: Candle[]; pair: PairInfo; timeframe: Timeframe }) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const drawn = useRef({ key: '', length: 0 });
  const [ready, setReady] = useState(false);

  const data = useMemo(() => aggregate(candles, timeframe), [candles, timeframe]);

  useEffect(() => {
    if (!host.current) return;
    const c = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: css('--surface') }, textColor: css('--text-muted'), fontFamily: 'JetBrains Mono, monospace', fontSize: 12 },
      grid: { vertLines: { color: css('--border') }, horzLines: { color: css('--border') } },
      rightPriceScale: { borderColor: css('--border') },
      timeScale: { borderColor: css('--border'), timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: css('--text-muted') }, horzLine: { color: css('--text-muted') } },
    });
    const s = c.addCandlestickSeries({
      upColor: css('--success'),
      downColor: css('--danger'),
      wickUpColor: css('--success'),
      wickDownColor: css('--danger'),
      borderVisible: false,
    });
    chart.current = c;
    series.current = s;
    setReady(true);
    return () => {
      c.remove();
      chart.current = null;
      series.current = null;
      drawn.current = { key: '', length: 0 };
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const s = series.current;
    if (!ready || !s || data.length === 0) return;
    const key = `${pair.id}:${timeframe}`;
    if (drawn.current.key !== key || data.length < drawn.current.length || data.length - drawn.current.length > 1) {
      s.setData(data.map(toBar));
      chart.current?.timeScale().fitContent();
    } else {
      s.update(toBar(data[data.length - 1]));
    }
    drawn.current = { key, length: data.length };
  }, [data, pair.id, timeframe, ready]);

  const last = data[data.length - 1];

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={host} className="absolute inset-0" role="img" aria-label={`${pair.base} to ${pair.quote} candlestick chart, ${timeframe} minute candles`} />
      {last && (
        <p className="sr-only">
          Latest {timeframe} minute candle: open {fmt(last.open, pair.pricePrecision)}, high {fmt(last.high, pair.pricePrecision)}, low{' '}
          {fmt(last.low, pair.pricePrecision)}, close {fmt(last.close, pair.pricePrecision)}.
        </p>
      )}
      {data.length === 0 && (
        <div className="absolute inset-0 flex bg-surface">
          <EmptyState title="No candles yet" hint="The chart fills in as trades arrive for this pair." />
        </div>
      )}
    </div>
  );
}

export type { Timeframe };
export { TIMEFRAMES };
