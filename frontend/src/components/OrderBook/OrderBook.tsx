import { useMemo, memo } from 'react';
import { useStore } from '../../store/useStore';

// Memoizing the individual rows prevents unnecessary React sub-tree renders
const OrderRow = memo(({ 
  type, 
  price, 
  quantity, 
  total, 
  maxTotal, 
  isBest 
}: { 
  type: 'bid' | 'ask'; 
  price: number; 
  quantity: number; 
  total: number; 
  maxTotal: number;
  isBest: boolean;
}) => {
  const depthPercent = maxTotal === 0 ? 0 : (total / maxTotal) * 100;
  
  const textColor = type === 'ask' ? 'text-brand-red' : 'text-brand-green';

  const bgColor =
    type === 'ask'
      ? 'bg-brand-red/10'
      : 'bg-brand-green/10';

  const bestStyle = isBest 
    ? type === 'ask' 
      ? 'bg-brand-red/15 ring-y ring-brand-red/30 z-10' 
      : 'bg-brand-green/15 ring-y ring-brand-green/30 z-10'
    : '';

  return (
    <div className={`relative flex justify-between px-4 py-[3px] text-[12px] premium-transition hover:bg-white/5 group overflow-hidden cursor-default ${bestStyle}`}>
      {/* Depth Map Background - Semi-transparent gradient for better look */}
      <div 
        className={`absolute top-0 right-0 h-full ${bgColor} transition-all duration-500 ease-out`}
        style={{ 
          width: `${depthPercent}%`,
          background: type === 'ask' 
            ? `linear-gradient(to left, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0))` 
            : `linear-gradient(to left, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0))`
        }}
      />
      
      <span className={`z-10 w-[40%] text-left font-mono ${textColor} ${isBest ? 'font-black' : 'font-bold'}`} data-numeric="true">
        {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className="z-10 w-[30%] text-right font-mono text-gray-300 font-medium group-hover:text-white transition-colors" data-numeric="true">
        {quantity.toFixed(4)}
      </span>
      <span className="z-10 w-[30%] text-right font-mono text-gray-500 font-medium" data-numeric="true">
        {total.toFixed(2)}
      </span>
    </div>
  );
});

export default function OrderBook() {
  const selectedSymbol = useStore((state) => state.selectedSymbol);
  const orderBook = useStore((state) => state.symbols[selectedSymbol]?.orderBook || { bids: [], asks: [] });

  const formattedAsks = useMemo(() => {
    if (!orderBook?.asks?.length) return [];
    const sorted = [...orderBook.asks].sort((a, b) => a.price - b.price).slice(0, 15);
    let cumulative = 0;
    const withTotal = sorted.map(ask => {
      cumulative += ask.quantity;
      return { ...ask, total: cumulative };
    });
    return withTotal.reverse();
  }, [orderBook.asks]);

  const formattedBids = useMemo(() => {
    if (!orderBook?.bids?.length) return [];
    const sorted = [...orderBook.bids].sort((a, b) => b.price - a.price).slice(0, 15);
    let cumulative = 0;
    return sorted.map(bid => {
      cumulative += bid.quantity;
      return { ...bid, total: cumulative };
    });
  }, [orderBook.bids]);

  const maxTotalVolume = useMemo(() => {
    const bidTotal = formattedBids.length > 0 ? formattedBids[formattedBids.length - 1].total : 0;
    const askTotal = formattedAsks.length > 0 ? formattedAsks[0].total : 0;
    return Math.max(bidTotal, askTotal);
  }, [formattedBids, formattedAsks]);

  const spread = useMemo(() => {
    if (formattedAsks.length > 0 && formattedBids.length > 0) {
      const bestAsk = formattedAsks[formattedAsks.length - 1].price;
      const bestBid = formattedBids[0].price;
      return Math.max(0, bestAsk - bestBid);
    }
    return 0;
  }, [formattedAsks, formattedBids]);

  return (
    <div className="flex flex-col w-full h-full bg-transparent overflow-hidden select-none">
      {/* Header */}
      <div className="flex justify-between px-4 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold border-b border-white/5">
        <span className="w-[40%] text-left">Price (USD)</span>
        <span className="w-[30%] text-right">Size</span>
        <span className="w-[30%] text-right">Total</span>
      </div>
      
      {/* Asks */}
      <div className="flex flex-col flex-1 justify-end py-1 overflow-hidden">
        {formattedAsks.map((ask, idx) => (
          <OrderRow
            key={`ask-${ask.price}`}
            type="ask"
            price={ask.price}
            quantity={ask.quantity}
            total={ask.total}
            maxTotal={maxTotalVolume}
            isBest={idx === formattedAsks.length - 1} 
          />
        ))}
      </div>

      {/* Spread Divider */}
      <div className="flex justify-between items-center px-4 py-2 my-1 bg-white/[0.03] border-y border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 uppercase text-[9px] font-black tracking-widest">Spread</span>
          <span className="font-mono text-[11px] font-bold text-gray-400" data-numeric="true">
            {spread.toFixed(2)}
          </span>
        </div>
        <div className="text-[10px] font-bold text-gray-500">
          {( (spread / (formattedBids[0]?.price || 1)) * 100).toFixed(4)}%
        </div>
      </div>

      {/* Bids */}
      <div className="flex flex-col flex-1 justify-start py-1 overflow-hidden">
        {formattedBids.map((bid, idx) => (
          <OrderRow
            key={`bid-${bid.price}`}
            type="bid"
            price={bid.price}
            quantity={bid.quantity}
            total={bid.total}
            maxTotal={maxTotalVolume}
            isBest={idx === 0}
          />
        ))}
      </div>
    </div>
  );
}
