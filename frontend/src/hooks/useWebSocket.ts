import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { AVAILABLE_SYMBOLS, SYMBOL_MULTIPLIERS } from '../store/useStore';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: number;

    const connect = () => {
      ws = new WebSocket('ws://localhost:8080/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          const { setPrice, addTrade, updateOrderBook } = useStore.getState();

          switch (data.type) {
            case 'price':
              for (const sym of AVAILABLE_SYMBOLS) {
                const mult = SYMBOL_MULTIPLIERS[sym] ?? 1;
                setPrice(data.price * mult, sym);
              }
              break;

            case 'trade':
              for (const sym of AVAILABLE_SYMBOLS) {
                const mult = SYMBOL_MULTIPLIERS[sym] ?? 1;
                addTrade(
                  {
                    price: data.price * mult,
                    quantity: data.quantity / mult,
                    timestamp: data.timestamp,
                    side:
                      data.side === 'BID'
                        ? 'buy'
                        : data.side === 'ASK'
                          ? 'sell'
                          : undefined,
                  },
                  sym,
                );
              }
              break;

            case 'orderbook':
              for (const sym of AVAILABLE_SYMBOLS) {
                const mult = SYMBOL_MULTIPLIERS[sym] ?? 1;

                const bids = (data.bids || []).map((l: [number, number]) => ({
                  price: l[0] * mult,
                  quantity: l[1] / mult,
                }));
                const asks = (data.asks || []).map((l: [number, number]) => ({
                  price: l[0] * mult,
                  quantity: l[1] / mult,
                }));

                updateOrderBook(bids, asks, sym);
              }
              break;
          }
        } catch (err) {
          console.error('[WS] Error processing message:', err);
        }
      };

      ws.onclose = () => {
        console.log('[WS] disconnected, scheduling reconnect...');
        wsRef.current = null;
        reconnectTimeout = window.setTimeout(connect, 2000);
      };

      ws.onerror = (error) => {
        console.error('[WS] error:', error);
      };
    };

    connect();

    return () => {
      window.clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
}
