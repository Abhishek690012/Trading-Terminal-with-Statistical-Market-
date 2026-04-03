import { memo, useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';

/**
 * TradeHistory — scrollable list of the most recent market trades.
 */
const TradeRow = memo(
  ({
    price,
    quantity,
    time,
    isBuy,
    flash,
  }: {
    price: number;
    quantity: number;
    time: string;
    isBuy: boolean;
    flash: boolean;
  }) => {
    const priceColor = isBuy ? 'text-brand-green' : 'text-brand-red';
    const flashClass = flash ? (isBuy ? 'trade-flash-buy' : 'trade-flash-sell') : '';

    return (
      <div
        className={`flex justify-between items-center px-4 py-[4px] text-[12px] premium-transition hover:bg-white/[0.03] group ${flashClass}`}
      >
        <span className={`w-[40%] text-left font-mono font-bold ${priceColor}`} data-numeric="true">
          {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="w-[30%] text-right font-mono text-gray-300 font-bold group-hover:text-white transition-colors" data-numeric="true">
          {quantity.toFixed(4)}
        </span>
        <span className="w-[30%] text-right font-mono text-gray-600 font-bold text-[11px]" data-numeric="true">{time}</span>
      </div>
    );
  },
);

TradeRow.displayName = 'TradeRow';

const TradeHistory = memo(() => {
  const { recent, total, selectedSymbol } = useStore((s) => {
    const symData = s.symbols[s.selectedSymbol];
    const t = symData ? symData.trades : [];
    const recentTrades = t.length > 25 ? t.slice(-25) : [...t];
    
    // We reverse it locally for rendering newest first
    return { recent: [...recentTrades].reverse(), total: t.length, selectedSymbol: s.selectedSymbol };
  });

  const newestTrade = useMemo(() => {
    return recent[0] ?? null;
  }, [recent]);

  const newestKey = newestTrade
    ? `${newestTrade.timestamp}-${newestTrade.price}-${newestTrade.quantity}`
    : '';

  const [flashKey, setFlashKey] = useState('');

  useEffect(() => {
    if (!newestKey) return;
    setFlashKey(newestKey);
    const t = window.setTimeout(() => setFlashKey(''), 800);
    return () => window.clearTimeout(t);
  }, [newestKey]);

  return (
    <div className="flex flex-col w-full h-full bg-transparent overflow-hidden select-none">

      {/* Header */}
      <div className="flex justify-between items-center px-4 py-4 shrink-0 border-b border-white/5">
        <h3 className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-black">Trade History</h3>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-gray-600 font-bold bg-white/[0.03] px-2 py-0.5 rounded-full">
           <span className="w-1 h-1 rounded-full bg-brand-green" />
           {total} <span className="opacity-60">Live</span>
        </div>
      </div>

      {/* Col headers */}
      <div className="flex justify-between px-4 py-2 text-[9px] uppercase tracking-[0.1em] text-gray-600 font-black bg-white/[0.02]">
        <span className="w-[40%] text-left">Price (USD)</span>
        <span className="w-[30%] text-right">Size</span>
        <span className="w-[30%] text-right">Time</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin py-1">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
            <span className="text-gray-600 text-[10px] uppercase font-bold tracking-widest italic">
              Awaiting Market Data…
            </span>
          </div>
        ) : (
          recent.map((trade, i) => {
            const nextOlder = recent[i + 1]; // newest-first, so i+1 is older
            const side = trade.side ?? (!nextOlder ? 'buy' : trade.price >= nextOlder.price ? 'buy' : 'sell');
            const isBuy = side === 'buy';

            const time = new Date(trade.timestamp).toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            const tradeKey = `${trade.timestamp}-${trade.price}-${trade.quantity}`;
            const flash = tradeKey === flashKey;

            return (
              <TradeRow
                key={tradeKey}
                price={trade.price}
                quantity={trade.quantity}
                time={time}
                isBuy={isBuy}
                flash={flash}
              />
            );
          })
        )}
      </div>
    </div>
  );
});

TradeHistory.displayName = 'TradeHistory';
export default TradeHistory;
