import type { Balances, Book, Candle, ConnectionStatus, Order, OrderType, Side, Ticker, Trade } from '../types';

export interface Snapshot {
  pair: string;
  book: Book;
  trades: Trade[];
  /** 1 minute candles, oldest first. */
  candles: Candle[];
  orders: Order[];
  /** null when the data source has no balances. */
  balances: Balances | null;
  ticker: Ticker | null;
}

export interface FeedHandlers {
  status(status: ConnectionStatus): void;
  snapshot(snapshot: Snapshot): void;
  book(book: Book): void;
  trade(trade: Trade): void;
  orders(orders: Order[]): void;
  balances(balances: Balances | null): void;
  ticker(ticker: Ticker): void;
}

export interface PlaceOrderRequest {
  pair: string;
  side: Side;
  type: OrderType;
  price?: number;
  amount: number;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface Feed {
  connect(pair: string, handlers: FeedHandlers): void;
  disconnect(): void;
  placeOrder(request: PlaceOrderRequest): Promise<ActionResult>;
  cancelOrder(orderId: string): Promise<ActionResult>;
}
