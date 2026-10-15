'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { applyTrade } from '../lib/candles';
import { createFeed } from '../lib/feed';
import type { ActionResult, Feed, PlaceOrderRequest } from '../lib/feed/types';
import { EMPTY_BOOK } from '../lib/types';
import type { Balances, Book, Candle, ConnectionStatus, Order, Ticker, Trade } from '../lib/types';

const MAX_TRADES = 50;

export interface Market {
  status: ConnectionStatus;
  loaded: boolean;
  book: Book;
  trades: Trade[];
  candles: Candle[];
  orders: Order[];
  balances: Balances | null;
  ticker: Ticker | null;
  placeOrder(request: PlaceOrderRequest): Promise<ActionResult>;
  cancelOrder(orderId: string): Promise<ActionResult>;
}

export function useMarket(pair: string): Market {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [loaded, setLoaded] = useState(false);
  const [book, setBook] = useState<Book>(EMPTY_BOOK);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const feedRef = useRef<Feed | null>(null);

  useEffect(() => {
    setLoaded(false);
    setBook(EMPTY_BOOK);
    setTrades([]);
    setCandles([]);
    setTicker(null);

    const feed = createFeed();
    feedRef.current = feed;
    feed.connect(pair, {
      status: setStatus,
      snapshot: (s) => {
        setBook(s.book);
        setTrades(s.trades.slice(0, MAX_TRADES));
        setCandles(s.candles);
        setOrders(s.orders);
        setBalances(s.balances);
        setTicker(s.ticker);
        setLoaded(true);
      },
      book: setBook,
      trade: (t) => {
        setTrades((prev) => [t, ...prev].slice(0, MAX_TRADES));
        setCandles((prev) => applyTrade(prev, t));
      },
      orders: setOrders,
      balances: setBalances,
      ticker: setTicker,
    });
    return () => {
      feed.disconnect();
      feedRef.current = null;
    };
  }, [pair]);

  const placeOrder = useCallback(
    (request: PlaceOrderRequest) => feedRef.current?.placeOrder(request) ?? Promise.resolve<ActionResult>({ ok: false, error: 'Not connected.' }),
    [],
  );
  const cancelOrder = useCallback(
    (id: string) => feedRef.current?.cancelOrder(id) ?? Promise.resolve<ActionResult>({ ok: false, error: 'Not connected.' }),
    [],
  );

  return { status, loaded, book, trades, candles, orders, balances, ticker, placeOrder, cancelOrder };
}
