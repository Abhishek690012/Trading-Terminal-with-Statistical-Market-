import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Trade = {
  price: number;
  quantity: number;
  timestamp: number;
  side?: 'buy' | 'sell';
};

export type Candle = {
  time: number; // seconds
  open: number;
  high: number;
  low: number;
  close: number;
};

export type OrderBookLevel = {
  price: number;
  quantity: number;
};

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export type SymbolData = {
  symbol: string;
  currentPrice: number;
  previousPrice: number;
  priceChangePercent: number;
  volume24h: number;
  trades: Trade[];
  candles: Candle[];
  orderBook: OrderBook;
  portfolioData: {
    asset: string;
    quantity: number;
    avgBuyPrice: number;
  };
};

export const AVAILABLE_SYMBOLS = ['BTC/USD', 'ETH/USD', 'SOL/USD'];

export const SYMBOL_MULTIPLIERS: Record<string, number> = {
  'BTC/USD': 1,
  'ETH/USD': 0.08,
  'SOL/USD': 0.2,
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface StoreState {
  usdBalance: number;
  lockedBalance: number;
  selectedSymbol: string;
  symbols: Record<string, SymbolData>;
  lastWsTradeAt: number;

  // ── Actions ─────────────────────────────────────────────────────────────────
  setSelectedSymbol: (symbol: string) => void;
  setPrice: (price: number, symbolKey?: string) => void;
  addTrade: (trade: Trade, symbolKey?: string) => void;
  updateOrderBook: (
    bids: OrderBookLevel[],
    asks: OrderBookLevel[],
    symbolKey?: string
  ) => void;
  
  // Trade execution (optimistic updates)
  placeTrade: (side: 'buy' | 'sell', quantity: number, price: number) => void;
  revertTrade: (side: 'buy' | 'sell', quantity: number, price: number) => void;

  // Backend reconciliation (native/base asset -> each virtual symbol).
  reconcilePortfolio: (cashUSD: number, baseAssetQuantity: number) => void;
}

const createInitialSymbolData = (symbol: string): SymbolData => ({
  symbol,
  currentPrice: 0,
  previousPrice: 0,
  priceChangePercent: 0,
  volume24h: 0,
  trades: [],
  candles: [],
  orderBook: { bids: [], asks: [] },
  portfolioData: {
    asset: symbol.split('/')[0],
    quantity: 0,
    avgBuyPrice: 0,
  },
});

export const useStore = create<StoreState>((set) => ({
  // ── Initial State ────────────────────────────────────────────────────────────
  usdBalance: 100000,
  lockedBalance: 0,
  selectedSymbol: 'BTC/USD',
  symbols: {
    'BTC/USD': createInitialSymbolData('BTC/USD'),
    'ETH/USD': createInitialSymbolData('ETH/USD'),
    'SOL/USD': createInitialSymbolData('SOL/USD'),
  },
  lastWsTradeAt: 0,

  // ── Actions ──────────────────────────────────────────────────────────────────
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

  setPrice: (price, symbolKey) =>
    set((state) => {
      const key = symbolKey ?? state.selectedSymbol;
      const symData = state.symbols[key];
      if (!symData) return state;

      const prev = symData.currentPrice;
      const change = prev > 0 ? ((price - prev) / prev) * 100 : 0;

      return {
        symbols: {
          ...state.symbols,
          [key]: {
            ...symData,
            previousPrice: prev,
            currentPrice: price,
            priceChangePercent: change,
          },
        },
      };
    }),

  addTrade: (trade, symbolKey) =>
    set((state) => {
      const key = symbolKey ?? state.selectedSymbol;
      const symData = state.symbols[key];
      if (!symData) return state;

      const updatedTrades = [...symData.trades, trade].slice(-500);
      const latestPrice = trade.price;
      const prev = symData.currentPrice;
      const change = prev > 0 ? ((latestPrice - prev) / prev) * 100 : 0;

      // Candle aggregation: 1 candle per second.
      const candleTime = Math.floor(trade.timestamp / 1000);
      const lastCandle = symData.candles[symData.candles.length - 1];
      const shouldUpdateLast = lastCandle && lastCandle.time === candleTime;

      let nextCandles: Candle[];
      if (shouldUpdateLast && lastCandle) {
        const updated: Candle = {
          ...lastCandle,
          high: Math.max(lastCandle.high, trade.price),
          low: Math.min(lastCandle.low, trade.price),
          close: trade.price,
        };
        nextCandles = [...symData.candles.slice(0, -1), updated];
      } else {
        const newCandle: Candle = {
          time: candleTime,
          open: trade.price,
          high: trade.price,
          low: trade.price,
          close: trade.price,
        };
        nextCandles = [...symData.candles, newCandle].slice(-300);
      }

      return {
        symbols: {
          ...state.symbols,
          [key]: {
            ...symData,
            trades: updatedTrades,
            previousPrice: prev,
            currentPrice: latestPrice,
            priceChangePercent: change,
            volume24h: symData.volume24h + trade.quantity * latestPrice,
            candles: nextCandles,
          },
        },
        lastWsTradeAt: trade.timestamp,
      };
    }),

  updateOrderBook: (bids, asks, symbolKey) =>
    set((state) => {
      const key = symbolKey ?? state.selectedSymbol;
      const symData = state.symbols[key];
      if (!symData) return state;

      return {
        symbols: {
          ...state.symbols,
          [key]: {
            ...symData,
            orderBook: { bids, asks },
          },
        },
      };
    }),

  placeTrade: (side, quantity, price) =>
    set((state) => {
      const symData = state.symbols[state.selectedSymbol];
      if (!symData) return state;

      const cost = quantity * price;
      let newUsdBalance = state.usdBalance;
      let newLockedBalance = state.lockedBalance;
      const newPortfolioData = { ...symData.portfolioData };

      if (side === 'buy') {
        // Optimistic: reserve cash until fill.
        newUsdBalance -= cost;
        newLockedBalance += cost;
      } else if (side === 'sell') {
        newUsdBalance += cost;
        newPortfolioData.quantity -= quantity;
        if (newPortfolioData.quantity <= 0) {
            newPortfolioData.quantity = 0;
            newPortfolioData.avgBuyPrice = 0;
        }
      }

      return {
        usdBalance: newUsdBalance,
        lockedBalance: newLockedBalance,
        symbols: {
          ...state.symbols,
          [state.selectedSymbol]: {
            ...symData,
            portfolioData: newPortfolioData,
          },
        },
      };
    }),

  revertTrade: (side, quantity, price) =>
    set((state) => {
      const symData = state.symbols[state.selectedSymbol];
      if (!symData) return state;

      const cost = quantity * price;
      let newUsdBalance = state.usdBalance;
      let newLockedBalance = state.lockedBalance;
      const newPortfolioData = { ...symData.portfolioData };

      if (side === 'buy') {
        // Undo a reserved-buy.
        newUsdBalance += cost;
        newLockedBalance -= cost;
      } else if (side === 'sell') {
        // Undo a sell: restore asset and cash.
        newUsdBalance -= cost;
        newPortfolioData.quantity += quantity;
        if (newPortfolioData.avgBuyPrice === 0) {
          newPortfolioData.avgBuyPrice = price;
        }
      }

      return {
        usdBalance: newUsdBalance,
        lockedBalance: Math.max(0, newLockedBalance),
        symbols: {
          ...state.symbols,
          [state.selectedSymbol]: {
            ...symData,
            portfolioData: newPortfolioData,
          },
        },
      };
    }),

  reconcilePortfolio: (cashUSD, baseAssetQuantity) =>
    set((state) => {
      const totalStoreCash = state.usdBalance + state.lockedBalance;
      // Backend portfolio cash does NOT reserve funds for open orders.
      // So when we reconcile, we only reduce `lockedBalance` by the amount
      // of cash the backend indicates has actually been spent.
      const spent = Math.max(0, totalStoreCash - cashUSD);
      const nextLocked = Math.max(0, state.lockedBalance - spent);
      const nextUsd = Math.max(0, cashUSD - nextLocked);

      const nextSymbols: Record<string, SymbolData> = {};

      for (const sym of Object.keys(state.symbols)) {
        const mult = SYMBOL_MULTIPLIERS[sym] ?? 1;
        const virtualQty = baseAssetQuantity / mult;
        const prev = state.symbols[sym];

        nextSymbols[sym] = {
          ...prev,
          portfolioData: {
            ...prev.portfolioData,
            quantity: virtualQty,
            avgBuyPrice: virtualQty <= 0 ? 0 : prev.portfolioData.avgBuyPrice || prev.currentPrice || 0,
          },
        };
      }

      return {
        usdBalance: nextUsd,
        lockedBalance: nextLocked,
        symbols: nextSymbols,
      };
    }),
}));
