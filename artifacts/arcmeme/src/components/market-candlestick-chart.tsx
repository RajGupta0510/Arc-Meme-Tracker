import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type UTCTimestamp,
} from "lightweight-charts";
import { Activity } from "lucide-react";

export type MarketCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type MarketCandlestickChartProps = {
  candles: MarketCandle[];
};

// EMA Calculation Helper
function calculateEMA(candles: MarketCandle[], period: number) {
  const k = 2 / (period + 1);
  const emaArray: { time: number; value: number }[] = [];
  if (candles.length < period) return emaArray;

  // Initial SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let prevEma = sum / period;
  emaArray.push({ time: candles[period - 1].time, value: prevEma });

  for (let i = period; i < candles.length; i++) {
    const currentEma = candles[i].close * k + prevEma * (1 - k);
    emaArray.push({ time: candles[i].time, value: currentEma });
    prevEma = currentEma;
  }
  return emaArray;
}

// RSI Calculation Helper
function calculateRSI(candles: MarketCandle[], period: number = 14) {
  const rsiArray: { time: number; value: number }[] = [];
  if (candles.length <= period) return rsiArray;

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const firstRSI = avgLoss === 0 ? 100 : 100 - 100 / (1 + firstRS);
  rsiArray.push({ time: candles[period].time, value: firstRSI });

  for (let i = period + 1; i < candles.length; i++) {
    const currentGain = gains[i - 1];
    const currentLoss = losses[i - 1];

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsiValue = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
    rsiArray.push({ time: candles[i].time, value: rsiValue });
  }
  return rsiArray;
}

// MACD Calculation Helper
function calculateMACD(candles: MarketCandle[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const macdArray: {
    time: number;
    macd: number;
    signal: number;
    histogram: number;
  }[] = [];
  if (candles.length < slowPeriod) return macdArray;

  const fastEma = calculateEMA(candles, fastPeriod);
  const slowEma = calculateEMA(candles, slowPeriod);

  const macdLineData: { time: number; value: number }[] = [];
  const fastMap = new Map(fastEma.map((item) => [item.time, item.value]));

  for (const item of slowEma) {
    const fValue = fastMap.get(item.time);
    if (fValue !== undefined) {
      const macdVal = fValue - item.value;
      macdLineData.push({ time: item.time, value: macdVal });
    }
  }

  if (macdLineData.length < signalPeriod) return macdArray;

  const mockCandlesForSignal: MarketCandle[] = macdLineData.map((d) => ({
    time: d.time,
    open: d.value,
    high: d.value,
    low: d.value,
    close: d.value,
    volume: 0,
  }));

  const signalEma = calculateEMA(mockCandlesForSignal, signalPeriod);
  const signalMap = new Map(signalEma.map((item) => [item.time, item.value]));

  for (const item of macdLineData) {
    const sValue = signalMap.get(item.time);
    if (sValue !== undefined) {
      const hist = item.value - sValue;
      macdArray.push({
        time: item.time,
        macd: item.value,
        signal: sValue,
        histogram: hist,
      });
    }
  }

  return macdArray;
}

export function MarketCandlestickChart({ candles }: MarketCandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rsiContainerRef = useRef<HTMLDivElement | null>(null);
  const macdContainerRef = useRef<HTMLDivElement | null>(null);

  // Technical overlays state
  const [showEma9, setShowEma9] = useState(false);
  const [showEma21, setShowEma21] = useState(false);
  const [showRsi, setShowRsi] = useState(false);
  const [showMacd, setShowMacd] = useState(false);

  // Sort candles in ascending chronological order to satisfy lightweight-charts requirements
  const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

  // Calculations
  const ema9Data = calculateEMA(sortedCandles, 9);
  const ema21Data = calculateEMA(sortedCandles, 21);
  const rsiData = calculateRSI(sortedCandles, 14);
  const macdData = calculateMACD(sortedCandles, 12, 26, 9);

  const latestRsi = rsiData.length > 0 ? rsiData[rsiData.length - 1].value : null;
  const latestMacd = macdData.length > 0 ? macdData[macdData.length - 1] : null;

  // Compute heights dynamically
  const activePanes = [showRsi && rsiData.length > 0, showMacd && macdData.length > 0].filter(Boolean).length;
  const mainHeight = activePanes === 2 ? "54%" : activePanes === 1 ? "74%" : "100%";
  const subHeight = activePanes === 2 ? "22%" : "25%";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Create Main Candlestick Chart
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(230, 237, 243, 0.72)",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.08)" },
        horzLines: { color: "rgba(148, 163, 184, 0.08)" },
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.18)",
        scaleMargins: { top: 0.08, bottom: 0.24 },
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.18)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Add Candlesticks
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderVisible: false,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    // Add Volume Histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });

    chart.priceScale("").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });

    candleSeries.setData(
      sortedCandles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );

    volumeSeries.setData(
      sortedCandles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        value: candle.volume,
        color: candle.close >= candle.open ? "rgba(34, 197, 94, 0.32)" : "rgba(239, 68, 68, 0.32)",
      })),
    );

    // Add EMA 9 Line (Blue)
    let ema9Series: any = null;
    if (showEma9 && ema9Data.length > 0) {
      ema9Series = chart.addSeries(LineSeries, {
        color: "#2563eb", // blue
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: "EMA 9",
      });
      ema9Series.setData(
        ema9Data.map((d) => ({
          time: d.time as UTCTimestamp,
          value: d.value,
        }))
      );
    }

    // Add EMA 21 Line (Yellow)
    let ema21Series: any = null;
    if (showEma21 && ema21Data.length > 0) {
      ema21Series = chart.addSeries(LineSeries, {
        color: "#f59e0b", // yellow
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: "EMA 21",
      });
      ema21Series.setData(
        ema21Data.map((d) => ({
          time: d.time as UTCTimestamp,
          value: d.value,
        }))
      );
    }

    // 2. Create RSI Sub-pane Chart if enabled
    let rsiChart: any = null;
    const rsiContainer = rsiContainerRef.current;

    if (showRsi && rsiContainer && rsiData.length > 0) {
      rsiChart = createChart(rsiContainer, {
        width: rsiContainer.clientWidth,
        height: rsiContainer.clientHeight,
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "rgba(230, 237, 243, 0.72)",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "rgba(148, 163, 184, 0.04)" },
          horzLines: { color: "rgba(148, 163, 184, 0.08)" },
        },
        rightPriceScale: {
          borderColor: "rgba(148, 163, 184, 0.18)",
          scaleMargins: { top: 0.15, bottom: 0.15 },
          visible: true,
        },
        timeScale: {
          borderColor: "rgba(148, 163, 184, 0.18)",
          visible: true,
          timeVisible: true,
        },
        crosshair: {
          mode: 1,
        },
      });

      const rsiSeries = rsiChart.addSeries(LineSeries, {
        color: "#a855f7", // purple
        lineWidth: 1.5,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      // Add OB 70 line
      rsiSeries.createPriceLine({
        price: 70,
        color: "rgba(239, 68, 68, 0.45)",
        lineWidth: 1,
        lineStyle: 1, // Dotted
        axisLabelVisible: true,
        title: "OB 70",
      });

      // Add OS 30 line
      rsiSeries.createPriceLine({
        price: 30,
        color: "rgba(34, 197, 94, 0.45)",
        lineWidth: 1,
        lineStyle: 1, // Dotted
        axisLabelVisible: true,
        title: "OS 30",
      });

      rsiSeries.setData(
        rsiData.map((d) => ({
          time: d.time as UTCTimestamp,
          value: d.value,
        }))
      );
    }

    // 3. Create MACD Sub-pane Chart if enabled
    let macdChart: any = null;
    const macdContainer = macdContainerRef.current;

    if (showMacd && macdContainer && macdData.length > 0) {
      macdChart = createChart(macdContainer, {
        width: macdContainer.clientWidth,
        height: macdContainer.clientHeight,
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "rgba(230, 237, 243, 0.72)",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "rgba(148, 163, 184, 0.04)" },
          horzLines: { color: "rgba(148, 163, 184, 0.08)" },
        },
        rightPriceScale: {
          borderColor: "rgba(148, 163, 184, 0.18)",
          scaleMargins: { top: 0.1, bottom: 0.1 },
          visible: true,
        },
        timeScale: {
          borderColor: "rgba(148, 163, 184, 0.18)",
          visible: true,
          timeVisible: true,
        },
        crosshair: {
          mode: 1,
        },
      });

      // MACD Line (Blue)
      const macdLineSeries = macdChart.addSeries(LineSeries, {
        color: "#06b6d4", // cyan
        lineWidth: 1.5,
        priceLineVisible: false,
        lastValueVisible: true,
        title: "MACD",
      });

      // Signal Line (Red)
      const signalLineSeries = macdChart.addSeries(LineSeries, {
        color: "#ef4444", // red
        lineWidth: 1.5,
        priceLineVisible: false,
        lastValueVisible: true,
        title: "Signal",
      });

      // Histogram
      const macdHistSeries = macdChart.addSeries(HistogramSeries, {
        priceFormat: { type: "price" },
        priceScaleId: "right",
      });

      macdLineSeries.setData(
        macdData.map((d) => ({
          time: d.time as UTCTimestamp,
          value: d.macd,
        }))
      );

      signalLineSeries.setData(
        macdData.map((d) => ({
          time: d.time as UTCTimestamp,
          value: d.signal,
        }))
      );

      macdHistSeries.setData(
        macdData.map((d) => ({
          time: d.time as UTCTimestamp,
          value: d.histogram,
          color: d.histogram >= 0 ? "rgba(34, 197, 94, 0.55)" : "rgba(239, 68, 68, 0.55)",
        }))
      );
    }

    // Synchronize visible ranges between all active charts
    let isSyncing = false;
    const mainTimeScale = chart.timeScale();
    const rsiTimeScale = rsiChart?.timeScale();
    const macdTimeScale = macdChart?.timeScale();

    const syncRange = (source: any, targets: any[]) => {
      source.subscribeVisibleTimeRangeChange((range: any) => {
        if (isSyncing || !range) return;
        isSyncing = true;
        for (const target of targets) {
          if (target) {
            target.setVisibleRange(range);
          }
        }
        isSyncing = false;
      });
    };

    if (rsiTimeScale) {
      syncRange(mainTimeScale, [rsiTimeScale, macdTimeScale]);
      syncRange(rsiTimeScale, [mainTimeScale, macdTimeScale]);
    }
    if (macdTimeScale) {
      syncRange(mainTimeScale, [rsiTimeScale, macdTimeScale]);
      syncRange(macdTimeScale, [mainTimeScale, rsiTimeScale]);
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      if (rsiChart) rsiChart.remove();
      if (macdChart) macdChart.remove();
    };
  }, [candles, showEma9, showEma21, showRsi, showMacd, ema9Data, ema21Data, rsiData, macdData]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Interactive technical overlay controller strip */}
      <div className="flex flex-wrap items-center gap-4 pb-3 border-b border-border/20 font-mono text-[9px] text-muted-foreground uppercase shrink-0">
        <span className="font-extrabold text-foreground flex items-center gap-1.5 select-none tracking-widest text-[10px]">
          <Activity className="h-4 w-4 text-primary animate-pulse" />
          Technical Analytics (Bloomberg TA):
        </span>
        <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground text-primary/80 hover:text-primary transition-colors">
          <input
            type="checkbox"
            checked={showEma9}
            onChange={(e) => setShowEma9(e.target.checked)}
            className="rounded border-border bg-secondary/30 text-primary focus:ring-primary/20 accent-primary h-3.5 w-3.5"
          />
          <span>EMA 9 (Blue)</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground text-yellow-400/80 hover:text-yellow-400 transition-colors">
          <input
            type="checkbox"
            checked={showEma21}
            onChange={(e) => setShowEma21(e.target.checked)}
            className="rounded border-border bg-secondary/30 text-primary focus:ring-primary/20 accent-primary h-3.5 w-3.5"
          />
          <span>EMA 21 (Yellow)</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground text-purple-400/80 hover:text-purple-400 transition-colors">
          <input
            type="checkbox"
            checked={showRsi}
            onChange={(e) => setShowRsi(e.target.checked)}
            className="rounded border-border bg-secondary/30 text-primary focus:ring-primary/20 accent-primary h-3.5 w-3.5"
          />
          <span>RSI Pane (14)</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground text-cyan-400/80 hover:text-cyan-400 transition-colors">
          <input
            type="checkbox"
            checked={showMacd}
            onChange={(e) => setShowMacd(e.target.checked)}
            className="rounded border-border bg-secondary/30 text-primary focus:ring-primary/20 accent-primary h-3.5 w-3.5"
          />
          <span>MACD Pane</span>
        </label>
      </div>

      {/* Main candlestick grid */}
      <div
        ref={containerRef}
        className="w-full min-h-0 flex-1 pt-3"
        style={{ height: mainHeight }}
      />

      {/* Synchronized RSI Sub-pane */}
      {showRsi && rsiData.length > 0 && (
        <div 
          className="w-full shrink-0 border-t border-border/20 pt-2.5 relative"
          style={{ height: subHeight }}
        >
          <div className="absolute top-2.5 left-2.5 z-10 font-mono text-[8px] text-muted-foreground uppercase tracking-widest bg-black/60 px-1.5 py-0.5 rounded border border-border/20 flex gap-2 select-none">
            <span>RSI (14) Strength Indicator</span>
            <span className="text-primary font-black animate-pulse">LATEST: {latestRsi?.toFixed(1) ?? "N/A"}</span>
          </div>
          <div ref={rsiContainerRef} className="w-full h-full" />
        </div>
      )}

      {/* Synchronized MACD Sub-pane */}
      {showMacd && macdData.length > 0 && (
        <div 
          className="w-full shrink-0 border-t border-border/20 pt-2.5 relative"
          style={{ height: subHeight }}
        >
          <div className="absolute top-2.5 left-2.5 z-10 font-mono text-[8px] text-muted-foreground uppercase tracking-widest bg-black/60 px-1.5 py-0.5 rounded border border-border/20 flex gap-2 select-none">
            <span>MACD (12, 26, 9) Oscillator</span>
            <span className="text-cyan-400 font-black animate-pulse">
              VAL: {latestMacd?.macd.toFixed(6) ?? "N/A"}
            </span>
          </div>
          <div ref={macdContainerRef} className="w-full h-full" />
        </div>
      )}
    </div>
  );
}
