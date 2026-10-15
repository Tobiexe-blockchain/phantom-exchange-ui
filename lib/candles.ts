import type { Candle } from './types';

const MAX_CANDLES = 500;

export function bucketStart(timeSec: number, timeframeMin: number): number {
  const size = timeframeMin * 60;
  return Math.floor(timeSec / size) * size;
}

/** Folds one trade into a list of 1 minute candles. Returns a new array. */
export function applyTrade(candles: Candle[], trade: { price: number; time: number }): Candle[] {
  const start = bucketStart(trade.time / 1000, 1);
  const last = candles[candles.length - 1];
  if (last && last.time === start) {
    const updated: Candle = {
      ...last,
      high: Math.max(last.high, trade.price),
      low: Math.min(last.low, trade.price),
      close: trade.price,
    };
    return [...candles.slice(0, -1), updated];
  }
  if (last && start < last.time) return candles; // late trade, ignore
  const next: Candle = { time: start, open: last ? last.close : trade.price, high: trade.price, low: trade.price, close: trade.price };
  return [...candles, next].slice(-MAX_CANDLES);
}

/** Groups 1 minute candles into larger timeframes. */
export function aggregate(candles: Candle[], timeframeMin: number): Candle[] {
  if (timeframeMin === 1) return candles;
  const out: Candle[] = [];
  for (const c of candles) {
    const start = bucketStart(c.time, timeframeMin);
    const last = out[out.length - 1];
    if (last && last.time === start) {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
    } else {
      out.push({ time: start, open: c.open, high: c.high, low: c.low, close: c.close });
    }
  }
  return out;
}
