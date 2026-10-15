import type { Book, Level, Order, Side, Ticker, Trade } from '../types';
import type { ActionResult, Feed, FeedHandlers, PlaceOrderRequest } from './types';

/**
 * Adapter for the phantom-matcher HTTP + WebSocket API.
 *
 * Assumed contract (adjust the normalizers below if the engine differs):
 *   GET    /book/{pair}?depth=N  ->  { bids: [...], asks: [...] }   levels as [price, qty] or { price, quantity }
 *   POST   /orders               ->  { id, ... }                    body: { pair, side, type, price, quantity }
 *   DELETE /orders/{id}
 *   WS     /trades               ->  one JSON trade per message     { id?, price, quantity, side?, timestamp }
 *
 * The engine has no balances or order history, so open orders are tracked locally and balances are null.
 */

const POLL_MS = 1000;
const BOOK_DEPTH = 20;

type Raw = Record<string, unknown>;
const num = (v: unknown): number => Number(v);

function toLevel(x: unknown): Level {
  if (Array.isArray(x)) return { price: num(x[0]), amount: num(x[1]) };
  const o = x as Raw;
  return { price: num(o.price), amount: num(o.quantity ?? o.qty ?? o.amount ?? o.size) };
}

export function normalizeBook(raw: Raw): Book {
  const bids = (Array.isArray(raw.bids) ? raw.bids : []).map(toLevel).filter((l) => l.price > 0 && l.amount > 0);
  const asks = (Array.isArray(raw.asks) ? raw.asks : []).map(toLevel).filter((l) => l.price > 0 && l.amount > 0);
  bids.sort((a, b) => b.price - a.price);
  asks.sort((a, b) => a.price - b.price);
  return { bids, asks };
}

export function normalizeTrade(raw: Raw): Trade | null {
  const price = num(raw.price);
  const amount = num(raw.quantity ?? raw.qty ?? raw.amount ?? raw.size);
  if (!(price > 0) || !(amount > 0)) return null;
  let time = Date.now();
  const ts = raw.timestamp ?? raw.time;
  if (typeof ts === 'string') time = Date.parse(ts) || time;
  else if (typeof ts === 'number') time = ts < 1e12 ? ts * 1000 : ts;
  const side: Side = raw.side === 'sell' || raw.taker_side === 'sell' ? 'sell' : 'buy';
  return { id: String(raw.id ?? `${time}-${price}-${amount}`), price, amount, side, time };
}

export function createEngineFeed(httpUrl: string, wsUrl: string): Feed {
  let stopped = false;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let ws: WebSocket | null = null;
  let handlers: FeedHandlers | null = null;
  let currentPair = '';
  let orders: Order[] = [];
  let seq = 0;
  const stats = { first: 0, last: 0, high: 0, low: 0, volume: 0 };

  function tickerFrom(trade: Trade): Ticker {
    if (!stats.first) Object.assign(stats, { first: trade.price, high: trade.price, low: trade.price });
    stats.last = trade.price;
    stats.high = Math.max(stats.high, trade.price);
    stats.low = Math.min(stats.low, trade.price);
    stats.volume += trade.amount;
    return {
      last: stats.last,
      change24h: stats.first ? ((stats.last - stats.first) / stats.first) * 100 : 0,
      high24h: stats.high,
      low24h: stats.low,
      volume24h: stats.volume,
    };
  }

  async function poll(first: boolean) {
    if (stopped || !handlers) return;
    try {
      const res = await fetch(`${httpUrl}/book/${encodeURIComponent(currentPair)}?depth=${BOOK_DEPTH}`);
      if (!res.ok) throw new Error(`book ${res.status}`);
      const book = normalizeBook((await res.json()) as Raw);
      handlers.status('live');
      if (first) {
        handlers.snapshot({ pair: currentPair, book, trades: [], candles: [], orders, balances: null, ticker: null });
      } else {
        handlers.book(book);
      }
      pollTimer = setTimeout(() => poll(false), POLL_MS);
    } catch {
      handlers.status(first ? 'offline' : 'reconnecting');
      pollTimer = setTimeout(() => poll(first), Math.min(POLL_MS * 4, 5000));
    }
  }

  function openSocket(attempt = 0) {
    if (stopped) return;
    ws = new WebSocket(`${wsUrl}/trades`);
    ws.onopen = () => (attempt = 0);
    ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse(String(ev.data)) as Raw;
        if (raw.pair && raw.pair !== currentPair) return;
        const trade = normalizeTrade(raw);
        if (!trade || !handlers) return;
        handlers.trade(trade);
        handlers.ticker(tickerFrom(trade));
      } catch {
        /* ignore malformed message */
      }
    };
    ws.onclose = () => {
      if (stopped) return;
      retryTimer = setTimeout(() => openSocket(attempt + 1), Math.min(1000 * 2 ** attempt, 10_000));
    };
    ws.onerror = () => ws?.close();
  }

  return {
    connect(pair, h) {
      stopped = false;
      handlers = h;
      currentPair = pair;
      h.status('connecting');
      poll(true);
      openSocket();
    },
    disconnect() {
      stopped = true;
      clearTimeout(pollTimer);
      clearTimeout(retryTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      ws = null;
      handlers = null;
    },
    async placeOrder(r: PlaceOrderRequest): Promise<ActionResult> {
      try {
        const res = await fetch(`${httpUrl}/orders`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            pair: r.pair,
            side: r.side,
            type: r.type,
            price: r.price !== undefined ? String(r.price) : undefined,
            quantity: String(r.amount),
          }),
        });
        const body = (await res.json().catch(() => ({}))) as Raw;
        if (!res.ok) return { ok: false, error: String(body.error ?? body.message ?? `The engine rejected the order (${res.status}).`) };
        const order: Order = {
          id: String(body.id ?? `local-${++seq}`),
          pair: r.pair,
          side: r.side,
          type: r.type,
          price: r.price ?? null,
          amount: r.amount,
          filled: r.type === 'market' ? r.amount : 0,
          status: r.type === 'market' ? 'filled' : 'open',
          createdAt: Date.now(),
        };
        orders = [order, ...orders];
        handlers?.orders(orders);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Could not reach the matching engine. Check that it is running.' };
      }
    },
    async cancelOrder(id: string): Promise<ActionResult> {
      try {
        const res = await fetch(`${httpUrl}/orders/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) return { ok: false, error: `The engine could not cancel the order (${res.status}).` };
        orders = orders.map((o) => (o.id === id ? { ...o, status: 'cancelled' as const } : o));
        handlers?.orders(orders);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Could not reach the matching engine. Check that it is running.' };
      }
    },
  };
}
