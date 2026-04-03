import Chart from '../components/Chart';
import OrderBook from '../components/OrderBook';
import TradePanel from '../components/TradePanel';
import TradeHistory from '../components/TradeHistory';
import ErrorBoundary from '../components/common/ErrorBoundary';

export default function TradePage() {
  return (
    <div className="h-full overflow-y-auto px-6 py-6 bg-bg-shell">
      <div className="flex flex-col gap-6 min-h-0 max-w-[1600px] mx-auto">
        
        {/* Top row: Chart (70%) | OrderBook (30%) */}
        <div className="flex flex-col lg:flex-row gap-6 min-h-0">
          <div className="flex-[70] lg:flex-[7] min-w-0">
            <div className="bg-bg-card rounded-2xl shadow-premium border border-white/5 p-4 h-[560px]">
              <ErrorBoundary title="Chart">
                <Chart />
              </ErrorBoundary>
            </div>
          </div>
          <div className="flex-[30] lg:flex-[3] min-w-0">
            <div className="bg-bg-card rounded-2xl shadow-premium border border-white/5 p-4 h-[560px]">
              <ErrorBoundary title="OrderBook">
                <OrderBook />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        {/* Bottom row: TradePanel (35%) | TradeHistory (65%) */}
        <div className="flex flex-col lg:flex-row gap-6 min-h-0">
          <div className="flex-[35] lg:flex-[4] min-w-0">
            <div className="bg-bg-card rounded-2xl shadow-premium border border-white/5 p-5 h-[480px]">
              <ErrorBoundary title="TradePanel">
                <TradePanel />
              </ErrorBoundary>
            </div>
          </div>
          <div className="flex-[65] lg:flex-[8] min-w-0">
            <div className="bg-bg-card rounded-2xl shadow-premium border border-white/5 p-4 h-[480px]">
              <ErrorBoundary title="TradeHistory">
                <TradeHistory />
              </ErrorBoundary>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
