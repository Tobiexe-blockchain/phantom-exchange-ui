import { io, type Socket } from 'socket.io-client';
import type { Feed, FeedHandlers, PlaceOrderRequest, ActionResult } from './types';

const ACK_TIMEOUT_MS = 5000;

/** Talks to the demo server in server/mock-server.mjs. */
export function createSocketIoFeed(url: string): Feed {
  let socket: Socket | null = null;

  function request(event: string, payload: unknown): Promise<ActionResult> {
    return new Promise((resolve) => {
      if (!socket || !socket.connected) {
        resolve({ ok: false, error: 'Not connected. Wait for the connection and try again.' });
        return;
      }
      socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err: Error | null, res?: ActionResult) => {
        if (err || !res) resolve({ ok: false, error: 'The server did not answer. Check the order list before retrying.' });
        else resolve(res);
      });
    });
  }

  return {
    connect(pair: string, h: FeedHandlers) {
      let everConnected = false;
      h.status('connecting');
      const s = io(url, { transports: ['websocket'], reconnectionDelayMax: 5000 });
      socket = s;

      s.on('connect', () => {
        everConnected = true;
        h.status('live');
        s.emit('subscribe', pair);
      });
      s.on('disconnect', () => h.status('reconnecting'));
      s.on('connect_error', () => h.status(everConnected ? 'reconnecting' : 'offline'));
      s.io.on('reconnect_attempt', () => h.status(everConnected ? 'reconnecting' : 'offline'));

      s.on('snapshot', (p) => p.pair === pair && h.snapshot(p));
      s.on('book', (p) => p.pair === pair && h.book(p.book));
      s.on('trade', (p) => p.pair === pair && h.trade(p.trade));
      s.on('ticker', (p) => p.pair === pair && h.ticker(p.ticker));
      s.on('orders', (orders) => h.orders(orders));
      s.on('balances', (balances) => h.balances(balances));
    },
    disconnect() {
      socket?.removeAllListeners();
      socket?.disconnect();
      socket = null;
    },
    placeOrder: (r: PlaceOrderRequest) => request('order:place', r),
    cancelOrder: (id: string) => request('order:cancel', id),
  };
}
