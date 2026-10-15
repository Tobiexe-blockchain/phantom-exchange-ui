import { describe, expect, it } from 'vitest';
import { aggregate, applyTrade, bucketStart } from '../lib/candles';
import type { Candle } from '../lib/types';

const c = (time: number, open: number, high: number, low: number, close: number): Candle => ({ time, open, high, low, close });

describe('bucketStart', () => {
  it('floors to the timeframe boundary', () => {
    expect(bucketStart(125, 1)).toBe(120);
    expect(bucketStart(899, 5)).toBe(600);
    expect(bucketStart(900, 15)).toBe(900);
  });
});

describe('applyTrade', () => {
  it('updates the current candle', () => {
    const out = applyTrade([c(60, 10, 11, 9, 10)], { price: 12, time: 90_000 });
    expect(out).toEqual([c(60, 10, 12, 9, 12)]);
  });

  it('opens a new candle at the previous close', () => {
    const out = applyTrade([c(60, 10, 11, 9, 10.5)], { price: 12, time: 125_000 });
    expect(out[1]).toEqual(c(120, 10.5, 12, 12, 12));
  });

  it('ignores trades older than the last candle', () => {
    const list = [c(120, 10, 10, 10, 10)];
    expect(applyTrade(list, { price: 50, time: 61_000 })).toBe(list);
  });

  it('does not mutate its input', () => {
    const list = [c(60, 10, 11, 9, 10)];
    applyTrade(list, { price: 99, time: 61_000 });
    expect(list[0].close).toBe(10);
  });

  it('starts from nothing', () => {
    expect(applyTrade([], { price: 5, time: 61_000 })).toEqual([c(60, 5, 5, 5, 5)]);
  });
});

describe('aggregate', () => {
  const one = [c(0, 1, 2, 0.5, 1.5), c(60, 1.5, 3, 1, 2), c(120, 2, 2.5, 1.8, 2.2), c(300, 2.2, 4, 2, 3)];

  it('returns the input for 1 minute', () => {
    expect(aggregate(one, 1)).toBe(one);
  });

  it('groups candles into 5 minute buckets', () => {
    expect(aggregate(one, 5)).toEqual([c(0, 1, 3, 0.5, 2.2), c(300, 2.2, 4, 2, 3)]);
  });

  it('does not mutate its input', () => {
    aggregate(one, 5);
    expect(one[0].high).toBe(2);
  });
});
