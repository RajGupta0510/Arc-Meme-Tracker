import { Link, useLocation } from "wouter";
import {
  getGetPlatformStatsQueryKey,
  getListTokensQueryKey,
  ListTokensSort,
  type Token,
  useGetPlatformStats,
  useListTokens,
} from "@workspace/api-client-react";
import { TokenCard, TokenLogo } from "@/components/token-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportTokenModal } from "@/components/import-token-modal";
import { formatAddress, formatCompactNumber, formatPrice } from "@/lib/utils";
import { Grid3X3, Search, SlidersHorizontal, Star, Table2, Flame, Award, Clock, Users, ArrowUpRight, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAudioTelemetry } from "@/hooks/use-audio-telemetry";

type ViewMode = "grid" | "table";
type MarketFilter = "all" | "live" | "needs-pool" | "watchlist";
type SortField = "marketCap" | "volume24h" | "age" | "holders" | "change24h" | "txCount";
type SortDirection = "asc" | "desc";
type AlertRule = {
  id: string;
  tokenId: string;
  ticker: string;
  metric: "price_above" | "price_below" | "volume_spike" | "liquidity_change" | "whale_swap";
  target: number;
};

const sortLabels: Record<SortField, string> = {
  marketCap: "MCap",
  volume24h: "Volume",
  age: "Age",
  holders: "Holders",
  change24h: "Change",
  txCount: "Tx",
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function LivePriceCell({ price }: { price: number }) {
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const [lastPrice, setLastPrice] = useState(price);
  const { playTickerClick } = useAudioTelemetry();

  useEffect(() => {
    if (price === lastPrice) return;
    if (price > lastPrice) {
      setPriceFlash("up");
    } else if (price < lastPrice) {
      setPriceFlash("down");
    }
    playTickerClick();
    setLastPrice(price);
    const timer = setTimeout(() => setPriceFlash(null), 1000);
    return () => clearTimeout(timer);
  }, [price, lastPrice, playTickerClick]);

  return (
    <td
      className={`px-3 py-2 text-right font-mono font-bold transition-all duration-300 border-y border-border/30 ${
        priceFlash === "up"
          ? "text-primary scale-[1.03] drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
          : priceFlash === "down"
          ? "text-destructive scale-[1.03] drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"
          : "text-foreground/80"
      }`}
    >
      ${formatPrice(price)}
    </td>
  );
}

function MiniSparkline({ token, accentColor }: { token: Token; accentColor: string }) {
  const seed = Array.from(token.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const points = Array.from({ length: 16 }, (_, index) => {
    const wave = Math.sin((seed + index * 19) / 12) * 10;
    const trend = token.marketType === "amm_pool" ? index * 0.8 : -index * 0.25;
    return 30 - wave - trend;
  });
  const path = points.map((y, index) => `${index === 0 ? "M" : "L"}${index * 8},${Math.max(6, Math.min(52, y))}`).join(" ");

  return (
    <svg viewBox="0 0 120 60" className="h-11 w-28 overflow-visible" style={{ color: accentColor }}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" style={{ filter: `drop-shadow(0 0 5px ${accentColor}90)` }} />
    </svg>
  );
}

function TerminalActivityFeed() {
  const { data: signals = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/intelligence/signals"],
    queryFn: async () => {
      const res = await fetch("/api/intelligence/signals");
      if (!res.ok) throw new Error("Failed to fetch signals");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const [activeTab, setActiveTab] = useState<"intel" | "arbitrage">("intel");
  const { playHypeSound, playTickerClick } = useAudioTelemetry();
  const prevLengthRef = useRef(signals.length);

  useEffect(() => {
    if (signals.length > prevLengthRef.current) {
      const newest = signals[0];
      if (newest) {
        if (newest.type === "arbitrage_opportunity") {
          playHypeSound();
        } else {
          playTickerClick();
        }
      }
    }
    prevLengthRef.current = signals.length;
  }, [signals, playHypeSound, playTickerClick]);

  const intelSignals = signals.filter((s) => s.type !== "arbitrage_opportunity");
  const arbitrageSignals = signals.filter((s) => s.type === "arbitrage_opportunity");

  const displaySignals = activeTab === "intel" ? intelSignals : arbitrageSignals;

  return (
    <div className="glass-panel p-4 flex flex-col gap-3 font-mono h-full border border-border/80 bg-card/45 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <div className="flex items-center gap-2 text-xs uppercase font-bold text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary terminal-pulse animate-ping" />
          Arc Intelligence Feed
        </div>
        <span className="text-[9px] text-muted-foreground uppercase tracking-widest animate-pulse">Telemetry Live</span>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-border/20 text-[10px]">
        <button
          onClick={() => setActiveTab("intel")}
          className={`flex-1 py-1.5 font-bold uppercase tracking-wider text-center transition-all ${
            activeTab === "intel"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/10"
          }`}
        >
          🚨 AI Intel ({intelSignals.length})
        </button>
        <button
          onClick={() => setActiveTab("arbitrage")}
          className={`flex-1 py-1.5 font-bold uppercase tracking-wider text-center transition-all ${
            activeTab === "arbitrage"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/10"
          }`}
        >
          ⚡ Arb Radar ({arbitrageSignals.length})
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1 text-xs select-none">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Syncing Feed...</span>
          </div>
        ) : displaySignals.length === 0 ? (
          <div className="text-[10px] text-muted-foreground text-center py-12 italic border border-dashed border-border/40 rounded p-4 bg-black/20">
            {activeTab === "intel"
              ? "[SYS] No security signals reported. Awaiting active contract syncs..."
              : "[SYS] Scanners quiet. No cross-DEX arbitrage discrepancies >= 1.5% detected."}
          </div>
        ) : (
          displaySignals.map((sig) => {
            const isCritical = sig.severity === "critical";
            const isWarning = sig.severity === "warning";
            const typeColor = isCritical
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : isWarning
              ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
              : "border-primary/30 bg-primary/10 text-primary";

            const sideGlow = isCritical
              ? "border-l-destructive shadow-[inset_4px_0_12px_rgba(239,68,68,0.06)]"
              : isWarning
              ? "border-l-yellow-500 shadow-[inset_4px_0_12px_rgba(234,179,8,0.06)]"
              : "border-l-primary shadow-[inset_4px_0_12px_rgba(34,197,94,0.06)]";

            if (sig.type === "arbitrage_opportunity" && sig.arbitrage) {
              const arb = sig.arbitrage;
              return (
                <div
                  key={sig.id}
                  className={`block border-l-2 pl-3 py-2.5 pr-2 rounded bg-card/25 border-y border-r border-border/40 hover:border-primary/40 transition-all duration-200 ${sideGlow}`}
                >
                  <div className="flex items-center justify-between text-[8px] text-muted-foreground mb-1.5">
                    <span className="px-1.5 py-0.5 rounded-[2px] text-[7px] font-extrabold tracking-wider border border-primary/40 bg-primary/10 text-primary uppercase">
                      ⚡ Arb Triggered
                    </span>
                    <span className="text-primary font-bold">{arb.profitPercent.toFixed(2)}% net gap</span>
                  </div>
                  
                  <div className="text-foreground/95 font-mono text-[10px] leading-relaxed">
                    Arb discrepancy detected for <span className="text-primary font-bold">${sig.ticker}</span>:
                    <div className="grid grid-cols-2 gap-2 mt-2 p-1.5 rounded bg-black/60 border border-border/20 text-[9px]">
                      <div>
                        <span className="text-muted-foreground">BUY:</span> <span className="text-primary font-extrabold">{arb.buyDex}</span>
                        <div className="text-foreground/80 font-mono">${formatPrice(arb.buyPrice)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">SELL:</span> <span className="text-destructive font-extrabold">{arb.sellDex}</span>
                        <div className="text-foreground/80 font-mono">${formatPrice(arb.sellPrice)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[8px] text-muted-foreground">Ready to route</span>
                    <Button asChild size="sm" className="h-6 px-3 text-[9px] text-black font-extrabold uppercase bg-primary hover:bg-primary/80">
                      <Link href={`/token/${sig.tokenId}`}>Execute Arb</Link>
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <Link
                href={`/token/${sig.tokenId}`}
                key={sig.id}
                className={`block border-l-2 pl-3 py-2 pr-2 rounded-r bg-card/10 hover:bg-card/45 border-y border-r border-border/40 hover:border-primary/40 transition-all duration-200 cursor-pointer group ${sideGlow}`}
              >
                <div className="flex items-center justify-between text-[8px] text-muted-foreground mb-1.5">
                  <span className={`px-1.5 py-0.5 rounded-[2px] text-[7px] font-extrabold tracking-wider border ${typeColor}`}>
                    {sig.title}
                  </span>
                  <span>{new Date(sig.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-foreground/90 group-hover:text-foreground font-mono text-[10px] leading-relaxed transition-colors">
                  {sig.message}
                </div>
                <div className="mt-1 flex items-center justify-between text-[8px] text-muted-foreground">
                  <span className="text-primary font-bold group-hover:underline">Trade Ticker ${sig.ticker}</span>
                  <span className="flex items-center gap-1">
                    <span className={`w-1 h-1 rounded-full ${isCritical ? "bg-destructive animate-ping" : isWarning ? "bg-yellow-400" : "bg-primary animate-pulse"}`} />
                    Active Signal
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border/40">
        <div className="mb-2 text-[9px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
          <span>Smart Money Arena</span>
          <Link href="/leaderboard" className="text-primary hover:underline flex items-center gap-0.5">
            Leaderboard <ArrowUpRight className="w-2.5 h-2.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded border border-primary/20 bg-primary/5 p-2 flex flex-col justify-between">
            <span className="text-muted-foreground text-[8px] uppercase">Top Smart Money</span>
            <span className="font-extrabold text-primary truncate mt-1">0x1a2e3f4...e0f</span>
          </div>
          <div className="rounded border border-primary/20 bg-primary/5 p-2 flex flex-col justify-between">
            <span className="text-muted-foreground text-[8px] uppercase">Active Degens</span>
            <span className="font-extrabold text-foreground truncate mt-1">10+ tracked</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const [, setLocation] = useLocation();
  const {
    data: stats,
    isError: statsError,
    refetch: refetchStats,
  } = useGetPlatformStats({ query: { queryKey: getGetPlatformStatsQueryKey(), refetchInterval: 15000 } });

  const [sort, setSort] = useState<ListTokensSort>(ListTokensSort.trending);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("volume24h");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("live");
  const [query, setQuery] = useState("");
  const [minVolume, setMinVolume] = useState("");
  const [minMarketCap, setMinMarketCap] = useState("");
  const [watchlist, setWatchlist] = useState<string[]>(() => readJson("arcmeme.watchlist", []));
  const [alerts, setAlerts] = useState<AlertRule[]>(() => readJson("arcmeme.alerts", []));
  const [alertDraft, setAlertDraft] = useState("");
  const [alertMetric, setAlertMetric] = useState<AlertRule["metric"]>("price_above");
  const [alertTokenId, setAlertTokenId] = useState("");
  const [notifiedAlerts, setNotifiedAlerts] = useState<string[]>(() => readJson("arcmeme.notifiedAlerts", []));

  const {
    data: tokens = [],
    isLoading,
    isError: tokensError,
    refetch: refetchTokens,
  } = useListTokens(
    { sort, limit: 100 },
    { query: { queryKey: getListTokensQueryKey({ sort, limit: 100 }), refetchInterval: 15000 } },
  );

  useEffect(() => {
    window.localStorage.setItem("arcmeme.watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    window.localStorage.setItem("arcmeme.alerts", JSON.stringify(alerts));
  }, [alerts]);

  const filteredTokens = useMemo(() => {
    const search = query.trim().toLowerCase();
    const minVol = Number(minVolume) || 0;
    const minCap = Number(minMarketCap) || 0;

    const list = tokens.filter((token) => {
      if (marketFilter === "watchlist" && !watchlist.includes(token.id)) return false;
      if (minVol > 0 && token.volume24h < minVol) return false;
      if (minCap > 0 && token.marketCap < minCap) return false;
      if (!search) return true;
      return `${token.ticker} ${token.name} ${token.contractAddress ?? ""}`.toLowerCase().includes(search);
    });

    if (["trending", "newest", "mostActive", "volume", "topGainers"].includes(sort)) {
      return list;
    }

    return list.sort((a, b) => {
      const getValue = (token: Token) => {
        if (sortField === "age") return new Date(token.createdAt).getTime();
        return token[sortField] ?? 0;
      };
      const aValue = getValue(a);
      const bValue = getValue(b);
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [marketFilter, minMarketCap, minVolume, query, sortDirection, sortField, tokens, watchlist, sort]);

  // Premium feature: Dynamic trending cards
  const trendingTokens = useMemo(() => {
    return [...tokens].sort((a, b) => b.volume24h - a.volume24h).slice(0, 3);
  }, [tokens]);

  const triggeredAlerts = alerts.filter((alert) => {
    const token = tokens.find((item) => item.id === alert.tokenId);
    if (!token) return false;

    if (alert.metric === "price_above") {
      return token.price >= alert.target;
    }
    if (alert.metric === "price_below") {
      return token.price <= alert.target;
    }
    if (alert.metric === "volume_spike") {
      return token.volume24h >= alert.target;
    }
    if (alert.metric === "liquidity_change") {
      return token.marketCap >= alert.target;
    }
    return false;
  });

  const hasApiError = statsError || tokensError;
  const retryApi = () => {
    refetchStats();
    refetchTokens();
  };

  const toggleWatch = (id: string) => {
    setWatchlist((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const createAlert = () => {
    const token = tokens.find((item) => item.id === alertTokenId) ?? filteredTokens[0] ?? tokens[0];
    const target = Number(alertDraft);
    if (!token || !Number.isFinite(target) || target <= 0) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
    setAlerts((current) => [
      { id: `${token.id}-${Date.now()}`, tokenId: token.id, ticker: token.ticker, metric: alertMetric, target },
      ...current,
    ].slice(0, 8));
    setAlertDraft("");
  };

  useEffect(() => {
    const fresh = triggeredAlerts.filter((alert) => !notifiedAlerts.includes(alert.id));
    if (fresh.length === 0) return;

    if ("Notification" in window && Notification.permission === "granted") {
      fresh.forEach((alert) => {
        let label = "";
        if (alert.metric === "price_above") label = "Price rose above";
        if (alert.metric === "price_below") label = "Price dropped below";
        if (alert.metric === "volume_spike") label = "24h Volume exceeded";
        if (alert.metric === "liquidity_change") label = "Liquidity exceeded";
        if (alert.metric === "whale_swap") label = "Whale swap detected at";

        new Notification(`ArcMeme alert: $${alert.ticker}`, {
          body: `${label} target of $${alert.target.toLocaleString()}`,
        });
      });
    }

    setNotifiedAlerts((current) => {
      const next = [...new Set([...current, ...fresh.map((alert) => alert.id)])];
      window.localStorage.setItem("arcmeme.notifiedAlerts", JSON.stringify(next));
      return next;
    });
  }, [notifiedAlerts, triggeredAlerts]);

  return (
    <div className="flex-1 p-3 md:p-5">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        {hasApiError && (
          <div className="glass-panel border-destructive/40 bg-destructive/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-mono text-sm text-destructive font-bold">API request failed</div>
              <div className="text-xs text-muted-foreground">Check the backend server and browser console for request details.</div>
            </div>
            <Button variant="outline" size="sm" onClick={retryApi} className="font-mono text-xs">Retry</Button>
          </div>
        )}

        {/* Global Statistics Panel */}
        <section className="glass-panel overflow-hidden p-4 md:p-5 border border-border/80 bg-card/50 backdrop-blur-md">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-primary">
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))] terminal-pulse" />
                Arc Meme Intelligence Terminal
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight font-sans text-foreground/90">
                Live Arc markets, ranked for action.
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5 xl:min-w-[640px]">
              <StatBox label="Tokens" value={stats?.totalTokens?.toLocaleString() ?? "-"} icon={<Clock className="h-3 w-3 text-primary/70" />} />
              <StatBox label="24h Vol" value={`$${formatCompactNumber(stats?.totalVolume24h || 0)}`} icon={<TrendingUp className="h-3 w-3 text-primary" />} active />
              <StatBox label="MCap" value={`$${formatCompactNumber(stats?.totalMarketCap || 0)}`} icon={<Award className="h-3 w-3 text-accent/70" />} />
              <StatBox label="Watch" value={watchlist.length.toString()} icon={<Star className="h-3 w-3 text-yellow-400" />} />
              <StatBox label="Alerts" value={alerts.length.toString()} icon={<SlidersHorizontal className="h-3 w-3 text-muted-foreground" />} />
            </div>
          </div>
        </section>

        {/* Trending Top Cards Row */}
        {trendingTokens.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-primary" /> Trending Volume Leaders
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {trendingTokens.map((token, i) => {
                const accentColor = token.logoColor || "#22c55e";
                const isPositive = token.change24h >= 0;
                return (
                  <div
                    onClick={() => setLocation(`/token/${token.id}`)}
                    key={token.id}
                    className="relative overflow-hidden p-3.5 glass-panel border border-border/70 hover:border-primary/50 bg-card/40 hover:bg-card/75 transition-all duration-300 group flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-xs font-mono font-bold text-muted-foreground">#0{i+1}</div>
                      <TokenLogo token={token} size="sm" />
                      <div>
                        <div className="font-bold text-sm tracking-tight flex items-center gap-1.5 font-mono">
                          <span style={{ color: accentColor }} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.05)]">${token.ticker}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Vol: ${formatCompactNumber(token.volume24h)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs font-bold text-foreground/90">${formatPrice(token.price)}</div>
                      <div className={`font-mono text-[10px] font-bold ${isPositive ? "text-primary" : "text-destructive"}`}>
                        {isPositive ? "▲" : "▼"} {isPositive ? "+" : ""}{token.change24h.toFixed(2)}%
                      </div>
                    </div>
                    {/* Subtle Dynamic Bottom Accent Line */}
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] transition-all duration-300" style={{ backgroundColor: accentColor, opacity: 0.35 }} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* High-Tech Unified Control Bar */}
        <section className="glass-panel p-3 border border-border/80 bg-card/45 backdrop-blur-md">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            {/* Search + Import */}
            <div className="relative min-w-0 flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ticker, name, or contract address..."
                  className="h-10 pl-9 font-mono text-xs bg-background/40 border-border/60 text-foreground/90 placeholder:text-muted-foreground/50 w-full"
                />
              </div>
              <Button
                onClick={() => setImportModalOpen(true)}
                className="h-10 border border-primary/20 hover:border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold uppercase tracking-wider px-4 font-mono shrink-0"
              >
                Import Token
              </Button>
            </div>

            {/* Custom Tab Segment for Filters */}
            <div className="flex bg-secondary/25 p-1 rounded-md border border-border/30">
              {(["all", "watchlist"] as MarketFilter[]).map((filter) => (
                <Button
                  key={filter}
                  variant="ghost"
                  size="sm"
                  className={`h-8 font-mono text-[10px] uppercase transition-all duration-200 px-3.5 rounded ${
                    marketFilter === filter
                      ? "bg-background text-primary shadow-sm font-bold border border-border/10"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setMarketFilter(filter)}
                >
                  {filter.replace("-", " ")}
                </Button>
              ))}
            </div>

            {/* Market Intelligence Ranking Tabs */}
            <div className="flex bg-secondary/25 p-1 rounded-md border border-border/30 overflow-x-auto max-w-full">
              {(["trending", "newest", "mostActive", "volume", "topGainers"] as ListTokensSort[]).map((tab) => {
                const labels: Record<string, string> = {
                  trending: "Trending",
                  newest: "New",
                  mostActive: "Most Active",
                  volume: "Top Volume",
                  topGainers: "Top Gainers",
                };
                return (
                  <Button
                    key={tab}
                    variant="ghost"
                    size="sm"
                    className={`h-8 font-mono text-[10px] uppercase transition-all duration-200 px-3.5 rounded shrink-0 ${
                      sort === tab
                        ? "bg-background text-primary font-bold shadow-sm border border-border/10"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setSort(tab)}
                  >
                    {labels[tab]}
                  </Button>
                );
              })}
            </div>

            {/* Grid vs Table View Toggles */}
            <div className="flex items-center gap-1 rounded-md border border-border/50 bg-background/35 p-1">
              <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" className="h-7 w-7 rounded-[4px]" onClick={() => setViewMode("grid")}>
                <Grid3X3 className="h-3.5 w-3.5" />
              </Button>
              <Button variant={viewMode === "table" ? "default" : "ghost"} size="icon" className="h-7 w-7 rounded-[4px]" onClick={() => setViewMode("table")}>
                <Table2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Micro stats & search inputs */}
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input value={minVolume} onChange={(e) => setMinVolume(e.target.value)} placeholder="Min Volume Threshold ($)" type="number" className="h-9 bg-background/30 border-border/40 font-mono text-[11px]" />
            <Input value={minMarketCap} onChange={(e) => setMinMarketCap(e.target.value)} placeholder="Min Market Cap ($)" type="number" className="h-9 bg-background/30 border-border/40 font-mono text-[11px]" />
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono px-3 bg-secondary/15 rounded border border-border/30">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
              <span>{filteredTokens.length} active terminal markets matched</span>
            </div>
          </div>
        </section>

        {/* Dynamic Responsive Columns Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start w-full">
          
          {/* Main Discovery Columns */}
          <main className="min-w-0 space-y-4">
            <section className="glass-panel p-3.5 border border-border/80 bg-card/45 backdrop-blur-md">
              <div className="mb-3.5 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" /> Market Discovery Terminal
                  </h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Click any row or grid card to open the live trading terminal.</p>
                </div>
                <div className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-primary/25 bg-primary/10 text-primary uppercase font-bold tracking-wider">{viewMode} Mode</div>
              </div>

              {isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {[...Array(6)].map((_, index) => <div key={index} className="h-44 rounded-lg bg-card/40 animate-pulse border border-border/20" />)}
                </div>
              ) : tokensError ? (
                <div className="rounded-lg border border-border bg-card/40 p-8 text-center font-mono">
                  <div className="text-sm text-destructive mb-2 font-bold">Could not synchronize tokens feed.</div>
                  <Button variant="outline" size="sm" onClick={() => refetchTokens()} className="text-xs">Retry Feed Synchronizer</Button>
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/40 p-8 text-center font-mono">
                  <div className="text-sm text-muted-foreground">Zero indexed markets found matching current filters.</div>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {filteredTokens.map((token, index) => (
                    <TokenCard key={token.id} token={token} index={index} watched={watchlist.includes(token.id)} onToggleWatch={toggleWatch} />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto rounded border border-border/30 bg-background/20">
                  <table className="w-full min-w-[760px] border-separate border-spacing-y-1.5 text-sm p-1">
                    <thead className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                      <tr>
                        <th className="px-3 py-2 text-left">Token</th>
                        <th className="px-3 py-2 text-left">Spark</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">Change</th>
                        <th className="px-3 py-2 text-right">MCap</th>
                        <th className="px-3 py-2 text-right">Volume</th>
                        <th className="px-3 py-2 text-right">Buys/Sells</th>
                        <th className="px-3 py-2 text-right">Holders</th>
                        <th className="px-3 py-2 text-right">Age</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTokens.map((token) => {
                        const live = token.marketType === "amm_pool" && Boolean(token.pairAddress);
                        const buys = Math.ceil(token.txCount * 0.54);
                        const sells = Math.max(0, token.txCount - buys);
                        const totalTx = buys + sells;
                        const buyPercent = totalTx > 0 ? (buys / totalTx) * 100 : 50;
                        const sellPercent = 100 - buyPercent;
                        const ageHours = Math.max(0, Math.floor((Date.now() - new Date(token.createdAt).getTime()) / 3_600_000));
                        const accentColor = token.logoColor || "#22c55e";

                        return (
                          <tr
                            key={token.id}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest("button") || target.closest("a")) return;
                              setLocation(`/token/${token.id}`);
                            }}
                            className="group rounded-lg bg-card/35 transition-all duration-300 hover:bg-card/75 border border-border/20 cursor-pointer"
                          >
                            <td className="rounded-l-lg px-3 py-3 border-y border-l border-border/30">
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleWatch(token.id); }}
                                  className={watchlist.includes(token.id) ? "text-yellow-400" : "text-muted-foreground/60 hover:text-yellow-400 transition-colors"}
                                >
                                  <Star className="h-3.5 w-3.5" fill={watchlist.includes(token.id) ? "currentColor" : "none"} />
                                </button>
                                <div>
                                  <div className="font-bold font-mono" style={{ color: accentColor }}>${token.ticker}</div>
                                  <div className="font-mono text-[9px] text-muted-foreground/80 mt-0.5">{formatAddress(token.contractAddress ?? "")}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 border-y border-border/30">
                              <MiniSparkline token={token} accentColor={accentColor} />
                            </td>
                            <LivePriceCell price={token.price} />
                            <td className={`px-3 py-2 text-right font-mono font-bold border-y border-border/30 ${token.change24h >= 0 ? "text-primary" : "text-destructive"}`}>
                              {token.change24h >= 0 ? "▲ +" : "▼ "}{token.change24h.toFixed(2)}%
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-foreground/80 border-y border-border/30">
                              ${formatCompactNumber(token.marketCap)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-foreground/80 border-y border-border/30">
                              ${formatCompactNumber(token.volume24h)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono border-y border-border/30">
                              {/* Sleek Visual buy/sell ratio progress meter */}
                              <div className="flex flex-col items-end gap-1">
                                <div className="w-16 h-1.5 rounded-full bg-destructive/20 border border-border/20 flex overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${buyPercent}%` }} />
                                  <div className="h-full bg-destructive" style={{ width: `${sellPercent}%` }} />
                                </div>
                                <div className="font-mono text-[9px] text-muted-foreground">
                                  <span className="text-primary font-semibold">{buys}</span> / <span className="text-destructive font-semibold">{sells}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-foreground/75 border-y border-border/30">
                              {token.holders.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-muted-foreground border-y border-border/30">
                              {ageHours < 1 ? "<1h" : `${ageHours}h`}
                            </td>
                            <td className="rounded-r-lg px-3 py-2 text-right border-y border-r border-border/30">
                              <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full hover:bg-secondary/40">
                                <Link href={`/token/${token.id}`}><ArrowUpRight className="h-4 w-4" style={{ color: accentColor }} /></Link>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </main>

          {/* Right Column: Live Swap logs (Only desktop view) */}
          <aside className="hidden lg:block w-full">
            <TerminalActivityFeed />
          </aside>
        </div>
      </div>
      <ImportTokenModal open={importModalOpen} onOpenChange={setImportModalOpen} />
    </div>
  );
}

function StatBox({ label, value, icon, active = false }: { label: string; value: string; icon?: React.ReactNode; active?: boolean }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/45 p-3 flex items-start justify-between group hover:border-primary/30 transition-all duration-300">
      <div>
        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className={`mt-1 font-mono text-base font-bold ${active ? "text-primary drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]" : "text-foreground/90"}`}>{value}</div>
      </div>
      <div className="opacity-70 group-hover:opacity-100 transition-opacity duration-300 mt-0.5">
        {icon}
      </div>
    </div>
  );
}
