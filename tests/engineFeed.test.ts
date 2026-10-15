import { describe, expect, it } from 'vitest';
import { normalizeBook, normalizeTrade } from '../lib/feed/engine';

describe('engine normalizers', () => {
  it('reads levels as arrays or objects and sorts them', () => {
    const book = normalizeBook({
      bids: [[99, 1], { price: '100', quantity: '2' }],
      asks: [{ price: 102, qty: 1 }, [101, '3']],
    });
    expect(book.bids.map((l) => l.price)).toEqual([100, 99]);
    expect(book.asks.map((l) => l.price)).toEqual([101, 102]);
    expect(book.asks[0].amount).toBe(3);
  });

  it('drops empty or invalid levels', () => {
    expect(normalizeBook({ bids: [[0, 1], [5, 0]], asks: 'x' })).toEqual({ bids: [], asks: [] });
  });

  it('normalizes a trade with ISO and unix timestamps', () => {
    const a = normalizeTrade({ price: '10.5', quantity: '2', side: 'sell', timestamp: '2026-01-01T00:00:00Z' });
    expect(a).toMatchObject({ price: 10.5, amount: 2, side: 'sell', time: Date.parse('2026-01-01T00:00:00Z') });
    expect(normalizeTrade({ price: 1, qty: 1, time: 1_700_000_000 })?.time).toBe(1_700_000_000_000);
  });

  it('rejects trades without a price or quantity', () => {
    expect(normalizeTrade({ price: 0, quantity: 1 })).toBeNull();
    expect(normalizeTrade({ price: 1 })).toBeNull();
  });
});
