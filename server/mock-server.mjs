// Demo market data and a single demo account, served over Socket.io.
// Used when NEXT_PUBLIC_DATA_SOURCE=mock. Not a matching engine.
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const PORT = Number(process.env.MOCK_PORT ?? 4000);
const ORIGIN = process.env.MOCK_CORS_ORIGIN ?? 'http://localhost:3000';
const DEPTH = 20;

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.end('ok');
    return;
  }
  res.statusCode = 404;
  res.end();
});
const io = new Server(httpServer, { cors: { origin: ORIGIN } });

const rand = (a, b) => a + Math.random() * (b - a);
const r8 = (n) => Math.round(n * 1e8) / 1e8;
const roundTo = (n, step) => Math.round(n / step) * step;

const MARKETS = {
  'BTC-USDT': { base: 'BTC', quote: 'USDT', start: 67000, tick: 0.5, vol: 0.0006, size: [0.01, 1.2], dp: 2 },
  'ETH-USDT': { base: 'ETH', quote: 'USDT', start: 3400, tick: 0.05, vol: 0.0008, size: [0.1, 12], dp: 2 },
};

for (const [id, m] of Object.entries(MARKETS)) {
  m.id = id;
  m.mid = m.start;
  m.trades = [];
  m.candles = [];
  m.seq = 0;
  m.sessionVolume = rand(1800, 2600);
  m.levelSizes = {
    bid: Array.from({ length: DEPTH }, () => rand(...m.size)),
    ask: Array.from({ length: DEPTH }, () => rand(...m.size)),
  };
  // Seed 4 hours of 1 minute candles that end at the starting price.
  const nowMin = Math.floor(Date.now() / 60000) * 60;
  let price = m.start;
  const closes = [];
  for (let i = 0; i < 240; i++) {
    price = price * (1 + (Math.random() - 0.5) * 0.002);
    closes.push(price);
  }
  const shift = m.start / closes[closes.length - 1];
  let prev = closes[0] * shift;
  closes.forEach((c, i) => {
    const close = roundTo(c * shift, m.tick);
    const open = roundTo(prev, m.tick);
    const high = roundTo(Math.max(open, close) * (1 + Math.random() * 0.0008), m.tick);
    const low = roundTo(Math.min(open, close) * (1 - Math.random() * 0.0008), m.tick);
    m.candles.push({ time: nowMin - (239 - i) * 60, open, high, low, close });
    prev = close;
  });
  m.mid = m.candles[m.candles.length - 1].close;
}

// ---- demo account ----
const balances = {
  USDT: { available: 25000, locked: 0 },
  BTC: { available: 0.5, locked: 0 },
  ETH: { available: 5, locked: 0 },
};
let orders = [];
let orderSeq = 0;

function buildBook(m) {
  const halfSpread = m.tick * 2;
  const bids = [];
  const asks = [];
  for (let i = 0; i < DEPTH; i++) {
    const step = m.tick * (i + 1) * 2;
    bids.push({ price: r8(roundTo(m.mid - halfSpread - step + m.tick * 2, m.tick)), amount: r8(m.levelSizes.bid[i] * rand(0.85, 1.15)) });
    asks.push({ price: r8(roundTo(m.mid + halfSpread + step - m.tick * 2, m.tick)), amount: r8(m.levelSizes.ask[i] * rand(0.85, 1.15)) });
  }
  return { bids, asks };
}

function ticker(m) {
  const first = m.candles[0].open;
  return {
    last: m.mid,
    change24h: ((m.mid - first) / first) * 100,
    high24h: Math.max(...m.candles.map((c) => c.high)),
    low24h: Math.min(...m.candles.map((c) => c.low)),
    volume24h: r8(m.sessionVolume),
  };
}

function recordTrade(m, side, price, amount) {
  const trade = { id: `${m.id}-${++m.seq}`, price, amount: r8(amount), side, time: Date.now() };
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
  io.to(m.id).emit('trade', { pair: m.id, trade });
}

function emitAccount() {
  io.emit('orders', orders);
  io.emit('balances', balances);
}

function fillOrder(order, m, price, qty) {
  const q = r8(qty);
  const base = balances[m.base];
  const quote = balances[m.quote];
  if (order.type === 'limit') {
    if (order.side === 'buy') {
      quote.locked = r8(quote.locked - order.price * q);
      quote.available = r8(quote.available + (order.price - price) * q);
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

function matchRestingOrders(m) {
  const book = buildBook(m);
  let changed = false;
  for (const o of orders) {
    if (o.status !== 'open' || o.pair !== m.id) continue;
    if (o.side === 'buy' && o.price >= book.asks[0].price) {
      const qty = o.amount - o.filled;
      fillOrder(o, m, book.asks[0].price, qty);
      recordTrade(m, 'buy', book.asks[0].price, qty);
      changed = true;
    } else if (o.side === 'sell' && o.price <= book.bids[0].price) {
      const qty = o.amount - o.filled;
      fillOrder(o, m, book.bids[0].price, qty);
      recordTrade(m, 'sell', book.bids[0].price, qty);
      changed = true;
    }
  }
  if (changed) emitAccount();
}

function placeOrder(req) {
  const m = MARKETS[req?.pair];
  if (!m) return { ok: false, error: 'Unknown trading pair.' };
  if (req.side !== 'buy' && req.side !== 'sell') return { ok: false, error: 'Choose buy or sell.' };
  if (req.type !== 'limit' && req.type !== 'market') return { ok: false, error: 'Choose limit or market.' };
  const amount = Number(req.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter an amount greater than 0.' };
  const base = balances[m.base];
  const quote = balances[m.quote];
  const book = buildBook(m);

  const order = {
    id: `O-${++orderSeq}`,
    pair: m.id,
    side: req.side,
    type: req.type,
    price: null,
    amount: r8(amount),
    filled: 0,
    status: 'open',
    createdAt: Date.now(),
  };

  if (req.type === 'limit') {
    const price = Number(req.price);
    if (!Number.isFinite(price) || price <= 0) return { ok: false, error: 'Enter a price greater than 0.' };
    order.price = price;
    if (req.side === 'buy') {
      const cost = r8(price * amount);
      if (cost > quote.available + 1e-9) return { ok: false, error: `Not enough ${m.quote}. You have ${quote.available.toFixed(2)} available.` };
      quote.available = r8(quote.available - cost);
      quote.locked = r8(quote.locked + cost);
    } else {
      if (amount > base.available + 1e-9) return { ok: false, error: `Not enough ${m.base}. You have ${base.available} available.` };
      base.available = r8(base.available - amount);
      base.locked = r8(base.locked + amount);
    }
    orders.unshift(order);
    matchRestingOrders(m);
  } else {
    const levels = req.side === 'buy' ? book.asks : book.bids;
    let remaining = amount;
    const fills = [];
    for (const l of levels) {
      if (remaining <= 1e-12) break;
      const take = Math.min(remaining, l.amount);
      fills.push([l.price, take]);
      remaining -= take;
    }
    if (remaining > 1e-9) return { ok: false, error: 'Not enough liquidity for this size. Lower the amount.' };
    const cost = fills.reduce((s, [p, q]) => s + p * q, 0);
    if (req.side === 'buy' && cost > quote.available + 1e-9) return { ok: false, error: `Not enough ${m.quote}. You have ${quote.available.toFixed(2)} available.` };
    if (req.side === 'sell' && amount > base.available + 1e-9) return { ok: false, error: `Not enough ${m.base}. You have ${base.available} available.` };
    orders.unshift(order);
    for (const [p, q] of fills) {
      fillOrder(order, m, p, q);
      recordTrade(m, req.side, p, q);
    }
  }
  emitAccount();
  return { ok: true };
}

function cancelOrder(id) {
  const o = orders.find((x) => x.id === id);
  if (!o) return { ok: false, error: 'Order not found.' };
  if (o.status !== 'open') return { ok: false, error: `Order is already ${o.status}.` };
  const m = MARKETS[o.pair];
  const remaining = r8(o.amount - o.filled);
  if (o.side === 'buy') {
    balances[m.quote].locked = r8(balances[m.quote].locked - o.price * remaining);
    balances[m.quote].available = r8(balances[m.quote].available + o.price * remaining);
  } else {
    balances[m.base].locked = r8(balances[m.base].locked - remaining);
    balances[m.base].available = r8(balances[m.base].available + remaining);
  }
  o.status = 'cancelled';
  emitAccount();
  return { ok: true };
}

io.on('connection', (socket) => {
  socket.on('subscribe', (pair) => {
    const m = MARKETS[pair];
    if (!m) return;
    for (const room of socket.rooms) if (room !== socket.id) socket.leave(room);
    socket.join(pair);
    socket.emit('snapshot', {
      pair,
      book: buildBook(m),
      trades: m.trades,
      candles: m.candles,
      orders,
      balances,
      ticker: ticker(m),
    });
  });
  socket.on('order:place', (req, ack) => typeof ack === 'function' && ack(placeOrder(req)));
  socket.on('order:cancel', (id, ack) => typeof ack === 'function' && ack(cancelOrder(id)));
});

// Market tick: random walk, a few trades, fresh book, resting order matching.
setInterval(() => {
  for (const m of Object.values(MARKETS)) {
    m.mid = Math.max(m.tick, roundTo(m.mid * (1 + (Math.random() - 0.5) * 2 * m.vol), m.tick));
    const book = buildBook(m);
    const n = Math.random() < 0.7 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? 'buy' : 'sell';
      recordTrade(m, side, side === 'buy' ? book.asks[0].price : book.bids[0].price, rand(m.size[0], m.size[1] / 3));
    }
    io.to(m.id).emit('book', { pair: m.id, book });
    io.to(m.id).emit('ticker', { pair: m.id, ticker: ticker(m) });
    matchRestingOrders(m);
  }
}, 600);

httpServer.listen(PORT, () => console.log(`demo market server on :${PORT} (CORS ${ORIGIN})`));
