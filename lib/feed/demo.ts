import type { Balances, Book, Candle, Level, Order, Ticker, Trade } from '../types';
import type { ActionResult, Feed, FeedHandlers, PlaceOrderRequest, Snapshot } from './types';

interface MarketDef {
  base: string;
  quote: string;
  start: number;
  tick: number;
  vol: number;
  size: [number, number];
}

const DEFS: Record<string, MarketDef> = {
  'BTC-USDT': { base: 'BTC', quote: 'USDT', start: 67000, tick: 0.5, vol: 0.0006, size: [0.01, 1.2] },
  'ETH-USDT': { base: 'ETH', quote: 'USDT', start: 3400, tick: 0.05, vol: 0.0008, size: [0.1, 12] },
};

const DEPTH = 20;
const TICK_MS = 600;
const r8 = (n: number) => Math.round(n * 1e8) / 1e8;
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

interface Market extends MarketDef {
  id: string;
  mid: number;
  trades: Trade[];
  candles: Candle[];
  seq: number;
  sessionVolume: number;
  sizes: { bid: number[]; ask: number[] };
}

interface Subscriber {
  pair: string;
  h: FeedHandlers;
}

/**
 * A small simulated exchange that runs entirely in the browser: random-walk prices, a book, trades, and one
 * demo account with balances and orders. It exists so the screen works with no server, for example on a
 * static host. It is not a matching engine and its prices are made up.
 */
export class DemoExchange {
  private markets = new Map<string, Market>();
  private balances: Balances = { USDT: { available: 25000, locked: 0 }, BTC: { available: 0.5, locked: 0 }, ETH: { available: 5, locked: 0 } };
  private orders: Order[] = [];
  private orderSeq = 0;
  private subs = new Set<Subscriber>();
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly rand: () => number = Math.random,
    private readonly now: () => number = Date.now,
  ) {
    for (const [id, def] of Object.entries(DEFS)) this.markets.set(id, this.seed(id, def));
  }

  private between = (a: number, b: number) => a + this.rand() * (b - a);

  private seed(id: string, def: MarketDef): Market {
    const sizes = {
      bid: Array.from({ length: DEPTH }, () => this.between(...def.size)),
      ask: Array.from({ length: DEPTH }, () => this.between(...def.size)),
    };
    // Four hours of 1 minute candles that end at the starting price.
    const start = Math.floor(this.now() / 60000) * 60;
    let p = def.start;
    const closes: number[] = [];
    for (let i = 0; i < 240; i++) {
      p *= 1 + (this.rand() - 0.5) * 0.002;
      closes.push(p);
    }
    const shift = def.start / closes[closes.length - 1];
    const candles: Candle[] = [];
    let prev = closes[0] * shift;
    closes.forEach((c, i) => {
      const close = roundTo(c * shift, def.tick);
      const open = roundTo(prev, def.tick);
      candles.push({
        time: start - (239 - i) * 60,
        open,
        close,
        high: roundTo(Math.max(open, close) * (1 + this.rand() * 0.0008), def.tick),
        low: roundTo(Math.min(open, close) * (1 - this.rand() * 0.0008), def.tick),
      });
      prev = close;
    });
    return { ...def, id, mid: candles[candles.length - 1].close, trades: [], candles, seq: 0, sessionVolume: this.between(1800, 2600), sizes };
  }

  // ---------- reading ----------

  private buildBook(m: Market): Book {
    const bids: Level[] = [];
    const asks: Level[] = [];
    for (let i = 0; i < DEPTH; i++) {
      const away = 2 * m.tick * (i + 1);
      bids.push({ price: r8(roundTo(m.mid - away, m.tick)), amount: r8(m.sizes.bid[i] * this.between(0.85, 1.15)) });
      asks.push({ price: r8(roundTo(m.mid + away, m.tick)), amount: r8(m.sizes.ask[i] * this.between(0.85, 1.15)) });
    }
    return { bids, asks };
  }

  private ticker(m: Market): Ticker {
    const first = m.candles[0].open;
    return {
      last: m.mid,
      change24h: ((m.mid - first) / first) * 100,
      high24h: Math.max(...m.candles.map((c) => c.high)),
      low24h: Math.min(...m.candles.map((c) => c.low)),
      volume24h: r8(m.sessionVolume),
    };
  }

  private cloneBalances(): Balances {
    return Object.fromEntries(Object.entries(this.balances).map(([k, v]) => [k, { ...v }]));
  }

  snapshot(pair: string): Snapshot | null {
    const m = this.markets.get(pair);
    if (!m) return null;
    return {
      pair,
      book: this.buildBook(m),
      trades: [...m.trades],
      candles: m.candles.map((c) => ({ ...c })),
      orders: this.orders.map((o) => ({ ...o })),
      balances: this.cloneBalances(),
      ticker: this.ticker(m),
    };
  }

  // ---------- events ----------

  subscribe(pair: string, h: FeedHandlers): () => void {
    const sub: Subscriber = { pair, h };
    this.subs.add(sub);
    h.status('live');
    const snap = this.snapshot(pair);
    if (snap) h.snapshot(snap);
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
    return () => {
      this.subs.delete(sub);
      if (this.subs.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = undefined;
      }
    };
  }

  private emitAccount(): void {
    for (const s of this.subs) {
      s.h.orders(this.orders.map((o) => ({ ...o })));
      s.h.balances(this.cloneBalances());
    }
  }

  private recordTrade(m: Market, side: Trade['side'], price: number, amount: number): void {
    const trade: Trade = { id: `${m.id}-${++m.seq}`, price, amount: r8(amount), side, time: this.now() };
    m.trades.unshift(trade);
    m.trades.length = Math.min(m.trades.length, 50);
    m.sessionVolume += amount;
    const start = Math.floor(trade.time / 60000) * 60;
    const last = m.candles[m.candles.length - 1];
    if (last.time === start) {
      last.high = Math.max(last.high, price);
      last.low = Math.min(last.low, price);
      last.close = price;
    } else {
      m.candles.push({ time: start, open: last.close, high: price, low: price, close: price });
      if (m.candles.length > 500) m.candles.shift();
    }
    for (const s of this.subs) if (s.pair === m.id) s.h.trade(trade);
  }

  /** Moves the market one step. Public so tests can drive time. */
  tick(): void {
    for (const m of this.markets.values()) {
      m.mid = Math.max(m.tick, roundTo(m.mid * (1 + (this.rand() - 0.5) * 2 * m.vol), m.tick));
      const book = this.buildBook(m);
      const n = this.rand() < 0.7 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const side = this.rand() < 0.5 ? 'buy' : 'sell';
        this.recordTrade(m, side, side === 'buy' ? book.asks[0].price : book.bids[0].price, this.between(m.size[0], m.size[1] / 3));
      }
      for (const s of this.subs) {
        if (s.pair !== m.id) continue;
        s.h.book(book);
        s.h.ticker(this.ticker(m));
      }
      this.matchResting(m);
    }
  }

  // ---------- trading ----------

  private fill(order: Order, m: Market, price: number, qty: number): void {
    const q = r8(qty);
    const base = this.balances[m.base];
    const quote = this.balances[m.quote];
    if (order.type === 'limit') {
      if (order.side === 'buy') {
        quote.locked = r8(quote.locked - order.price! * q);
        quote.available = r8(quote.available + (order.price! - price) * q); // price improvement goes back
        base.available = r8(base.available + q);
      } else {
        base.locked = r8(base.locked - q);
        quote.available = r8(quote.available + price * q);
      }
    } else if (order.side === 'buy') {
      quote.available = r8(quote.available - price * q);
      base.available = r8(base.available + q);
    } else {
      base.available = r8(base.available - q);
      quote.available = r8(quote.available + price * q);
    }
    order.filled = r8(order.filled + q);
    if (order.filled >= order.amount - 1e-9) order.status = 'filled';
  }

  private matchResting(m: Market): void {
    const book = this.buildBook(m);
    let changed = false;
    for (const o of this.orders) {
      if (o.status !== 'open' || o.pair !== m.id) continue;
      const qty = o.amount - o.filled;
      if (o.side === 'buy' && o.price! >= book.asks[0].price) {
        this.fill(o, m, book.asks[0].price, qty);
        this.recordTrade(m, 'buy', book.asks[0].price, qty);
        changed = true;
      } else if (o.side === 'sell' && o.price! <= book.bids[0].price) {
        this.fill(o, m, book.bids[0].price, qty);
        this.recordTrade(m, 'sell', book.bids[0].price, qty);
        changed = true;
      }
    }
    if (changed) this.emitAccount();
  }

  placeOrder(req: PlaceOrderRequest): ActionResult {
    const m = this.markets.get(req.pair);
    if (!m) return { ok: false, error: 'Unknown trading pair.' };
    if (req.side !== 'buy' && req.side !== 'sell') return { ok: false, error: 'Choose buy or sell.' };
    if (req.type !== 'limit' && req.type !== 'market') return { ok: false, error: 'Choose limit or market.' };
    // Round once, up front, so what is held, filled, and released all use the same number.
    const amount = r8(Number(req.amount));
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter an amount greater than 0.' };
    const base = this.balances[m.base];
    const quote = this.balances[m.quote];
    const book = this.buildBook(m);

    const order: Order = { id: `O-${++this.orderSeq}`, pair: m.id, side: req.side, type: req.type, price: null, amount, filled: 0, status: 'open', createdAt: this.now() };
    const short = (symbol: string, have: number) => ({ ok: false as const, error: `Not enough ${symbol}. You have ${symbol === m.quote ? have.toFixed(2) : have} available.` });

    if (req.type === 'limit') {
      const price = Number(req.price);
      if (!Number.isFinite(price) || price <= 0) return { ok: false, error: 'Enter a price greater than 0.' };
      order.price = price;
      if (req.side === 'buy') {
        const cost = r8(price * amount);
        if (cost > quote.available + 1e-9) return short(m.quote, quote.available);
        quote.available = r8(quote.available - cost);
        quote.locked = r8(quote.locked + cost);
      } else {
        if (amount > base.available + 1e-9) return short(m.base, base.available);
        base.available = r8(base.available - amount);
        base.locked = r8(base.locked + amount);
      }
      this.orders.unshift(order);
      this.matchResting(m);
    } else {
      const levels = req.side === 'buy' ? book.asks : book.bids;
      let remaining = amount;
      const fills: Array<[number, number]> = [];
      for (const l of levels) {
        if (remaining <= 1e-12) break;
        const take = Math.min(remaining, l.amount);
        fills.push([l.price, take]);
        remaining -= take;
      }
      if (remaining > 1e-9) return { ok: false, error: 'Not enough liquidity for this size. Lower the amount.' };
      const cost = fills.reduce((s, [p, q]) => s + p * q, 0);
      if (req.side === 'buy' && cost > quote.available + 1e-9) return short(m.quote, quote.available);
      if (req.side === 'sell' && amount > base.available + 1e-9) return short(m.base, base.available);
      this.orders.unshift(order);
      for (const [p, q] of fills) {
        this.fill(order, m, p, q);
        this.recordTrade(m, req.side, p, q);
      }
    }
    this.emitAccount();
    return { ok: true };
  }

  cancelOrder(id: string): ActionResult {
    const o = this.orders.find((x) => x.id === id);
    if (!o) return { ok: false, error: 'Order not found.' };
    if (o.status !== 'open') return { ok: false, error: `Order is already ${o.status}.` };
    const m = this.markets.get(o.pair)!;
    const remaining = r8(o.amount - o.filled);
    if (o.side === 'buy') {
      this.balances[m.quote].locked = r8(this.balances[m.quote].locked - o.price! * remaining);
      this.balances[m.quote].available = r8(this.balances[m.quote].available + o.price! * remaining);
    } else {
      this.balances[m.base].locked = r8(this.balances[m.base].locked - remaining);
      this.balances[m.base].available = r8(this.balances[m.base].available + remaining);
    }
    o.status = 'cancelled';
    this.emitAccount();
    return { ok: true };
  }
}

// One exchange per page, so switching pairs keeps the same account and orders.
let shared: DemoExchange | null = null;

export function createDemoFeed(): Feed {
  const exchange = (shared ??= new DemoExchange());
  let off: (() => void) | null = null;
  return {
    connect(pair, handlers) {
      handlers.status('connecting');
      off = exchange.subscribe(pair, handlers);
    },
    disconnect() {
      off?.();
      off = null;
    },
    placeOrder: async (r) => exchange.placeOrder(r),
    cancelOrder: async (id) => exchange.cancelOrder(id),
  };
}
