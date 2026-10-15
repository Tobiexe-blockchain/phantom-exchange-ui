'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { fmt, toInputValue } from '../lib/format';
import { validateOrder } from '../lib/orderValidation';
import type { ActionResult, PlaceOrderRequest } from '../lib/feed/types';
import type { Balances, Book, OrderType, PairInfo, Side } from '../lib/types';

interface OrderFormProps {
  pair: PairInfo;
  book: Book;
  last: number | null;
  balances: Balances | null;
  onSubmit(request: PlaceOrderRequest): Promise<ActionResult>;
  onPlaced(message: string): void;
}

function Segment<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; text: string }[]; onChange(v: T): void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-11 rounded-sm border text-sm font-medium transition-colors duration-150',
            value === o.value ? 'border-fg bg-raised text-fg' : 'border-line text-muted hover:text-fg',
          )}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

function Field({ id, label, unit, value, error, onChange, onBlur, disabled }: { id: string; label: string; unit: string; value: string; error?: string; onChange(v: string): void; onBlur(): void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <div className={cn('flex min-h-11 items-center rounded-sm border bg-bg px-3', error ? 'border-down' : 'border-line', disabled && 'opacity-50')}>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="num min-w-0 flex-1 bg-transparent text-base outline-offset-8"
        />
        <span className="num text-sm text-muted">{unit}</span>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-down">
          {error}
        </p>
      )}
    </div>
  );
}

export function OrderForm({ pair, book, last, balances, onSubmit, onPlaced }: OrderFormProps) {
  const uid = useId();
  const [side, setSide] = useState<Side>('buy');
  const [type, setType] = useState<OrderType>('limit');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [touched, setTouched] = useState({ price: false, amount: false });
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const summary = useRef<HTMLDivElement>(null);

  const bestBid = book.bids[0]?.price;
  const bestAsk = book.asks[0]?.price;

  // Start the price field at the market price, and again when the pair changes.
  useEffect(() => {
    setPrice('');
    setAmount('');
    setTouched({ price: false, amount: false });
    setServerError(null);
  }, [pair.id]);
  useEffect(() => {
    if (!price && last) setPrice(toInputValue(last, pair.pricePrecision));
  }, [price, last, pair.pricePrecision]);

  const v = validateOrder({ side, type, price, amount }, { base: pair.base, quote: pair.quote, balances, bestBid, bestAsk });
  const shown = { price: touched.price ? v.errors.price : undefined, amount: touched.amount ? v.errors.amount : undefined };
  const errorList = [shown.price, shown.amount, serverError].filter(Boolean) as string[];

  const refPrice = type === 'limit' ? v.price : side === 'buy' ? bestAsk : bestBid;
  const available = balances ? (side === 'buy' ? balances[pair.quote]?.available : balances[pair.base]?.available) ?? 0 : null;

  function fillPercent(pct: number) {
    if (available === null) return;
    const base = side === 'sell' ? available : refPrice && refPrice > 0 ? available / refPrice : 0;
    setAmount(toInputValue((base * pct) / 100, pair.amountPrecision));
    setTouched((t) => ({ ...t, amount: true }));
    setServerError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ price: true, amount: true });
    setServerError(null);
    if (v.errors.price || v.errors.amount || v.amount === null) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setSubmitting(true);
    const res = await onSubmit({ pair: pair.id, side, type, price: type === 'limit' ? v.price ?? undefined : undefined, amount: v.amount });
    setSubmitting(false);
    if (res.ok) {
      onPlaced(`${side === 'buy' ? 'Buy' : 'Sell'} order placed for ${amount} ${pair.base}.`);
      setAmount('');
      setTouched({ price: false, amount: false });
    } else {
      setServerError(res.error);
      requestAnimationFrame(() => summary.current?.focus());
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 p-3">
      <Segment<Side>
        label="Side"
        value={side}
        onChange={(s) => {
          setSide(s);
          setServerError(null);
        }}
        options={[
          { value: 'buy', text: 'Buy' },
          { value: 'sell', text: 'Sell' },
        ]}
      />
      <Segment<OrderType>
        label="Order type"
        value={type}
        onChange={(t) => {
          setType(t);
          setServerError(null);
        }}
        options={[
          { value: 'limit', text: 'Limit' },
          { value: 'market', text: 'Market' },
        ]}
      />

      <Field
        id={`${uid}-price`}
        label="Price"
        unit={pair.quote}
        value={type === 'market' ? 'Market price' : price}
        disabled={type === 'market'}
        error={shown.price}
        onChange={setPrice}
        onBlur={() => setTouched((t) => ({ ...t, price: true }))}
      />
      <Field
        id={`${uid}-amount`}
        label="Amount"
        unit={pair.base}
        value={amount}
        error={shown.amount}
        onChange={(val) => {
          setAmount(val);
          setServerError(null);
        }}
        onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
      />

      <div role="group" aria-label="Fill amount from balance" className="grid grid-cols-4 gap-2">
        {[25, 50, 75, 100].map((pct) => (
          <button
            key={pct}
            type="button"
            disabled={available === null}
            onClick={() => fillPercent(pct)}
            className="num min-h-11 rounded-sm border border-line text-sm text-muted transition-colors duration-150 hover:text-fg"
          >
            {pct}%
          </button>
        ))}
      </div>

      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">{type === 'market' ? 'Estimated total' : 'Total'}</dt>
          <dd className="num">{v.total !== null ? `${fmt(v.total, 2)} ${pair.quote}` : `... ${pair.quote}`}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Available</dt>
          <dd className="num">{available !== null ? `${fmt(available, side === 'buy' ? 2 : pair.amountPrecision)} ${side === 'buy' ? pair.quote : pair.base}` : 'Not connected to balances'}</dd>
        </div>
      </dl>

      <div ref={summary} tabIndex={-1} role="alert" aria-live="assertive" className={cn('rounded-sm border border-down p-3 text-sm outline-offset-2', errorList.length === 0 && 'hidden')}>
        <p className="font-medium text-down">Fix this to place the order:</p>
        <ul className="mt-1 list-disc pl-4">
          {errorList.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 rounded-md bg-accent px-4 text-base font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover active:bg-accent-pressed"
      >
        {submitting ? 'Placing order' : `${side === 'buy' ? 'Buy' : 'Sell'} ${pair.base}`}
      </button>
    </form>
  );
}
