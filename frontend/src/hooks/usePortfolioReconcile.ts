import { useEffect, useRef } from 'react';
import api from '../services/api';
import { useStore } from '../store/useStore';

export function usePortfolioReconcile() {
  const lastWsTradeAt = useStore((s) => s.lastWsTradeAt);
  const reconcilePortfolio = useStore((s) => s.reconcilePortfolio);

  const lastFetchAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const fetchAndReconcile = async () => {
      const now = Date.now();
      // Throttle API calls; trades can be frequent.
      if (now - lastFetchAtRef.current < 600) return;
      lastFetchAtRef.current = now;

      try {
        const response = await api.get('/portfolio?user_id=user1');
        const cash = response.data?.cash ?? 0;
        const assets = response.data?.asset ?? 0;
        if (cancelled) return;
        reconcilePortfolio(cash, assets);
      } catch (err) {
        console.error('[PortfolioReconcile] failed', err);
      }
    };

    // Initial reconciliation.
    fetchAndReconcile();

    // Reconcile whenever we receive new WS trades.
    if (lastWsTradeAt > 0) {
      fetchAndReconcile();
    }

    return () => {
      cancelled = true;
    };
  }, [lastWsTradeAt, reconcilePortfolio]);
}

