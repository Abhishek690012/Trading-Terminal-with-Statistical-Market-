import { memo, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AVAILABLE_SYMBOLS, useStore } from '../../store/useStore';

const formatUsd = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const shortSymbol = (full: string) => full.split('/')[0] ?? full;

const Header = memo(() => {
  const location = useLocation();

  const usdBalance = useStore((s) => s.usdBalance);
  const lockedBalance = useStore((s) => s.lockedBalance);
  const selectedSymbol = useStore((s) => s.selectedSymbol);
  const symbols = useStore((s) => s.symbols);
  const setSelectedSymbol = useStore((s) => s.setSelectedSymbol);

  const selected = symbols[selectedSymbol];
  const portfolioValue = selected?.currentPrice && selected.portfolioData.quantity
    ? selected.currentPrice * selected.portfolioData.quantity
    : 0;

  const totalNetWorth = useMemo(
    () => usdBalance + lockedBalance + portfolioValue,
    [usdBalance, lockedBalance, portfolioValue],
  );

  const navItems = [
    { to: '/trade', label: 'Trade' },
    { to: '/portfolio', label: 'Portfolio' },
    { to: '/wallet', label: 'Wallet' },
  ];

  return (
    <header className="h-16 flex items-center justify-between gap-4 px-6 select-none bg-bg-shell border-b border-white/5">
      {/* LEFT: Logo and Nav */}
      <div className="flex items-center gap-8 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-bg-card shadow-premium flex items-center justify-center font-black text-[11px] tracking-wider border border-white/10 text-white">
            BT
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="font-bold tracking-tight text-[15px] whitespace-nowrap text-white">BlockTrade</span>
            <span className="text-gray-500 text-[9px] uppercase tracking-[0.15em] font-bold whitespace-nowrap">
              Terminal
            </span>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold premium-transition ${
                  active
                    ? 'bg-bg-card text-white shadow-sm ring-1 ring-white/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* CENTER: Net Worth */}
      <div className="flex-1 hidden md:flex justify-center absolute left-1/2 -translate-x-1/2">
        <div className="bg-bg-card rounded-2xl shadow-premium px-8 py-2.5 border border-white/5 flex flex-col items-center min-w-[280px]">
          <div className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">Total Net Worth</div>
          <div className="font-mono font-black text-xl tracking-tighter text-white" data-numeric="true">
            {totalNetWorth > 0 ? `$${formatUsd(totalNetWorth)}` : '—'}
          </div>
        </div>
      </div>

      {/* RIGHT: Balances & Selector */}
      <div className="flex items-center gap-6 min-w-0">
        <div className="hidden xl:flex flex-col items-end leading-tight mr-2">
          <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Available</span>
          <span className="font-mono font-bold text-[14px] text-white" data-numeric="true">
            ${formatUsd(usdBalance)}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin max-w-[400px]">
          {AVAILABLE_SYMBOLS.map((sym) => {
            const s = symbols[sym];
            const px = s?.currentPrice ?? 0;
            const change = s?.priceChangePercent ?? 0;
            const active = sym === selectedSymbol;
            const up = change >= 0;
            const pillSymbol = shortSymbol(sym);

            return (
              <button
                key={sym}
                type="button"
                onClick={() => setSelectedSymbol(sym)}
                className={`shrink-0 px-3 py-2 rounded-xl premium-transition flex flex-col items-center min-w-[80px] border ${
                  active 
                    ? 'bg-bg-card border-white/10 shadow-premium scale-105 active:scale-100 z-10' 
                    : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/5'
                }`}
                aria-pressed={active}
              >
                <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400">{pillSymbol}</div>
                <div className="font-mono text-[12px] font-black text-white" data-numeric="true">
                  {px > 0 ? formatUsd(px) : '—'}
                </div>
                <div className={`text-[10px] font-bold ${up ? 'text-brand-green' : 'text-brand-red'}`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
});

Header.displayName = 'Header';
export default Header;
