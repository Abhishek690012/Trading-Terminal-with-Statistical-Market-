import { useMemo, useState, useEffect } from 'react';
import { useStore, AVAILABLE_SYMBOLS } from '../../store/useStore';

const formatUsd = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatToken = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export default function Portfolio() {
  const usdBalance = useStore((s) => s.usdBalance);
  const lockedBalance = useStore((s) => s.lockedBalance);
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const symbolsState = useStore((s) => s.symbols);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const data = useMemo(() => {
    const selected = symbolsState[selectedSymbol];
    const selectedQty = selected?.portfolioData.quantity ?? 0;
    const selectedPrice = selected?.currentPrice ?? 0;
    const selectedAvgBuyPrice = selected?.portfolioData.avgBuyPrice ?? 0;

    const totalEstValue = usdBalance + lockedBalance + selectedQty * selectedPrice;
    const totalAssetPnl =
      selectedQty > 0 && selectedPrice > 0 ? (selectedPrice - selectedAvgBuyPrice) * selectedQty : 0;

    const rows = AVAILABLE_SYMBOLS.map((sym) => {
      const symData = symbolsState[sym];
      const asset = sym.split('/')[0];
      const quantity = symData?.portfolioData.quantity || 0;
      const avgBuyPrice = symData?.portfolioData.avgBuyPrice || 0;
      const currentPrice = symData?.currentPrice || 0;

      const value = quantity * currentPrice;
      const pnl = quantity > 0 && currentPrice > 0 ? (currentPrice - avgBuyPrice) * quantity : 0;
      
      return {
        asset,
        balance: quantity,
        value,
        pnl,
        avgBuyPrice,
      };
    });

    return { totalEstValue, totalAssetPnl, rows };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdBalance, lockedBalance, selectedSymbol, symbolsState, tick]);

  return (
    <div className="flex flex-col w-full h-full bg-transparent overflow-hidden select-none">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-gray-500 font-bold uppercase tracking-[0.1em] text-[10px]">
          Portfolio Status
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Total PnL</span>
            <div className={`font-mono text-[14px] font-black ${data.totalAssetPnl >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
              {data.totalAssetPnl > 0 ? '+' : ''}{formatUsd(data.totalAssetPnl)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Card */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 mb-8 shadow-premium">
        <div className="text-gray-500 text-[10px] uppercase tracking-widest font-black mb-3">Total Estimated Value</div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-mono font-black text-white tracking-tighter" data-numeric="true">
            ${formatUsd(data.totalEstValue)}
          </span>
          <span className="text-gray-500 text-xs font-bold font-mono">USD</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <div className="border border-white/5 rounded-2xl overflow-hidden shadow-premium">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider font-black text-gray-500 bg-white/[0.03] border-b border-white/5">
                <th className="text-left px-5 py-4">Asset</th>
                <th className="text-right px-5 py-4">Balance</th>
                <th className="text-right px-5 py-4">Value (USD)</th>
                <th className="text-right px-5 py-4">PnL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {/* USD Cash Row */}
              <tr className="hover:bg-white/[0.02] premium-transition">
                <td className="px-5 py-4 text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-400 border border-blue-500/30">
                      $
                    </div>
                    <span className="text-white font-bold">USD Cash</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-right text-gray-400 font-mono" data-numeric="true">
                  {formatUsd(usdBalance + lockedBalance)}
                </td>
                <td className="px-5 py-4 text-right text-gray-300 font-mono" data-numeric="true">
                  ${formatUsd(usdBalance + lockedBalance)}
                </td>
                <td className="px-5 py-4 text-right font-bold text-gray-600">
                  —
                </td>
              </tr>

              {/* Asset Rows */}
              {data.rows.map((r) => (
                <tr key={r.asset} className="hover:bg-white/[0.02] premium-transition">
                  <td className="px-5 py-4 text-left">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black text-gray-400 border border-white/10 uppercase">
                        {r.asset[0]}
                      </div>
                      <span className="text-white font-bold">{r.asset}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-gray-400 font-mono" data-numeric="true">{formatToken(r.balance)}</td>
                  <td className="px-5 py-4 text-right text-gray-300 font-mono" data-numeric="true">${formatUsd(r.value)}</td>
                  <td
                    className={`px-5 py-4 text-right font-bold font-mono ${
                      r.pnl === 0 ? 'text-gray-600' : r.pnl > 0 ? 'text-brand-green' : 'text-brand-red'
                    }`}
                    data-numeric="true"
                  >
                    {r.pnl === 0 ? '—' : `${r.pnl > 0 ? '+' : ''}${formatUsd(r.pnl)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="bg-white/[0.03] px-5 py-4 flex justify-between items-center border-t border-white/5">
            <span className="text-gray-500 font-black uppercase tracking-widest text-[9px]">Summary</span>
            <div className="flex gap-6">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-gray-600 font-bold uppercase text-[8px]">Assets</span>
                <span className="text-white font-mono font-bold text-xs" data-numeric="true">{AVAILABLE_SYMBOLS.length}</span>
              </div>
              <div className="flex flex-col items-end leading-tight">
                <span className="text-gray-600 font-bold uppercase text-[8px]">Net Worth</span>
                <span className="text-white font-mono font-black text-xs" data-numeric="true">${formatUsd(data.totalEstValue)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
