import { fmt } from './format';
import type { Balances, OrderType, Side } from './types';

export interface FormInput {
  side: Side;
  type: OrderType;
  price: string;
  amount: string;
}
export interface FormContext {
  base: string;
  quote: string;
  balances: Balances | null;
  bestBid?: number;
  bestAsk?: number;
}
export interface FormResult {
  errors: { price?: string; amount?: string };
  price: number | null;
  amount: number | null;
  total: number | null;
}

function parseDecimal(text: string): number | null {
  const s = text.trim();
  if (!s || s === '.' || !/^\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function validateOrder(input: FormInput, ctx: FormContext): FormResult {
  const errors: FormResult['errors'] = {};
  const amount = parseDecimal(input.amount);
  const limitPrice = input.type === 'limit' ? parseDecimal(input.price) : null;

  if (amount === null || amount <= 0) errors.amount = 'Enter an amount greater than 0.';
  if (input.type === 'limit' && (limitPrice === null || limitPrice <= 0)) errors.price = 'Enter a price greater than 0.';

  const refPrice = input.type === 'limit' ? limitPrice : input.side === 'buy' ? ctx.bestAsk ?? null : ctx.bestBid ?? null;
  const total = amount !== null && refPrice !== null && refPrice > 0 ? amount * refPrice : null;

  if (!errors.amount && !errors.price && amount !== null && ctx.balances) {
    if (input.side === 'buy') {
      const have = ctx.balances[ctx.quote]?.available ?? 0;
      if (total !== null && total > have + 1e-9) {
        errors.amount = `Not enough ${ctx.quote}. You have ${fmt(have, 2)} available. Lower the amount.`;
      }
    } else {
      const have = ctx.balances[ctx.base]?.available ?? 0;
      if (amount > have + 1e-9) {
        errors.amount = `Not enough ${ctx.base}. You have ${fmt(have, 5)} available. Lower the amount.`;
      }
    }
  }
  return { errors, price: limitPrice, amount, total };
}
