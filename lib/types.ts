export type Side = 'buy' | 'sell';
export type OrderType = 'limit' | 'market';
export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface PairInfo {
  id: string;
  base: string;
  quote: string;
  pricePrecision: number;
  amountPrecision: number;
}

export const PAIRS: PairInfo[] = [
  { id: 'BTC-USDT', base: 'BTC', quote: 'USDT', pricePrecision: 2, amountPrecision: 5 },
  { id: 'ETH-USDT', base: 'ETH', quote: 'USDT', pricePrecision: 2, amountPrecision: 4 },
];

export interface Level {
  price: number;
  amount: number;
}
export interface Book {
  /** Highest price first. */
  bids: Level[];
  /** Lowest price first. */
  asks: Level[];
}
export interface Trade {
  id: string;
  price: number;
  amount: number;
  side: Side;
  /** Unix time in milliseconds. */
  time: number;
}
export interface Candle {
  /** Unix time in seconds, start of the bucket. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
export interface Order {
  id: string;
  pair: string;
  side: Side;
  type: OrderType;
  price: number | null;
  amount: number;
  filled: number;
  status: 'open' | 'filled' | 'cancelled';
  createdAt: number;
}
export interface Balance {
  available: number;
  locked: number;
}
export type Balances = Record<string, Balance>;
export interface Ticker {
  last: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export const EMPTY_BOOK: Book = { bids: [], asks: [] };
