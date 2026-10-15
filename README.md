# Phantom Exchange UI

A trading screen for a crypto exchange. Pick a pair, watch the order book and recent trades update live, read a candlestick chart, and place or cancel orders.

> Demo project. It ships with a demo market server so it runs on its own. Prices are simulated and no real funds are involved.

## What you can do

- **Order book:** 12 levels per side with cumulative totals, depth bars, and the current spread.
- **Recent trades:** newest first, with the side shown by an arrow icon and by color.
- **Chart:** candlesticks in 1, 5 and 15 minute timeframes, updated by live trades.
- **Place orders:** limit and market, buy and sell, with inline validation, balance checks, and 25/50/75/100% fill buttons.
- **Manage orders:** open orders with a confirm step before cancelling, plus order history.
- **Balances:** available and locked funds per asset.
- **Connection state:** live, reconnecting, and offline are shown in the header, and the client reconnects on its own.
- **Phones:** a bottom tab bar (Chart, Book, Trade, Orders) replaces the grid below 1024px.

## Run it

```bash
npm install
npm run dev:all     # web app on :3000 and the demo server on :4000
```

Or in two terminals: `npm run dev` and `npm run mock`.

```bash
npm run typecheck
npm test
npm run build
```

## Data sources

Set `NEXT_PUBLIC_DATA_SOURCE` in `.env.local` (see `.env.example`).

| Value | What it uses |
|---|---|
| `mock` (default) | The demo server in `server/mock-server.mjs`. Simulates two markets, a book, trades, history candles, and one demo account with balances. |
| `engine` | The phantom-matcher HTTP and WebSocket API. |

All screens read from one `Feed` interface (`lib/feed/types.ts`), so another backend means one new adapter.

### Engine contract

`lib/feed/engine.ts` expects:

```
GET    /book/{pair}?depth=20   { bids: [...], asks: [...] }     levels as [price, qty] or { price, quantity }
POST   /orders                 { pair, side, type, price, quantity }  ->  { id }
DELETE /orders/{id}
WS     /trades                 one JSON trade per message: { id?, price, quantity, side?, timestamp }
```

The engine has no balances, so the Balances panel says so and balance checks in the order form are skipped. Pointing the UI at the ledger service is the next step. If your field names differ, change `normalizeBook` and `normalizeTrade`; they are covered by tests.

## Structure

```
app/            page and layout
components/     Header, Chart, OrderBook, TradesFeed, OrderForm, OrdersPanel, BalancesPanel, MobileNav, Toasts
hooks/          useMarket: one hook that owns connection state and market data
lib/            types, formatting, candle math, order validation, feed adapters
server/         demo market server
tests/          candle math, order validation, engine normalizers
```

## Design notes

- Flat black surfaces, 1px borders, one amber accent used for the main action and active states.
- Buy and sell never rely on color alone: they carry a label or an arrow icon.
- Every control is at least 44px tall, has a visible focus ring, and works from the keyboard.
- Motion is limited to short color transitions and respects reduced motion.
- Geist for text and JetBrains Mono for numbers, both self-hosted.

## Limits

- Prices and amounts are plain numbers in the browser for display. Money math belongs in the backend (the ledger uses integer minor units).
- The demo server is a single shared account and a single process. It is not a matching engine.
- Trade history for the chart starts from the snapshot, so with the `engine` source the chart fills in from the moment you connect.
