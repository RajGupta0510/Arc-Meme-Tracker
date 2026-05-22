import { Link } from "wouter";
import {
  getGetPlatformStatsQueryKey,
  getListTokensQueryKey,
  ListTokensSort,
  type Token,
  useGetPlatformStats,
  useListTokens,
} from "@workspace/api-client-react";
import { TokenCard } from "@/components/token-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAddress, formatCompactNumber } from "@/lib/utils";
import { Grid3X3, Search, SlidersHorizontal, Star, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ViewMode = "grid" | "table";
type MarketFilter = "all" | "live" | "needs-pool" | "watchlist";
type SortField = "marketCap" | "volume24h" | "age" | "holders" | "change24h" | "txCount";
type SortDirection = "asc" | "desc";
type AlertRule = {
  id: string;
  tokenId: string;
  ticker: string;
  metric: "price" | "marketCap";
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

function MiniSparkline({ token }: { token: Token }) {
  const seed = Array.from(token.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const points = Array.from({ length: 16 }, (_, index) => {
    const wave = Math.sin((seed + index * 19) / 12) * 10;
    const trend = token.marketType === "amm_pool" ? index * 0.8 : -index * 0.25;
    return 30 - wave - trend;
  });
  const path = points.map((y, index) => `${index === 0 ? "M" : "L"}${index * 8},${Math.max(6, Math.min(52, y))}`).join(" ");

  return (
    <svg viewBox="0 0 120 60" className="h-11 w-28 overflow-visible">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary drop-shadow-[0_0_6px_rgba(34,197,94,0.45)]" />
    </svg>
  );
}

export function HomePage() {
  const {
    data: stats,
    isError: statsError,
    refetch: refetchStats,
  } = useGetPlatformStats({ query: { queryKey: getGetPlatformStatsQueryKey(), refetchInterval: 15000 } });

  const [sort, setSort] = useState<ListTokensSort>(ListTokensSort.newest);
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
  const [alertMetric, setAlertMetric] = useState<AlertRule["metric"]>("price");
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

    return tokens.filter((token) => {
      const live = token.marketType === "amm_pool" && Boolean(token.pairAddress);
      if (marketFilter === "live" && !live) return false;
      if (marketFilter === "needs-pool" && live) return false;
      if (marketFilter === "watchlist" && !watchlist.includes(token.id)) return false;
      if (minVol > 0 && token.volume24h < minVol) return false;
      if (minCap > 0 && token.marketCap < minCap) return false;
      if (!search) return true;
      return `${token.ticker} ${token.name} ${token.contractAddress ?? ""}`.toLowerCase().includes(search);
    }).sort((a, b) => {
      const getValue = (token: Token) => {
        if (sortField === "age") return new Date(token.createdAt).getTime();
        return token[sortField] ?? 0;
      };
      const aValue = getValue(a);
      const bValue = getValue(b);
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [marketFilter, minMarketCap, minVolume, query, sortDirection, sortField, tokens, watchlist]);

  const triggeredAlerts = alerts.filter((alert) => {
    const token = tokens.find((item) => item.id === alert.tokenId);
    const current = alert.metric === "price" ? token?.price : token?.marketCap;
    return current !== undefined && current >= alert.target;
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
        new Notification(`ArcMeme alert: $${alert.ticker}`, {
          body: `${alert.metric === "price" ? "Price" : "Market cap"} reached ${alert.target}`,
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

        <section className="glass-panel overflow-hidden p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
                Arc Meme Intelligence Terminal
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Live Arc markets, ranked for action.</h1>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5 xl:min-w-[640px]">
              <StatBox label="Tokens" value={stats?.totalTokens?.toLocaleString() ?? "-"} />
              <StatBox label="24h Vol" value={`$${formatCompactNumber(stats?.totalVolume24h || 0)}`} active />
              <StatBox label="MCap" value={`$${formatCompactNumber(stats?.totalMarketCap || 0)}`} />
              <StatBox label="Watch" value={watchlist.length.toString()} />
              <StatBox label="Alerts" value={alerts.length.toString()} />
            </div>
          </div>
        </section>

        <section className="glass-panel p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ticker, name, or contract"
                className="h-10 pl-9 font-mono text-xs bg-background/50"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "live", "needs-pool", "watchlist"] as MarketFilter[]).map((filter) => (
                <Button
                  key={filter}
                  variant={marketFilter === filter ? "default" : "outline"}
                  size="sm"
                  className="h-9 font-mono text-[11px] uppercase"
                  onClick={() => setMarketFilter(filter)}
                >
                  {filter.replace("-", " ")}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.keys(sortLabels).map((item) => (
                <Button
                  key={item}
                  variant={sortField === item ? "default" : "outline"}
                  size="sm"
                  className="h-9 font-mono text-[11px] uppercase"
                  onClick={() => setSortField(item as SortField)}
                >
                  {sortLabels[item as SortField]}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-9 font-mono text-[11px] uppercase"
                onClick={() => setSortDirection((current) => current === "desc" ? "asc" : "desc")}
              >
                {sortDirection === "desc" ? "Desc" : "Asc"}
              </Button>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border bg-background/50 p-1">
              <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setViewMode("grid")}>
                <Grid3X3 className="h-3.5 w-3.5" />
              </Button>
              <Button variant={viewMode === "table" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setViewMode("table")}>
                <Table2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input value={minVolume} onChange={(e) => setMinVolume(e.target.value)} placeholder="Min volume" type="number" className="h-9 bg-background/40 font-mono text-xs" />
            <Input value={minMarketCap} onChange={(e) => setMinMarketCap(e.target.value)} placeholder="Min market cap" type="number" className="h-9 bg-background/40 font-mono text-xs" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono px-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              {filteredTokens.length} matches
            </div>
          </div>
        </section>

        <main className="min-w-0 space-y-4">
            <section className="glass-panel p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide">Market Discovery</h2>
                  <p className="text-xs text-muted-foreground">Live liquidity markets are shown by default. Enable other filters only when hunting fresh pools.</p>
                </div>
                <div className="font-mono text-xs text-primary">{viewMode.toUpperCase()}</div>
              </div>

              {isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {[...Array(6)].map((_, index) => <div key={index} className="h-44 rounded-lg bg-card/60 animate-pulse" />)}
                </div>
              ) : tokensError ? (
                <div className="rounded-lg border border-border bg-card/40 p-8 text-center">
                  <div className="font-mono text-sm text-destructive mb-2">Could not load tokens.</div>
                  <Button variant="outline" size="sm" onClick={() => refetchTokens()} className="font-mono text-xs">Retry Terminal</Button>
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/40 p-8 text-center">
                  <div className="font-mono text-sm text-muted-foreground">No tokens match these filters.</div>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {filteredTokens.map((token, index) => (
                    <TokenCard key={token.id} token={token} index={index} watched={watchlist.includes(token.id)} onToggleWatch={toggleWatch} />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                    <thead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      <tr>
                        <th className="px-3 text-left">Token</th>
                        <th className="px-3 text-left">Spark</th>
                        <th className="px-3 text-right">Price</th>
                        <th className="px-3 text-right">Change</th>
                        <th className="px-3 text-right">MCap</th>
                        <th className="px-3 text-right">Volume</th>
                        <th className="px-3 text-right">B/S</th>
                        <th className="px-3 text-right">Holders</th>
                        <th className="px-3 text-right">Age</th>
                        <th className="px-3 text-center">Status</th>
                        <th className="px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTokens.map((token) => {
                        const live = token.marketType === "amm_pool" && Boolean(token.pairAddress);
                        const buys = Math.ceil(token.txCount * 0.54);
                        const sells = Math.max(0, token.txCount - buys);
                        const ageHours = Math.max(0, Math.floor((Date.now() - new Date(token.createdAt).getTime()) / 3_600_000));
                        return (
                          <tr key={token.id} className="group rounded-lg bg-card/55 transition-colors hover:bg-card/90">
                            <td className="rounded-l-lg px-3 py-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => toggleWatch(token.id)} className={watchlist.includes(token.id) ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}>
                                  <Star className="h-4 w-4" fill={watchlist.includes(token.id) ? "currentColor" : "none"} />
                                </button>
                                <div>
                                  <div className="font-bold">${token.ticker}</div>
                                  <div className="font-mono text-[10px] text-muted-foreground">{formatAddress(token.contractAddress ?? "")}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3"><MiniSparkline token={token} /></td>
                            <td className="px-3 text-right font-mono">${token.price.toFixed(6)}</td>
                            <td className={`px-3 text-right font-mono ${token.change24h >= 0 ? "text-primary" : "text-destructive"}`}>{token.change24h >= 0 ? "+" : ""}{token.change24h.toFixed(2)}%</td>
                            <td className="px-3 text-right font-mono">${formatCompactNumber(token.marketCap)}</td>
                            <td className="px-3 text-right font-mono">${formatCompactNumber(token.volume24h)}</td>
                            <td className="px-3 text-right font-mono"><span className="text-primary">{buys}</span>/<span className="text-destructive">{sells}</span></td>
                            <td className="px-3 text-right font-mono">{token.holders.toLocaleString()}</td>
                            <td className="px-3 text-right font-mono">{ageHours < 1 ? "<1h" : `${ageHours}h`}</td>
                            <td className="px-3 text-center">
                              <span className={`rounded border px-2 py-1 font-mono text-[10px] uppercase ${live ? "border-primary/30 bg-primary/10 text-primary" : "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"}`}>
                                {live ? "Live" : "Needs Pool"}
                              </span>
                            </td>
                            <td className="rounded-r-lg px-3 text-right">
                              <Button asChild size="sm" variant="outline" className="h-8 font-mono text-[11px]">
                                <Link href={`/token/${token.id}`}>{live ? "Trade" : "Pool"}</Link>
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
            <section className="glass-panel p-3">
              <div className="grid gap-2 md:grid-cols-[1.2fr_0.8fr_0.9fr_auto]">
                <select value={alertTokenId} onChange={(event) => setAlertTokenId(event.target.value)} className="h-9 rounded-md border border-input bg-background/50 px-3 font-mono text-xs">
                  <option value="">First visible token</option>
                  {filteredTokens.map((token) => <option key={token.id} value={token.id}>${token.ticker}</option>)}
                </select>
                <select value={alertMetric} onChange={(event) => setAlertMetric(event.target.value as AlertRule["metric"])} className="h-9 rounded-md border border-input bg-background/50 px-3 font-mono text-xs">
                  <option value="price">Price target</option>
                  <option value="marketCap">Market cap target</option>
                </select>
                <Input value={alertDraft} onChange={(e) => setAlertDraft(e.target.value)} placeholder="Alert target" type="number" className="h-9 bg-background/50 font-mono text-xs" />
                <Button onClick={createAlert} size="sm" className="h-9 text-black">Arm Alert</Button>
              </div>
            </section>
        </main>
      </div>
    </div>
  );
}

function StatBox({ label, value, active = false }: { label: string; value: string; active?: boolean }) {
  return (
    <div className="rounded-lg border border-border/80 bg-background/45 p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${active ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
