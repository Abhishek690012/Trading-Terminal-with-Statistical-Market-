import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { SYMBOL_MULTIPLIERS, useStore } from '../../store/useStore';

export default function TradePanel() {
  const usdBalance = useStore((s) => s.usdBalance);
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const symbolsState = useStore((s) => s.symbols);
  const placeTrade = useStore((s) => s.placeTrade);
  const revertTrade = useStore((s) => s.revertTrade);

  const symData = symbolsState[selectedSymbol];
  const currentPrice = symData ? symData.currentPrice : 0;
  const assetQty = symData ? symData.portfolioData.quantity : 0;

  const mult = SYMBOL_MULTIPLIERS[selectedSymbol] ?? 1;

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedQty = useMemo(() => parseFloat(quantity), [quantity]);
  const parsedPrice = useMemo(() => parseFloat(price), [price]);

  const isQtyValid = Number.isFinite(parsedQty) && parsedQty > 0;
  const isPriceValid = orderType === 'market' ? true : Number.isFinite(parsedPrice) && parsedPrice > 0;

  const hasMarketPrice = orderType === 'market' ? currentPrice > 0 : true;
  const optimisticPrice = orderType === 'market' ? currentPrice : parsedPrice;

  const sellEnough = side === 'sell' ? parsedQty <= assetQty : true;
  const buyHasCash =
    side === 'buy'
      ? hasMarketPrice && optimisticPrice > 0
        ? optimisticPrice * parsedQty <= usdBalance + 1e-9
        : false
      : true;

  const canSubmit = isQtyValid && isPriceValid && hasMarketPrice && sellEnough && buyHasCash && !isSubmitting;

  useEffect(() => {
    if (!statusMessage) return;
    if (canSubmit) setStatusMessage(null);
  }, [canSubmit, statusMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!isQtyValid) {
      setStatusMessage({ type: 'error', text: 'Quantity must be greater than 0.' });
      return;
    }
    if (!isPriceValid) {
      setStatusMessage({ type: 'error', text: 'Price must be greater than 0.' });
      return;
    }
    if (!hasMarketPrice) {
      setStatusMessage({ type: 'error', text: 'Market price not available yet.' });
      return;
    }
    if (side === 'sell' && !sellEnough) {
      setStatusMessage({ type: 'error', text: 'Insufficient balance' });
      return;
    }
    if (side === 'buy' && !buyHasCash) {
      setStatusMessage({ type: 'error', text: 'Insufficient balance' });
      return;
    }

    setIsSubmitting(true);

    const execPrice = optimisticPrice;
    
    // Optimistic Update
    placeTrade(side, parsedQty, execPrice);

    try {
      const requestSide = side === 'buy' ? 'BID' : 'ASK';
      const basePrice = orderType === 'market' ? 0 : execPrice / mult;
      const baseQuantity = parsedQty * mult;

      await api.post('/order', {
        user_id: 'user1',
        type: orderType,
        side: requestSide,
        price: basePrice,
        quantity: baseQuantity,
      });

      setStatusMessage({ type: 'success', text: 'Order placed successfully!' });
      
      setQuantity('');
      if (orderType === 'market') setPrice('');
    } catch (error: any) {
      console.error(error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Failed to place order.';

      // Rollback Optimistic Update
      revertTrade(side, parsedQty, execPrice);

      setStatusMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const assetName = selectedSymbol.split('/')[0];

  return (
    <div className="flex flex-col w-full h-full bg-transparent overflow-hidden select-none">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-gray-500 font-bold uppercase tracking-[0.1em] text-[10px]">
          Trade {assetName}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Available:</span>
          <span className="font-mono text-[11px] font-black text-gray-300" data-numeric="true">
            {side === 'buy' ? `$${usdBalance.toLocaleString()}` : `${assetQty.toFixed(4)} ${assetName}`}
          </span>
        </div>
      </div>
      
      {/* Status Notifications */}
      {statusMessage && (
        <div 
          className={`px-4 py-3 rounded-xl mb-6 text-[11px] font-bold premium-transition flex items-center gap-2 border ${
            statusMessage.type === 'success' 
              ? 'bg-brand-green/10 text-brand-green border-brand-green/20' 
              : 'bg-brand-red/10 text-brand-red border-brand-red/20'
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${statusMessage.type === 'success' ? 'bg-brand-green' : 'bg-brand-red'}`} />
          {statusMessage.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 flex-1">
        
        {/* Side Toggle */}
        <div className="flex rounded-2xl p-1 bg-white/[0.03] border border-white/5 gap-1">
          <button
            type="button"
            className={`flex-1 py-2 text-[11px] font-black uppercase rounded-xl premium-transition border ${
              side === 'buy' 
                ? 'bg-brand-green text-white border-white/10 shadow-glow-green' 
                : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'
            }`}
            onClick={() => { setSide('buy'); setStatusMessage(null); }}
          >
            Buy
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-[11px] font-black uppercase rounded-xl premium-transition border ${
              side === 'sell' 
                ? 'bg-brand-red text-white border-white/10 shadow-glow-red' 
                : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'
            }`}
            onClick={() => { setSide('sell'); setStatusMessage(null); }}
          >
            Sell
          </button>
        </div>

        {/* Form Fields */}
        <div className="flex flex-col gap-5">
          {/* Order Type */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-500 text-[9px] uppercase font-black tracking-widest px-1">Order Type</label>
            <div className="relative">
              <select
                value={orderType}
                onChange={(e) => {
                  setOrderType(e.target.value as 'limit' | 'market');
                  setStatusMessage(null);
                }}
                className="w-full bg-white/[0.03] border border-white/5 text-gray-200 rounded-2xl px-4 py-3 appearance-none outline-none premium-transition focus:border-white/20 focus:bg-white/[0.05] cursor-pointer text-[13px] font-bold"
              >
                <option value="limit">Limit Order</option>
                <option value="market">Market Order</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500 text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* Price Input */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-500 text-[9px] uppercase font-black tracking-widest px-1">Price (USD)</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={orderType === 'market'}
                value={orderType === 'market' ? '' : price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={orderType === 'market' ? 'Execution at market price' : '0.00'}
                className={`w-full bg-white/[0.03] border border-white/5 text-gray-200 rounded-2xl px-4 py-3 outline-none premium-transition font-mono text-[13px] font-bold placeholder:text-gray-700 ${
                  orderType === 'market' 
                    ? 'opacity-40 cursor-not-allowed bg-transparent' 
                    : 'focus:border-white/20 focus:bg-white/[0.05]'
                }`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600 uppercase">USD</span>
            </div>
            {orderType === 'limit' && !isPriceValid && price !== '' && (
              <div className="text-brand-red text-[10px] font-black px-1 mt-1 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-brand-red" /> Price must be greater than 0
              </div>
            )}
          </div>

          {/* Quantity Input */}
          <div className="flex flex-col gap-2">
             <label className="text-gray-500 text-[9px] uppercase font-black tracking-widest px-1">Quantity</label>
             <div className="relative">
               <input
                 type="number"
                 step="0.0001"
                 min="0"
                 value={quantity}
                 onChange={(e) => setQuantity(e.target.value)}
                 placeholder="0.00"
                 className="w-full bg-white/[0.03] border border-white/5 text-gray-200 rounded-2xl px-4 py-3 outline-none premium-transition font-mono text-[13px] font-bold placeholder:text-gray-700 focus:border-white/20 focus:bg-white/[0.05]"
               />
               <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600 uppercase">{assetName}</span>
             </div>
             {quantity !== '' && !isQtyValid && (
               <div className="text-brand-red text-[10px] font-black px-1 mt-1 flex items-center gap-1">
                 <span className="w-1 h-1 rounded-full bg-brand-red" /> Quantity must be greater than 0
               </div>
             )}
             {isQtyValid && side === 'sell' && !sellEnough && (
               <div className="text-brand-red text-[10px] font-black px-1 mt-1 flex items-center gap-1">
                 <span className="w-1 h-1 rounded-full bg-brand-red" /> Insufficient balance
               </div>
             )}
             {isQtyValid && side === 'buy' && !buyHasCash && (
               <div className="text-brand-red text-[10px] font-black px-1 mt-1 flex items-center gap-1">
                 <span className="w-1 h-1 rounded-full bg-brand-red" /> Insufficient USD balance
               </div>
             )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-auto pt-6 border-t border-white/5">
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-4 rounded-2xl font-black tracking-[0.1em] uppercase text-[11px] premium-transition active:scale-[0.97] border shadow-premium ${
              side === 'buy' 
                ? 'bg-brand-green text-white border-white/10 hover:brightness-110 disabled:bg-gray-800/40 disabled:text-gray-600 disabled:border-transparent disabled:shadow-none disabled:cursor-not-allowed' 
                : 'bg-brand-red text-white border-white/10 hover:brightness-110 disabled:bg-gray-800/40 disabled:text-gray-600 disabled:border-transparent disabled:shadow-none disabled:cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
                Processing...
              </span>
            ) : (
              `Place ${side === 'buy' ? 'Buy' : 'Sell'} Order`
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
