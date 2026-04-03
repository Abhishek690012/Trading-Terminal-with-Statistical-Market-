import { useEffect, useRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  LineStyle,
  CandlestickData,
} from 'lightweight-charts';
import { useStore } from '../../store/useStore';

export default function Chart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const symbolRef = useRef<string>('');
  const lastCandleTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (!chartContainerRef.current || !chartInstanceRef.current) return;
      chartInstanceRef.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: 'rgba(255, 255, 255, 0.05)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      crosshair: {
        mode: 0, // CrosshairMode.Normal
        vertLine: {
          color: 'rgba(255, 255, 255, 0.2)',
          width: 0.5,
          style: LineStyle.Solid,
          labelBackgroundColor: '#1f2937',
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.2)',
          width: 0.5,
          style: LineStyle.Solid,
          labelBackgroundColor: '#1f2937',
        },
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceLineColor: 'rgba(255, 255, 255, 0.2)',
      priceLineWidth: 1,
      priceLineStyle: LineStyle.Dotted,
    });

    chartInstanceRef.current = chart;
    seriesRef.current = series;

    window.addEventListener('resize', handleResize);

    const init = () => {
      const state = useStore.getState();
      const sym = state.selectedSymbol;
      symbolRef.current = sym;
      lastCandleTimeRef.current = null;

      const candles = state.symbols[sym]?.candles ?? [];
      if (candles.length > 0) {
        series.setData(candles as CandlestickData[]);
        lastCandleTimeRef.current = candles[candles.length - 1].time;
        chart.timeScale().scrollToRealTime();
      } else {
        series.setData([]);
      }
    };

    init();

    const unsubscribe = useStore.subscribe((state) => {
      const sym = state.selectedSymbol;
      if (!seriesRef.current) return;

      if (sym !== symbolRef.current) {
        symbolRef.current = sym;
        lastCandleTimeRef.current = null;

        const candles = state.symbols[sym]?.candles ?? [];
        seriesRef.current.setData(candles as CandlestickData[]);
        if (candles.length > 0) {
          lastCandleTimeRef.current = candles[candles.length - 1].time;
          chart.timeScale().scrollToRealTime();
        }
        return;
      }

      const candles = state.symbols[sym]?.candles ?? [];
      if (candles.length === 0) return;

      const last = candles[candles.length - 1];
      const lastTime = lastCandleTimeRef.current;
      const nextTime = last.time;

      seriesRef.current.update(last as unknown as CandlestickData);

      if (lastTime == null || nextTime !== lastTime) {
        lastCandleTimeRef.current = nextTime;
        chart.timeScale().scrollToRealTime();
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribe();
      chart.remove();
    };
  }, []);

  return <div ref={chartContainerRef} className="w-full h-full min-h-[320px] overflow-hidden" />;
}
