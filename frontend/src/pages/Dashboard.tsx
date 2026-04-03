import React from 'react';
import Chart from '../components/Chart';
import OrderBook from '../components/OrderBook';
import TradePanel from '../components/TradePanel';
import TradeHistory from '../components/TradeHistory';
import Portfolio from '../components/Portfolio';

/**
 * Dashboard — main layout shell.
 *
 * ┌─────────────────────────────────────────────────────┐
 * │                     Header                          │
 * ├──────────────────────────────┬──────────────────────┤
 * │   Chart          (70%)       │  OrderBook   (30%)   │
 * ├──────────────┬───────────────┴──────────────────────┤
 * │ TradePanel   │              TradeHistory             │
 * │    (40%)     │                (60%)                  │
 * ├──────────────┴───────────────────────────────────────┤
 * │                   Portfolio                          │
 * └─────────────────────────────────────────────────────┘
 */
const Dashboard: React.FC = () => {
  return (
    <div className="w-full">
      {/* Grid layout: two rows + full-width portfolio */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Top row */}
        <section className="md:col-span-8">
          <div className="bg-[#111827] rounded-xl shadow-sm p-3 h-[380px] sm:h-[420px] md:h-[540px]">
            <Chart />
          </div>
        </section>

        <section className="md:col-span-4">
          <div className="bg-[#111827] rounded-xl shadow-sm p-3 h-[380px] sm:h-[420px] md:h-[540px]">
            <OrderBook />
          </div>
        </section>

        {/* Bottom row */}
        <section className="md:col-span-5">
          <div className="bg-[#111827] rounded-xl shadow-sm p-3 h-[360px] sm:h-[390px] md:h-[470px]">
            <TradePanel />
          </div>
        </section>

        <section className="md:col-span-7">
          <div className="bg-[#111827] rounded-xl shadow-sm p-3 h-[360px] sm:h-[390px] md:h-[470px]">
            <TradeHistory />
          </div>
        </section>

        {/* Portfolio: full width below */}
        <section className="md:col-span-12">
          <div className="bg-[#111827] rounded-xl shadow-sm p-3">
            <Portfolio />
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
