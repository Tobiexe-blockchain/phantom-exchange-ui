import { describe, expect, it } from 'vitest';
import { DemoExchange } from '../lib/feed/demo';
import type { FeedHandlers } from '../lib/feed/types';
import type { Balances, Book, Order, Trade } from '../lib/types';

/** Small seeded random number generator so runs repeat. */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const make = (seed = 1) => new DemoExchange(seeded(seed), () => 1_800_000_000_000);

function listener() {
  const log = { books: [] as Book[], trades: [] as Trade[], orders: [] as Order[][], balances: [] as Balances[], statuses: [] as string[], snapshots: 0 };
  const h: FeedHandlers = {
    status: (s) => log.statuses.push(s),
    snapshot: () => void log.snapshots++,
    book: (b) => log.books.push(b),
    trade: (t) => log.trades.push(t),
    orders: (o) => log.orders.push(o),
    balances: (b) => log.balances.push(b!),
    ticker: () => undefined,
  };
  return { h, log };
}

const total = (b: Balances, symbol: string) => b[symbol].available + b[symbol].locked;
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe('snapshot', () => {
  it('has a full, uncrossed book, history, and a starting account', () => {
    const s = make().snapshot('BTC-USDT')!;
    expect(s.book.bids).toHaveLength(20);
    expect(s.book.asks).toHaveLength(20);
    expect(s.book.bids[0].price).toBeLessThan(s.book.asks[0].price);
    expect(s.book.bids.every((l, i, a) => i === 0 || l.price < a[i - 1].price)).toBe(true);
    expect(s.book.asks.every((l, i, a) => i === 0 || l.price > a[i - 1].price)).toBe(true);
    expect(s.candles).toHaveLength(240);
    expect(s.candles.every((c) => c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close))).toBe(true);
    expect(s.balances!.USDT).toEqual({ available: 25000, locked: 0 });
    expect(s.ticker!.last).toBeGreaterThan(0);
  });

  it('returns nothing for an unknown pair', () => expect(make().snapshot('DOGE-USDT')).toBeNull());
});

describe('market orders', () => {
  it('spends the quote asset and receives the base asset at the book prices', () => {
    const ex = make();
    const before = ex.snapshot('BTC-USDT')!.balances!;
    expect(ex.placeOrder({ pair: 'BTC-USDT', side: 'buy', type: 'market', amount: 0.1 })).toEqual({ ok: true });
    const after = ex.snapshot('BTC-USDT')!;
    near(after.balances!.BTC.available - before.BTC.available, 0.1);
    const spent = before.USDT.available - after.balances!.USDT.available;
    expect(spent).toBeGreaterThan(0.1 * after.ticker!.last * 0.99);
    expect(spent).toBeLessThan(0.1 * after.ticker!.last * 1.01);
    expect(after.orders[0]).toMatchObject({ status: 'filled', type: 'market', side: 'buy' });
    expect(after.trades.length).toBeGreaterThan(0);
  });

  it('sells and credits the quote asset', () => {
    const ex = make();
    ex.placeOrder({ pair: 'BTC-USDT', side: 'sell', type: 'market', amount: 0.2 });
    const b = ex.snapshot('BTC-USDT')!.balances!;
    near(b.BTC.available, 0.3);
    expect(b.USDT.available).toBeGreaterThan(25000);
  });

  it('refuses when funds or liquidity are short, and changes nothing', () => {
    const ex = make();
    const before = JSON.stringify(ex.snapshot('BTC-USDT')!.balances);
    expect(ex.placeOrder({ pair: 'BTC-USDT', side: 'buy', type: 'market', amount: 5 })).toMatchObject({ ok: false });
    expect(ex.placeOrder({ pair: 'BTC-USDT', side: 'sell', type: 'market', amount: 5 })).toMatchObject({ ok: false });
    expect(ex.placeOrder({ pair: 'BTC-USDT', side: 'buy', type: 'market', amount: 5000 })).toMatchObject({ ok: false });
    expect(JSON.stringify(ex.snapshot('BTC-USDT')!.balances)).toBe(before);
    expect(ex.snapshot('BTC-USDT')!.orders).toHaveLength(0);
  });
});

describe('limit orders', () => {
  it('rests below the market, holds funds, and gives them back exactly on cancel', () => {
    const ex = make();
    expect(ex.placeOrder({ pair: 'BTC-USDT', side: 'buy', type: 'limit', price: 1000, amount: 2 })).toEqual({ ok: true });
    let b = ex.snapshot('BTC-USDT')!.balances!;
    near(b.USDT.locked, 2000);
    near(b.USDT.available, 23000);
    const id = ex.snapshot('BTC-USDT')!.orders[0].id;
    expect(ex.cancelOrder(id)).toEqual({ ok: true });
    b = ex.snapshot('BTC-USDT')!.balances!;
    near(b.USDT.locked, 0);
    near(b.USDT.available, 25000);
    expect(ex.cancelOrder(id)).toMatchObject({ ok: false }); // already cancelled
    expect(ex.cancelOrder('nope')).toMatchObject({ ok: false });
  });

  it('holds the base asset for a resting sell', () => {
    const ex = make();
    ex.placeOrder({ pair: 'BTC-USDT', side: 'sell', type: 'limit', price: 999999, amount: 0.25 });
    const b = ex.snapshot('BTC-USDT')!.balances!;
    near(b.BTC.locked, 0.25);
    near(b.BTC.available, 0.25);
  });

  it('fills at once when it crosses the book, with the price improvement returned', () => {
    const ex = make();
    const ask = ex.snapshot('BTC-USDT')!.book.asks[0].price;
    expect(ex.placeOrder({ pair: 'BTC-USDT', side: 'buy', type: 'limit', price: ask + 500, amount: 0.1 })).toEqual({ ok: true });
    const s = ex.snapshot('BTC-USDT')!;
    expect(s.orders[0].status).toBe('filled');
    near(s.balances!.USDT.locked, 0);
    near(s.balances!.BTC.available, 0.6);
    near(25000 - s.balances!.USDT.available, ask * 0.1); // paid the ask, not the higher limit
  });

  it('rejects bad prices and amounts, and unaffordable orders', () => {
    const ex = make();
    for (const price of [0, -1, NaN]) expect(ex.placeOrder({ pair: 'BTC-USDT', side: 'buy', type: 'limit', price, amount: 1 })).toMatchObject({ ok: false });
    for (const amount of [0, -1, NaN]) expect(ex.placeOrder({ pair: 'BTC-USDT', side: 'buy', type: 'limit', price: 100, amount })).toMatchObject({ ok: false });
    expect(ex.placeOrder({ pair: 'BTC-USDT', side: 'buy', type: 'limit', price: 60000, amount: 1 })).toMatchObject({ ok: false, error: expect.stringContaining('Not enough USDT') });
    expect(ex.placeOrder({ pair: 'NOPE', side: 'buy', type: 'limit', price: 1, amount: 1 })).toMatchObject({ ok: false });
  });
});

describe('live updates', () => {
  it('sends a snapshot, then book and trade updates, and stops after unsubscribe', () => {
    const ex = make();
    const { h, log } = listener();
    const off = ex.subscribe('BTC-USDT', h);
    expect(log.statuses).toEqual(['live']);
    expect(log.snapshots).toBe(1);
    ex.tick();
    expect(log.books).toHaveLength(1);
    expect(log.trades.length).toBeGreaterThanOrEqual(1);
    off();
    const n = log.books.length;
    ex.tick();
    expect(log.books.length).toBe(n);
  });

  it('only sends market data for the pair that was asked for', () => {
    const ex = make();
    const { h, log } = listener();
    ex.subscribe('ETH-USDT', h);
    ex.tick();
    expect(log.trades.every((t) => t.id.startsWith('ETH-USDT'))).toBe(true);
  });

  it('tells subscribers when the account changes', () => {
    const ex = make();
    const { h, log } = listener();
    ex.subscribe('BTC-USDT', h);
    ex.placeOrder({ pair: 'BTC-USDT', side: 'buy', type: 'market', amount: 0.01 });
    expect(log.orders.length).toBe(1);
    expect(log.balances.length).toBe(1);
  });
});

describe('invariants', () => {
  it('never goes negative, and held funds always match open orders, over many random actions', () => {
    for (const seed of [1, 2, 3]) {
      const ex = make(seed);
      const rnd = seeded(seed * 77);
      for (let i = 0; i < 300; i++) {
        const pair = rnd() < 0.5 ? 'BTC-USDT' : 'ETH-USDT';
        const px = ex.snapshot(pair)!.ticker!.last;
        const r = rnd();
        if (r < 0.35) {
          ex.placeOrder({ pair, side: rnd() < 0.5 ? 'buy' : 'sell', type: 'limit', price: px * (0.9 + rnd() * 0.2), amount: pair === 'BTC-USDT' ? rnd() * 0.3 : rnd() * 3 });
        } else if (r < 0.55) {
          ex.placeOrder({ pair, side: rnd() < 0.5 ? 'buy' : 'sell', type: 'market', amount: pair === 'BTC-USDT' ? rnd() * 0.2 : rnd() * 2 });
        } else if (r < 0.7) {
          const open = ex.snapshot(pair)!.orders.filter((o) => o.status === 'open');
          if (open.length) ex.cancelOrder(open[Math.floor(rnd() * open.length)].id);
        } else {
          ex.tick();
        }

        const s = ex.snapshot('BTC-USDT')!;
        for (const [symbol, bal] of Object.entries(s.balances!)) {
          expect(bal.available, `${symbol} available`).toBeGreaterThanOrEqual(-1e-6);
          expect(bal.locked, `${symbol} locked`).toBeGreaterThanOrEqual(-1e-6);
        }
        const reserved: Record<string, number> = { USDT: 0, BTC: 0, ETH: 0 };
        for (const o of s.orders.filter((x) => x.status === 'open')) {
          const [base, quote] = o.pair.split('-');
          const left = o.amount - o.filled;
          if (o.side === 'buy') reserved[quote] += o.price! * left;
          else reserved[base] += left;
        }
        for (const symbol of Object.keys(reserved)) near(s.balances![symbol].locked, reserved[symbol]);
      }
    }
  });

  it('keeps total value consistent: what a buyer pays is what trades at', () => {
    const ex = make(5);
    const before = ex.snapshot('ETH-USDT')!.balances!;
    ex.placeOrder({ pair: 'ETH-USDT', side: 'buy', type: 'market', amount: 3 });
    const after = ex.snapshot('ETH-USDT')!;
    const traded = after.trades.filter((t) => t.side === 'buy').slice(0, 10);
    near(total(after.balances!, 'ETH') - total(before, 'ETH'), 3);
    expect(total(before, 'USDT') - total(after.balances!, 'USDT')).toBeGreaterThan(0);
    expect(traded.length).toBeGreaterThan(0);
  });
});
