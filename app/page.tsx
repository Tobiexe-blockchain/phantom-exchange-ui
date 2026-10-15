'use client';

import { useState } from 'react';
import { BalancesPanel } from '../components/BalancesPanel';
import { Chart, TimeframeSwitch, type Timeframe } from '../components/Chart';
import { Header } from '../components/Header';
import { MobileNav, type Tab } from '../components/MobileNav';
import { OrderBook } from '../components/OrderBook';
import { OrderForm } from '../components/OrderForm';
import { OrdersPanel } from '../components/OrdersPanel';
import { Panel } from '../components/Panel';
import { Toasts, useToasts } from '../components/Toasts';
import { TradesFeed } from '../components/TradesFeed';
import { useMarket } from '../hooks/useMarket';
import { PAIRS } from '../lib/types';

export default function Page() {
  const [pairId, setPairId] = useState(PAIRS[0].id);
  const [tab, setTab] = useState<Tab>('trade');
  const [timeframe, setTimeframe] = useState<Timeframe>(1);
  const { toasts, push, dismiss } = useToasts();
  const pair = PAIRS.find((p) => p.id === pairId) ?? PAIRS[0];
  const m = useMarket(pairId);

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <Header pair={pair} onPairChange={setPairId} ticker={m.ticker} status={m.status} />

      <main className="terminal">
        <Panel area="chart" title="Price chart" active={tab === 'chart'} className="h-80 lg:h-auto" actions={<TimeframeSwitch value={timeframe} onChange={setTimeframe} />}>
          <Chart candles={m.candles} pair={pair} timeframe={timeframe} />
        </Panel>

        <Panel area="book" title="Order book" active={tab === 'book'}>
          <OrderBook book={m.book} pair={pair} loaded={m.loaded} />
        </Panel>

        <Panel area="trades" title="Recent trades" active={tab === 'book'} className="max-h-96 lg:max-h-none">
          <TradesFeed trades={m.trades} pair={pair} loaded={m.loaded} />
        </Panel>

        <Panel area="form" title="Place order" active={tab === 'trade'} className="lg:overflow-y-auto">
          <OrderForm pair={pair} book={m.book} last={m.ticker?.last ?? null} balances={m.balances} onSubmit={m.placeOrder} onPlaced={push} />
        </Panel>

        <Panel area="balances" title="Balances" active={tab === 'trade'}>
          <BalancesPanel balances={m.balances} loaded={m.loaded} />
        </Panel>

        <Panel area="orders" title="Orders" active={tab === 'orders'}>
          <OrdersPanel orders={m.orders} onCancel={m.cancelOrder} />
        </Panel>
      </main>

      <MobileNav tab={tab} onChange={setTab} />
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
