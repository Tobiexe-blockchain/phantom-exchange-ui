import { describe, expect, it } from 'vitest';
import { validateOrder } from '../lib/orderValidation';

const ctx = {
  base: 'BTC',
  quote: 'USDT',
  balances: { USDT: { available: 1000, locked: 0 }, BTC: { available: 0.5, locked: 0 } },
  bestBid: 99,
  bestAsk: 101,
};

describe('validateOrder', () => {
  it('accepts a valid limit buy and computes the total', () => {
    const r = validateOrder({ side: 'buy', type: 'limit', price: '100', amount: '5' }, ctx);
    expect(r.errors).toEqual({});
    expect(r.total).toBe(500);
  });

  it.each(['', '0', '-1', '1e3', 'abc', '.', '1.2.3'])('rejects the amount "%s"', (amount) => {
    expect(validateOrder({ side: 'buy', type: 'limit', price: '100', amount }, ctx).errors.amount).toBeDefined();
  });

  it('requires a positive price for limit orders only', () => {
    expect(validateOrder({ side: 'buy', type: 'limit', price: '', amount: '1' }, ctx).errors.price).toBeDefined();
    expect(validateOrder({ side: 'buy', type: 'market', price: '', amount: '1' }, ctx).errors.price).toBeUndefined();
  });

  it('blocks a buy larger than the quote balance', () => {
    const r = validateOrder({ side: 'buy', type: 'limit', price: '100', amount: '11' }, ctx);
    expect(r.errors.amount).toMatch(/Not enough USDT/);
  });

  it('estimates a market buy with the best ask', () => {
    const r = validateOrder({ side: 'buy', type: 'market', price: '', amount: '2' }, ctx);
    expect(r.total).toBe(202);
    expect(r.errors).toEqual({});
  });

  it('blocks a sell larger than the base balance', () => {
    const r = validateOrder({ side: 'sell', type: 'market', price: '', amount: '0.6' }, ctx);
    expect(r.errors.amount).toMatch(/Not enough BTC/);
  });

  it('skips balance checks when balances are unavailable', () => {
    const r = validateOrder({ side: 'buy', type: 'limit', price: '100', amount: '999' }, { ...ctx, balances: null });
    expect(r.errors).toEqual({});
  });
});
