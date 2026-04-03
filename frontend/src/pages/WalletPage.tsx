import { useMemo } from 'react';
import { useStore, AVAILABLE_SYMBOLS } from '../store/useStore';

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

const formatUsd = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WalletPage() {
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const symbolsState = useStore((s) => s.symbols);
  const usdBalance = useStore((s) => s.usdBalance);
  const lockedBalance = useStore((s) => s.lockedBalance);

  const symData = symbolsState[selectedSymbol];
  const trades = symData ? symData.trades : [];

  const txs = useMemo(() => {
    const recent = trades.slice(-20);
    return [...recent].reverse().map((t, i) => {
      const older = recent[recent.length - 2 - i];
      const inferredSide = t.side ?? (!older ? 'buy' : t.price >= older.price ? 'buy' : 'sell');
      const isBuy = inferredSide === 'buy';
      const usd = t.price * t.quantity;
      return {
        key: `${t.timestamp}-${t.price}-${t.quantity}-${t.side ?? ''}`,
        type: isBuy ? 'Deposit' : 'Withdraw',
        date: formatTime(t.timestamp),
        amount: usd,
        isBuy,
      };
    });
  }, [trades]);

  const totalAssetValue =
    symData && symData.currentPrice > 0 ? symData.portfolioData.quantity * symData.currentPrice : 0;
  const totalBalance = usdBalance + lockedBalance + totalAssetValue;

  return (
    <div className="h-full overflow-y-auto px-6 py-6 bg-bg-shell">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Balance Section */}
        <section className="lg:col-span-12">
          <div className="bg-bg-card rounded-2xl shadow-premium border border-white/5 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col">
              <span className="text-gray-500 text-[10px] uppercase tracking-widest font-black mb-2">Total Combined Balance</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-5xl font-mono font-black text-white tracking-tighter" data-numeric="true">
                  ${formatUsd(totalBalance)}
                </span>
                <span className="text-gray-600 text-sm font-bold">USD</span>
              </div>
            </div>
            
            <div className="flex gap-8 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-8">
              <div className="flex flex-col">
                <span className="text-gray-600 text-[9px] uppercase font-black tracking-widest mb-1">Available Cash</span>
                <span className="font-mono text-[14px] font-black text-gray-300" data-numeric="true">${formatUsd(usdBalance)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-600 text-[9px] uppercase font-black tracking-widest mb-1">Locked Funds</span>
                <span className="font-mono text-[14px] font-black text-gray-400" data-numeric="true">${formatUsd(lockedBalance)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Activity & Stats Grid */}
        <section className="lg:col-span-7">
          <div className="bg-bg-card rounded-2xl shadow-premium border border-white/5 p-6 h-[400px] flex flex-col">
            <h3 className="text-gray-500 text-[10px] uppercase tracking-widest font-black mb-4">Account Growth</h3>
            <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <span className="text-gray-400 text-xl italic font-serif">i</span>
              </div>
              <p className="text-gray-500 text-[12px] font-bold max-w-[280px]">
                Detailed growth analytics will be calculated after 24 hours of trading activity.
              </p>
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 flex flex-col gap-8">
          <div className="bg-bg-card rounded-2xl shadow-premium border border-white/5 p-6 flex-1 min-h-[180px]">
             <h3 className="text-gray-500 text-[10px] uppercase tracking-widest font-black mb-4">Secure Identifier</h3>
             <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 font-mono text-[11px]">
                  <span className="text-gray-600 font-bold block mb-1">SYSTEM_UID</span>
                  <span className="text-white font-black truncate block">user_01_alpha_terminal_production</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-600 font-bold uppercase tracking-wider">Account Status</span>
                  <span className="text-brand-green font-black uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-green shadow-glow-green" />
                    Verified
                  </span>
                </div>
             </div>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 shadow-premium">
             <h3 className="text-gray-500 text-[10px] uppercase tracking-widest font-black mb-4">Quick Insights</h3>
             <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col p-3 rounded-xl bg-white/[0.03] border border-white/5">
                   <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Pairs</span>
                   <span className="text-white font-mono font-black text-[13px]">{AVAILABLE_SYMBOLS.length}</span>
                </div>
                <div className="flex flex-col p-3 rounded-xl bg-white/[0.03] border border-white/5">
                   <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Latency</span>
                   <span className="text-brand-green font-mono font-black text-[13px]">4ms</span>
                </div>
             </div>
          </div>
        </section>

        {/* Transaction History */}
        <section className="lg:col-span-12 mb-12">
          <div className="bg-bg-card rounded-2xl shadow-premium border border-white/5 overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <h3 className="text-gray-400 text-[10px] uppercase tracking-widest font-black">Local Transaction Logs</h3>
              <div className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">{trades.length} Active Records</div>
            </div>

            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="text-gray-500 text-[10px] uppercase tracking-[0.15em] font-black bg-white/[0.03]">
                    <th className="text-left py-4 px-6">Reference Type</th>
                    <th className="text-left py-4 px-6">Timestamp</th>
                    <th className="text-right py-4 px-6">Asset Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {txs.map((tx) => (
                    <tr key={tx.key} className="hover:bg-white/[0.02] premium-transition">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                           <div className={`w-2 h-2 rounded-full ${tx.isBuy ? 'bg-brand-green shadow-glow-green' : 'bg-brand-red shadow-glow-red'}`} />
                           <span className="text-white font-bold tracking-tight">{tx.type}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-500 font-mono text-[11px] font-bold tracking-tighter">{tx.date}</td>
                      <td
                        className={`py-4 px-6 text-right font-mono font-black text-[13px] ${
                          tx.isBuy ? 'text-brand-green' : 'text-brand-red'
                        }`}
                        data-numeric="true"
                      >
                        ${formatUsd(tx.amount)}
                      </td>
                    </tr>
                  ))}
                  {txs.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-20 text-center text-gray-600 text-[11px] font-bold uppercase tracking-[0.2em] italic">
                        No trade activity detected for local terminal session
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 flex justify-end">
               <button className="text-[10px] font-black text-gray-600 uppercase hover:text-white premium-transition tracking-[0.2em]">
                 Request Full Audit Log —&gt;
               </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
