import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetToken, getGetTokenQueryKey, useGetTokenTrades, getGetTokenTradesQueryKey, useGetTokenCandles, getGetTokenCandlesQueryKey, type Trade } from "@workspace/api-client-react";
import { TokenLogo } from "@/components/token-card";
import { formatCompactNumber, formatAddress, formatBalance, formatPrice } from "@/lib/utils";
import { MarketCandlestickChart, type MarketCandle } from "@/components/market-candlestick-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useTokenMarket } from "@/hooks/use-token-market";
import { useTokenTrade } from "@/hooks/use-token-trade";
import { useTokenLiquidity } from "@/hooks/use-token-liquidity";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Globe, 
  Twitter, 
  Send, 
  ExternalLink, 
  Copy, 
  Check, 
  Users, 
  Briefcase, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart, 
  Activity, 
  Wallet, 
  Lock, 
  ArrowUpRight, 
  MessageSquare,
  AlertCircle,
  Bell,
  Star
} from "lucide-react";
import { formatUnits, parseUnits } from "ethers";
import { calculateAmountIn, calculateAmountOut } from "@/lib/arc-amm";
import { Link } from "wouter";
import { useTokenSecurity } from "@/hooks/use-token-security";
import { CommentsSection } from "@/components/comments-section";
import { ShieldAlert, ShieldCheck, Flame, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAudioTelemetry } from "@/hooks/use-audio-telemetry";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";


const candleIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type CandleInterval = (typeof candleIntervals)[number];

type AlertRule = {
  id: string;
  tokenId: string;
  ticker: string;
  metric: "price_above" | "price_below" | "volume_spike" | "liquidity_change" | "whale_swap";
  target: number;
};

function GrowthUpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function GrowthDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  );
}

export function TokenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, refresh: refreshWallet } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const audio = useAudioTelemetry();

  // Watchlist & Alerts Management State
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("arcmeme.watchlist");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const isWatched = watchlist.includes(id!);

  const toggleWatchlist = () => {
    let next: string[];
    if (isWatched) {
      next = watchlist.filter((item) => item !== id);
      toast({
        title: "⭐️ WATCHLIST REMOVED",
        description: `$${token?.ticker || "Token"} removed from watchlist.`,
      });
    } else {
      next = [...watchlist, id!];
      toast({
        title: "⭐️ WATCHLIST ADDED",
        description: `$${token?.ticker || "Token"} added to watchlist successfully.`,
      });
    }
    setWatchlist(next);
    localStorage.setItem("arcmeme.watchlist", JSON.stringify(next));
  };

  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertMetric, setAlertMetric] = useState<AlertRule["metric"]>("price_above");
  const [alertTargetValue, setAlertTargetValue] = useState("");
  const [alerts, setAlerts] = useState<AlertRule[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("arcmeme.alerts");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const handleCreateAlert = () => {
    const target = Number(alertTargetValue);
    if (!token || !Number.isFinite(target) || target <= 0) {
      toast({
        title: "Invalid Target",
        description: "Please specify a positive numerical target value.",
        variant: "destructive",
      });
      return;
    }

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }

    const newAlert: AlertRule = {
      id: `${token.id}-${Date.now()}`,
      tokenId: token.id,
      ticker: token.ticker,
      metric: alertMetric,
      target,
    };

    const updated = [newAlert, ...alerts].slice(0, 8);
    setAlerts(updated);
    localStorage.setItem("arcmeme.alerts", JSON.stringify(updated));
    setAlertTargetValue("");
    setAlertModalOpen(false);

    toast({
      title: "🔔 PRICE ALERT ARMED",
      description: `Target set at $${target.toLocaleString()} for $${token.ticker}`,
    });
  };

  const { data: token, isLoading: tokenLoading, isError: tokenError, refetch: refetchToken } = useGetToken(id!, {
    query: { enabled: !!id, queryKey: getGetTokenQueryKey(id!) },
  });

  const walletAddress = state.status === "connected" ? state.address : undefined;
  const market = useTokenMarket(token, walletAddress);
  const trade = useTokenTrade();
  const liquidity = useTokenLiquidity();

  const isOld = state.status === "connected" && state.chainId.toLowerCase() === "0x4e454153";
  const nativeDecimals = isOld ? 6 : 18;

  const accentColor = token?.logoColor || "#22c55e";

  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const [lastPrice, setLastPrice] = useState<number>(0);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"price" | "mcap">("price");

  const currentPrice = market?.price ?? token?.price ?? 0;

  useEffect(() => {
    if (!currentPrice) return;
    if (lastPrice > 0 && currentPrice !== lastPrice) {
      if (currentPrice > lastPrice) {
        setPriceFlash("up");
      } else if (currentPrice < lastPrice) {
        setPriceFlash("down");
      }
      audio.playTickerClick();
    }
    setLastPrice(currentPrice);
    const timer = setTimeout(() => setPriceFlash(null), 1000);
    return () => clearTimeout(timer);
  }, [currentPrice, lastPrice, audio]);

  const { data: trades = [], isLoading: tradesLoading, isError: tradesError } = useGetTokenTrades(id!, {
    query: {
      queryKey: getGetTokenTradesQueryKey(id!),
      enabled: !!id,
      refetchInterval: token?.marketType === "amm_pool" ? 15000 : false,
    },
  });

  const [candleInterval, setCandleInterval] = useState<CandleInterval>("1m");
  const {
    data: candles = [],
    isLoading: candlesLoading,
    isError: candlesError,
  } = useGetTokenCandles(
    id!,
    { interval: candleInterval },
    {
      query: {
        queryKey: getGetTokenCandlesQueryKey(id!, { interval: candleInterval }),
        enabled: !!id,
        refetchInterval: token?.marketType === "amm_pool" ? 15000 : false,
      },
    }
  );

  const [tradeTab, setTradeTab] = useState<"buy" | "sell">("buy");
  const [tradeInputAmount, setTradeInputAmount] = useState("");
  const [tradeOutputAmount, setTradeOutputAmount] = useState("");
  const [liquidityTab, setLiquidityTab] = useState<"add" | "withdraw">("add");
  const [liquidityTokenAmount, setLiquidityTokenAmount] = useState("");
  const [liquidityUsdcAmount, setLiquidityUsdcAmount] = useState("");
  const [liquidityLpAmount, setLiquidityLpAmount] = useState("");
  const [activeTerminalTab, setActiveTerminalTab] = useState<"txs" | "traders" | "holders" | "lps">("txs");
  const [mainDetailTab, setMainDetailTab] = useState<"ledger" | "security" | "discussion">("ledger");
  const [isMobileTradeOpen, setIsMobileTradeOpen] = useState(false);

  // Sentiment & Hype Boost states
  const [hypeScore, setHypeScore] = useState(token?.hypeScore ?? 0);
  const [showHypePulse, setShowHypePulse] = useState(false);

  useEffect(() => {
    if (token) setHypeScore(token.hypeScore ?? 0);
  }, [token]);

  const handleHypeBoost = async () => {
    if (!token) return;
    setShowHypePulse(true);
    setTimeout(() => setShowHypePulse(false), 800);
    
    audio.playHypeSound();

    setHypeScore((prev) => prev + 1);

    try {
      await fetch(`/api/tokens/${encodeURIComponent(token.id)}/hype`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ points: 1 }),
      });
      toast({
        title: "🔥 HYPE BOOST MIRRORED",
        description: "Community energy multiplier increased!",
      });
    } catch {
      // fallback
    }
  };

  // AI Sentiment & Audit state
  const [aiSentiment, setAiSentiment] = useState<{
    buzzScore: number;
    hypeStatus: string;
    sentimentSummary: string;
    mentionsCount: number;
  } | null>(null);

  const [aiAuditResult, setAiAuditResult] = useState<{
    safetyScore: number;
    verdict: "danger" | "warning" | "safe";
    summary: string;
    auditLogs: string[];
    satiricalWarning: string;
    creatorConcentration: number;
  } | null>(null);

  const [isAuditing, setIsAuditing] = useState(false);

  const fetchSentiment = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/tokens/${encodeURIComponent(id)}/sentiment`);
      if (res.ok) {
        const data = await res.json();
        setAiSentiment(data);
      }
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    fetchSentiment();
  }, [fetchSentiment, hypeScore, trades.length]);

  const runAiAudit = async () => {
    if (!id) return;
    setIsAuditing(true);
    setAiAuditResult(null);
    audio.playTickerClick();
    
    // Simulate high-tech decompiler scans with local tick steps
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const res = await fetch(`/api/tokens/${encodeURIComponent(id)}/ai-audit`);
      if (res.ok) {
        const data = await res.json();
        setAiAuditResult(data);
        if (data.verdict === "danger" || data.verdict === "warning") {
          audio.playAlarmSound();
        } else {
          audio.playHypeSound();
        }
      }
    } catch {
      // ignore
    } finally {
      setIsAuditing(false);
    }
  };

  const [votes, setVotes] = useState(() => {
    const key = `arcmeme.votes.${id}`;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : { bull: 42, bear: 18 };
      } catch {
        return { bull: 42, bear: 18 };
      }
    }
    return { bull: 42, bear: 18 };
  });

  const castVote = (type: "bull" | "bear") => {
    const updated = {
      ...votes,
      [type]: votes[type] + 1,
    };
    setVotes(updated);
    localStorage.setItem(`arcmeme.votes.${id}`, JSON.stringify(updated));
    toast({
      title: type === "bull" ? "📈 PUMP UP SENTIMENT CAST" : "📉 PUMP DOWN SENTIMENT CAST",
      description: "Your vote has been broadcast to the pool moodboard.",
    });
  };

  const totalVotes = votes.bull + votes.bear;
  const bullPct = totalVotes > 0 ? (votes.bull / totalVotes) * 100 : 50;
  const bearPct = 100 - bullPct;

  const [notifiedWhaleSwaps, setNotifiedWhaleSwaps] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("arcmeme.notifiedWhaleSwaps");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("arcmeme.notifiedWhaleSwaps", JSON.stringify(notifiedWhaleSwaps));
    }
  }, [notifiedWhaleSwaps]);

  useEffect(() => {
    if (!id || !token || trades.length === 0) return;

    let alerts: AlertRule[] = [];
    try {
      const raw = window.localStorage.getItem("arcmeme.alerts");
      if (raw) {
        alerts = JSON.parse(raw);
      }
    } catch {
      // ignore
    }

    const whaleAlerts = alerts.filter(
      (alert) => alert.tokenId === id && alert.metric === "whale_swap"
    );

    if (whaleAlerts.length === 0) return;

    const newNotified: string[] = [];
    let hasNewTriggers = false;

    trades.forEach((tradeItem) => {
      if (notifiedWhaleSwaps.includes(tradeItem.id)) return;

      const matchingAlert = whaleAlerts.find((alert) => tradeItem.wusdcAmount >= alert.target);

      if (matchingAlert) {
        hasNewTriggers = true;
        newNotified.push(tradeItem.id);

        toast({
          title: `WHALE SWAP DETECTED: $${token.ticker}`,
          description: `${tradeItem.side.toUpperCase()} of ${formatBalance(tradeItem.tokenAmount)} tokens for $${tradeItem.wusdcAmount.toLocaleString()}`,
        });

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`WHALE SWAP DETECTED: $${token.ticker}`, {
            body: `${tradeItem.side.toUpperCase()} of ${formatBalance(tradeItem.tokenAmount)} tokens for $${tradeItem.wusdcAmount.toLocaleString()}`,
          });
        }

        try {
          const rawNotified = window.localStorage.getItem("arcmeme.notifiedAlerts");
          const currentNotified = rawNotified ? JSON.parse(rawNotified) : [];
          if (!currentNotified.includes(matchingAlert.id)) {
            currentNotified.push(matchingAlert.id);
            window.localStorage.setItem("arcmeme.notifiedAlerts", JSON.stringify(currentNotified));
          }
        } catch {
          // ignore
        }
      }
    });

    if (hasNewTriggers) {
      setNotifiedWhaleSwaps((prev) => [...prev, ...newNotified]);
    }
  }, [id, token, trades, notifiedWhaleSwaps, toast]);

  const usdcBalance =
    state.status === "connected" && state.isArcTestnet
      ? formatBalance(state.usdcBalance)
      : state.status === "connected"
      ? "—"
      : null;
  const numericUsdcBalance =
    usdcBalance !== null && Number.isFinite(Number(usdcBalance)) ? Number(usdcBalance) : null;

  const displayPrice = market.price ?? token?.price ?? 0;
  const poolUsdcReserve = market.reserves
    ? formatBalance(formatUnits(market.reserves.quoteReserve, nativeDecimals))
    : null;
  const poolTokenReserve = market.reserves
    ? formatBalance(formatUnits(market.reserves.baseReserve, market.tokenDecimals))
    : null;

  // ─── Local Calculations Engine ──────────────────────────────────────────
  const computedStats = useMemo(() => {
    const t = token;
    if (!t || !trades) return { transactions: [], traders: [], holders: [], lps: [] };

    // 1. Transactions: Sorted chronologically by newest
    const transactions = [...trades].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 2. Traders Analytics
    const traderMap: Record<string, { address: string; boughtVal: number; soldVal: number; tokens: number }> = {};
    trades.forEach((tradeItem) => {
      const addr = tradeItem.traderAddress;
      if (!traderMap[addr]) {
        traderMap[addr] = { address: addr, boughtVal: 0, soldVal: 0, tokens: 0 };
      }
      const val = Number(tradeItem.wusdcAmount);
      const amount = Number(tradeItem.tokenAmount);
      if (tradeItem.side === "buy") {
        traderMap[addr].boughtVal += val;
        traderMap[addr].tokens += amount;
      } else {
        traderMap[addr].soldVal += val;
        traderMap[addr].tokens -= amount;
      }
    });

    const traders = Object.values(traderMap)
      .map((trader) => {
        const balance = Math.max(0, trader.tokens);
        const currentVal = balance * displayPrice;
        const pnl = trader.soldVal + currentVal - trader.boughtVal;
        return {
          ...trader,
          balance,
          currentVal,
          pnl,
        };
      })
      .sort((a, b) => b.pnl - a.pnl);

    // 3. Holder Distribution (Aggregate Swaps + Creator initial balance + AMM Liquidity reserves)
    const holderMap: Record<string, { address: string; balance: number }> = {};
    let totalTradedOut = 0;

    Object.values(traderMap).forEach((trader) => {
      if (trader.tokens > 0) {
        holderMap[trader.address] = { address: trader.address, balance: trader.tokens };
        totalTradedOut += trader.tokens;
      }
    });

    const baseReserve = market.reserves ? Number(formatUnits(market.reserves.baseReserve, market.tokenDecimals)) : 0;
    
    // Add AMM Pool
    if (t.pairAddress && baseReserve > 0) {
      holderMap[t.pairAddress] = { address: t.pairAddress, balance: baseReserve };
    }

    // Creator gets initial supply minus pool deposited and trader acquired portions
    const creatorBalance = Math.max(0, t.totalSupply - totalTradedOut - baseReserve);
    if (creatorBalance > 0) {
      holderMap[t.creatorAddress] = { address: t.creatorAddress, balance: creatorBalance };
    }

    const holders = Object.values(holderMap)
      .map((holder) => {
        const pct = t.totalSupply > 0 ? (holder.balance / t.totalSupply) * 100 : 0;
        return {
          ...holder,
          pct,
        };
      })
      .sort((a, b) => b.balance - a.balance);

    // 4. LP Distribution
    const lps = [];
    const userLp = Number(market.lpBalance) || 0;
    const poolValue = poolUsdcReserve ? Number(poolUsdcReserve) * 2 : 0;

    if (t.pairAddress) {
      if (userLp > 0) {
        lps.push({
          address: walletAddress || "Connected User",
          balance: userLp,
          share: 15.0,
          value: 0.15 * poolValue,
          isUser: true,
        });
        const creatorLp = (userLp * 85) / 15;
        lps.push({
          address: t.creatorAddress,
          balance: creatorLp,
          share: 85.0,
          value: 0.85 * poolValue,
          isCreator: true,
        });
      } else {
        lps.push({
          address: t.creatorAddress,
          balance: 10.0,
          share: 100.0,
          value: poolValue,
          isCreator: true,
        });
      }
    }

    return {
      transactions,
      traders,
      holders,
      lps,
    };
  }, [token, trades, displayPrice, market.reserves, token?.pairAddress, token?.totalSupply, walletAddress, market.lpBalance, poolUsdcReserve]);

  const securityAudit = useTokenSecurity(
    token,
    computedStats.holders,
    poolUsdcReserve !== null ? Number(poolUsdcReserve) : null
  );

  useEffect(() => {
    if (securityAudit.status === "High Risk" || securityAudit.status === "Dangerous") {
      audio.playAlarmSound();
    }
  }, [securityAudit.status, audio]);

  const copyToClipboard = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    toast({ title: "Address Copied", description: "Copied successfully to clipboard." });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const renderTradeTerminal = () => {
    if (!token) return null;
    return (
      <div className="space-y-4 font-mono text-xs">
        {/* Buy / Sell selector tabs */}
        <div className="flex bg-secondary/35 p-1 rounded-lg border border-border/40">
          <Button
            variant="ghost"
            onClick={() => {
              setTradeTab("buy");
              setTradeInputAmount("");
              setTradeOutputAmount("");
              trade.reset();
            }}
            className={`flex-1 h-8 text-[11px] uppercase font-bold transition-all ${
              tradeTab === "buy"
                ? "bg-primary text-black hover:bg-primary shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Buy
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setTradeTab("sell");
              setTradeInputAmount("");
              setTradeOutputAmount("");
              trade.reset();
            }}
            className={`flex-1 h-8 text-[11px] uppercase font-bold transition-all ${
              tradeTab === "sell"
                ? "bg-destructive text-white hover:bg-destructive shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sell
          </Button>
        </div>

        {/* Balances details */}
        <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground/80">
          <span>ACTIVE ASSET</span>
          <span className="flex items-center gap-1.5">
            Balance:{" "}
            <span className="text-foreground font-bold font-mono">
              {activeBalance !== null ? `${tradeTab === "buy" ? "$" : ""}${activeBalance}` : "—"}
            </span>
          </span>
        </div>

        {/* Payload Input */}
        <div className="space-y-3.5">
          <div className="relative">
            <Input
              type="number"
              placeholder="0.00"
              value={tradeInputAmount}
              onChange={(e) => handleInputAmountChange(e.target.value)}
              className="font-mono text-sm bg-background/50 h-11 border-border/60 focus-visible:ring-primary/45 pr-20"
            />
            <span className="absolute right-3 top-3.5 text-[10px] font-bold text-muted-foreground tracking-wide">
              {tradeTab === "buy" ? "USDC" : token.ticker}
            </span>
          </div>

          {/* Quick filling percent tabs */}
          {activeBalance !== null && activeBalance !== "—" && (
            <div className="grid grid-cols-4 gap-1.5">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    if (numericActiveBalance !== null) {
                      handleInputAmountChange(formatBalance((numericActiveBalance * pct) / 100));
                    }
                  }}
                  className="py-1 text-[9px] font-bold border border-border/70 rounded hover:border-primary/50 text-muted-foreground hover:text-primary transition-all uppercase"
                >
                  {pct === 100 ? "MAX" : `${pct}%`}
                </button>
              ))}
            </div>
          )}

          {/* Direct Instant trade executions */}
          {state.status === "connected" && state.isArcTestnet && market.isTradeable && market.reserves && (
            <div className="space-y-1.5 pt-3.5 border-t border-border/30">
              <div className="flex justify-between text-[9px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1.5">
                <span>One-Click Instant Execution</span>
                <span>Direct Swap</span>
              </div>
              {tradeTab === "buy" ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {[10, 50, 100, 250].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      disabled={isTradingPending}
                      onClick={() => executeDirectTrade("buy", amt.toString())}
                      className="py-1.5 text-[10px] font-bold border border-primary/25 text-primary hover:bg-primary/8 rounded hover:border-primary/55 transition-all"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {[25, 50, 100].map((pct) => {
                    const rawBalanceStr = market.tokenBalance.replace(/,/g, "");
                    const tokenBal = Number(rawBalanceStr) || 0;
                    const amt = ((tokenBal * pct) / 100).toFixed(Math.min(market.tokenDecimals, 6));
                    return (
                      <button
                        key={pct}
                        type="button"
                        disabled={isTradingPending || tokenBal <= 0}
                        onClick={() => executeDirectTrade("sell", amt)}
                        className="py-1.5 text-[10px] font-bold border border-destructive/25 text-destructive hover:bg-destructive/8 rounded hover:border-destructive/55 transition-all"
                      >
                        {pct === 100 ? "MAX" : `${pct}%`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-muted-foreground/60">ESTIMATED OUTCOME</span>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00"
                value={tradeOutputAmount}
                onChange={(e) => handleOutputAmountChange(e.target.value)}
                className="font-mono text-sm bg-background/50 h-11 border-border/60 focus-visible:ring-primary/45 pr-20"
              />
              <span className="absolute right-3 top-3.5 text-[10px] font-bold text-muted-foreground tracking-wide">
                {tradeTab === "buy" ? token.ticker : "USDC"}
              </span>
            </div>
          </div>
        </div>

        {/* Error alerts or transaction notifications */}
        {trade.status.status === "error" && (
          <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-[11px] text-destructive leading-relaxed flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{trade.status.message}</span>
          </div>
        )}
        {trade.status.status === "success" && (
          <a
            href={`https://testnet.arcscan.app/tx/${trade.status.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] text-primary hover:underline font-semibold leading-relaxed"
          >
            Swap confirmed. Click to view Txn on ArcScan.
          </a>
        )}

        {/* Action buttons */}
        {state.status !== "connected" ? (
          <div className="text-center text-[10px] text-muted-foreground font-semibold py-2.5 border border-border/50 rounded-lg bg-secondary/20 uppercase tracking-wider">
            Connect Wallet to Trade
          </div>
        ) : !state.isArcTestnet ? (
          <div className="text-center text-[10px] text-yellow-400 font-semibold py-2.5 border border-yellow-500/30 rounded-lg bg-yellow-500/10 uppercase tracking-wider">
            Switch network to execute trades
          </div>
        ) : !market.isTradeable ? (
          <div className="text-center text-[10px] text-yellow-400 font-semibold py-2.5 border border-yellow-500/30 rounded-lg bg-yellow-500/10 uppercase tracking-wider">
            Liquidity pool required before swapping
          </div>
        ) : (
          <Button
            className={`w-full font-extrabold uppercase tracking-widest h-12 text-black ${
              tradeTab === "buy" 
                ? "bg-primary hover:bg-primary/90" 
                : "bg-destructive hover:bg-destructive/90 text-white"
            }`}
            size="lg"
            disabled={!canTrade}
            onClick={handleTrade}
          >
            {isTradingPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Executing...
              </span>
            ) : (
              `${tradeTab === "buy" ? "Buy" : "Sell"} ${token.ticker}`
            )}
          </Button>
        )}
      </div>
    );
  };



  const isPositive = token ? token.change24h >= 0 : false;
  const isTradingPending =
    trade.status.status === "quoting" ||
    trade.status.status === "approving" ||
    trade.status.status === "confirming";
  const activeBalance = tradeTab === "buy" ? usdcBalance : market.tokenBalance;
  const numericActiveBalance =
    activeBalance !== null && Number.isFinite(Number(activeBalance)) ? Number(activeBalance) : null;
  const numericLpBalance = Number.isFinite(Number(market.lpBalance)) ? Number(market.lpBalance) : 0;
  const canTrade =
    state.status === "connected" &&
    state.isArcTestnet &&
    market.isTradeable &&
    market.reserves !== null &&
    Number(tradeInputAmount) > 0 &&
    !isTradingPending;
  const isLiquidityPending =
    liquidity.status.status === "detecting-pair" ||
    liquidity.status.status === "wrapping-usdc" ||
    liquidity.status.status === "approving" ||
    liquidity.status.status === "adding" ||
    liquidity.status.status === "withdrawing" ||
    liquidity.status.status === "saving-market";
  const canAddLiquidity =
    state.status === "connected" &&
    state.isArcTestnet &&
    Boolean(token?.contractAddress) &&
    Number(liquidityTokenAmount) > 0 &&
    Number(liquidityUsdcAmount) > 0 &&
    !isLiquidityPending;
  const canWithdrawLiquidity =
    state.status === "connected" &&
    state.isArcTestnet &&
    market.isTradeable &&
    Number(liquidityLpAmount) > 0 &&
    Number(liquidityLpAmount) <= numericLpBalance &&
    !isLiquidityPending;
  const liquidityStepLabel =
    liquidity.status.status === "detecting-pair" ? "Detecting pair..." :
    liquidity.status.status === "wrapping-usdc" ? "Wrapping USDC..." :
    liquidity.status.status === "approving" ? "Approving..." :
    liquidity.status.status === "adding" ? "Adding liquidity..." :
    liquidity.status.status === "withdrawing" ? "Withdrawing liquidity..." :
    liquidity.status.status === "saving-market" ? "Saving market..." :
    liquidityTab === "add" ? "Add Liquidity" : "Withdraw Liquidity";

  const formatSwapAmount = (value: bigint, decimals: number) => {
    const number = Number(formatUnits(value, decimals));
    if (!Number.isFinite(number) || number <= 0) return "";
    if (number < 0.001) return number.toPrecision(4);
    return formatBalance(number);
  };

  const quoteFromInput = (amount: string) => {
    if (!market.reserves || !amount || Number(amount) <= 0) return "";
    try {
      if (tradeTab === "buy") {
        const amountIn = parseUnits(amount, nativeDecimals);
        const amountOut = calculateAmountOut(amountIn, market.reserves.quoteReserve, market.reserves.baseReserve);
        return formatSwapAmount(amountOut, market.tokenDecimals);
      }

      const amountIn = parseUnits(amount, market.tokenDecimals);
      const amountOut = calculateAmountOut(amountIn, market.reserves.baseReserve, market.reserves.quoteReserve);
      return formatSwapAmount(amountOut, nativeDecimals);
    } catch {
      return "";
    }
  };

  useEffect(() => {
    const handlePrepare = (e: Event) => {
      const customEvent = e as CustomEvent<{ side: "buy" | "sell"; amount: string }>;
      if (customEvent.detail) {
        setTradeTab(customEvent.detail.side);
        setTradeInputAmount(customEvent.detail.amount);
        setTradeOutputAmount(quoteFromInput(customEvent.detail.amount));
        
        const consoleEl = document.getElementById("trade-console");
        if (consoleEl) {
          consoleEl.scrollIntoView({ behavior: "smooth" });
        }
      }
    };
    window.addEventListener("prepare-trade", handlePrepare);
    return () => window.removeEventListener("prepare-trade", handlePrepare);
  }, [quoteFromInput]);

  const inputFromOutput = (amount: string) => {
    if (!market.reserves || !amount || Number(amount) <= 0) return "";
    try {
      if (tradeTab === "buy") {
        const amountOut = parseUnits(amount, market.tokenDecimals);
        const amountIn = calculateAmountIn(amountOut, market.reserves.quoteReserve, market.reserves.baseReserve);
        return formatSwapAmount(amountIn, nativeDecimals);
      }

      const amountOut = parseUnits(amount, nativeDecimals);
      const amountIn = calculateAmountIn(amountOut, market.reserves.baseReserve, market.reserves.quoteReserve);
      return formatSwapAmount(amountIn, market.tokenDecimals);
    } catch {
      return "";
    }
  };

  const quoteLiquidityAmount = (amount: string, inputType: "token" | "usdc") => {
    if (!market.reserves || !amount || Number(amount) <= 0) return "";
    try {
      const baseReserve = market.reserves.baseReserve;
      const quoteReserve = market.reserves.quoteReserve;
      if (baseReserve === 0n || quoteReserve === 0n) return "";

      if (inputType === "token") {
        const tokenVal = parseUnits(amount, market.tokenDecimals);
        const wusdcVal = (tokenVal * quoteReserve) / baseReserve;
        const formatted = formatUnits(wusdcVal, 18);
        let clean = formatted;
        if (clean.includes(".")) {
          clean = clean.replace(/0+$/, "");
          if (clean.endsWith(".")) {
            clean = clean.slice(0, -1);
          }
        }
        return clean;
      } else {
        const wusdcVal = parseUnits(amount, 18);
        const tokenVal = (wusdcVal * baseReserve) / quoteReserve;
        const formatted = formatUnits(tokenVal, market.tokenDecimals);
        let clean = formatted;
        if (clean.includes(".")) {
          clean = clean.replace(/0+$/, "");
          if (clean.endsWith(".")) {
            clean = clean.slice(0, -1);
          }
        }
        return clean;
      }
    } catch {
      return "";
    }
  };

  const handleInputAmountChange = (amount: string) => {
    setTradeInputAmount(amount);
    setTradeOutputAmount(quoteFromInput(amount));
    trade.reset();
  };

  const handleOutputAmountChange = (amount: string) => {
    setTradeOutputAmount(amount);
    setTradeInputAmount(inputFromOutput(amount));
    trade.reset();
  };

  const handleTrade = async () => {
    if (!market.reserves) return;
    const amountStr = tradeInputAmount;

    const txHash = await trade.executeTrade({
      token: token!,
      side: tradeTab,
      amount: tradeInputAmount,
      reserves: market.reserves,
      tokenDecimals: market.tokenDecimals,
      amm: market.amm,
      nativeDecimals,
    });

    if (!txHash) return;
    
    if (tradeTab === "buy") {
      audio.playBuySound(Number(amountStr));
    } else {
      audio.playSellSound(Number(amountStr));
    }

    setTradeInputAmount("");
    setTradeOutputAmount("");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetTokenTradesQueryKey(id!) }),
      queryClient.invalidateQueries({ queryKey: getGetTokenCandlesQueryKey(id!) }),
    ]);
    await Promise.all([market.refresh(), refreshWallet()]);
  };

  const executeDirectTrade = async (side: "buy" | "sell", amountStr: string) => {
    if (!market.reserves || Number(amountStr) <= 0) return;

    const txHash = await trade.executeTrade({
      token: token!,
      side: side,
      amount: amountStr,
      reserves: market.reserves,
      tokenDecimals: market.tokenDecimals,
      amm: market.amm,
      nativeDecimals,
    });

    if (!txHash) return;

    if (side === "buy") {
      audio.playBuySound(Number(amountStr));
    } else {
      audio.playSellSound(Number(amountStr));
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetTokenTradesQueryKey(id!) }),
      queryClient.invalidateQueries({ queryKey: getGetTokenCandlesQueryKey(id!) }),
    ]);
    await Promise.all([refetchToken(), market.refresh(), refreshWallet()]);
  };

  const handleAddLiquidity = async () => {
    const result = await liquidity.addLiquidity({
      token: token!,
      tokenAmount: liquidityTokenAmount,
      wusdcAmount: liquidityUsdcAmount,
    });

    if (!result) return;
    setLiquidityTokenAmount("");
    setLiquidityUsdcAmount("");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetTokenQueryKey(id!) }),
      queryClient.invalidateQueries({ queryKey: getGetTokenCandlesQueryKey(id!) }),
      queryClient.invalidateQueries({ queryKey: getGetTokenTradesQueryKey(id!) }),
    ]);
    await Promise.all([refetchToken(), market.refresh(), refreshWallet()]);
  };

  const handleWithdrawLiquidity = async () => {
    const result = await liquidity.withdrawLiquidity({
      token: token!,
      lpTokenAmount: liquidityLpAmount,
    });

    if (!result) return;
    setLiquidityLpAmount("");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetTokenCandlesQueryKey(id!) }),
      queryClient.invalidateQueries({ queryKey: getGetTokenTradesQueryKey(id!) }),
      market.refresh(),
      refreshWallet(),
    ]);
  };

  // Convert candle structure to the exact chart requirements
  const formattedCandles = useMemo(() => {
    if (chartView === "price" || !token) return candles;
    // For Market Cap view: multiply all price parameters by total supply
    return candles.map((c) => ({
      ...c,
      open: c.open * token.totalSupply,
      high: c.high * token.totalSupply,
      low: c.low * token.totalSupply,
      close: c.close * token.totalSupply,
    }));
  }, [candles, chartView, token?.totalSupply]);

  // Calculate expected LP Share % before confirmation
  const expectedLpShare = useMemo(() => {
    if (liquidityTab !== "add" || !liquidityUsdcAmount || Number(liquidityUsdcAmount) <= 0) return null;
    const addedUsdc = Number(liquidityUsdcAmount);
    const existingUsdc = poolUsdcReserve ? Number(poolUsdcReserve) : 0;
    if (existingUsdc === 0) return 100;
    return (addedUsdc / (existingUsdc + addedUsdc)) * 100;
  }, [liquidityTab, liquidityUsdcAmount, poolUsdcReserve]);

  if (tokenLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="font-mono text-sm text-destructive mb-3">Could not load token data.</div>
        <Button variant="outline" size="sm" onClick={() => refetchToken()} className="font-mono text-xs">
          Retry
        </Button>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="p-8 text-center text-muted-foreground font-mono">
        Token not found in registries.
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] mx-auto w-full p-4 md:p-6 flex flex-col lg:flex-row gap-6 pb-20 font-sans">
      
      {/* ─── LEFT COLUMN: Market Charts, Stats Strip, & Ledgers ─── */}
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        
        {/* Horizontal Header & Stats Strip */}
        <div className="flex flex-col gap-3">
          
          {/* Main Info Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <TokenLogo token={token} size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold uppercase tracking-tight">
                    {token.ticker} / USDC
                  </h1>
                  <span className="text-[10px] font-mono font-bold bg-secondary/80 text-muted-foreground px-2 py-0.5 rounded border border-border/40 uppercase">
                    Arc Testnet
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-semibold mt-0.5">{token.name}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <div
                  className={`text-2xl font-mono font-extrabold transition-all duration-300 ${
                    priceFlash === "up"
                      ? "text-primary scale-105 drop-shadow-[0_0_12px_rgba(34,197,94,0.5)]"
                      : priceFlash === "down"
                      ? "text-destructive scale-105 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                      : "text-foreground"
                  }`}
                >
                  ${formatPrice(displayPrice)}
                </div>
                <div className="flex items-center gap-1.5 justify-end font-mono text-xs font-bold mt-0.5">
                  <span className={isPositive ? "text-primary" : "text-destructive"}>
                    {isPositive ? "▲" : "▼"} {isPositive ? "+" : ""}{token.change24h.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Security alert banner */}
          {securityAudit.status !== "Secure" && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 font-mono text-xs text-destructive flex items-start gap-3 shadow-[0_0_24px_rgba(239,68,68,0.08)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-destructive/5 rounded-full blur-xl pointer-events-none" />
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 animate-pulse text-destructive" />
              <div className="space-y-1">
                <div className="font-extrabold uppercase tracking-wider">⚠️ SEC SECURITY PROTOCOL CRITICAL WARNING</div>
                <p className="opacity-90 leading-relaxed text-[11px]">
                  Heuristics scanned extreme concentration or low reserves. Creator owns {securityAudit.checks.creatorOwnership.value} of supply. LP reserves might be unlocked. Exercise high caution.
                </p>
              </div>
            </div>
          )}

          {/* Stats strip */}
          <div className="w-full grid grid-cols-2 md:grid-cols-6 gap-2 bg-card/40 border border-border/80 rounded-xl p-3.5 backdrop-blur-md font-mono text-xs shadow-sm">
            <StatStripBox label="Price USD" value={`$${formatPrice(displayPrice)}`} highlight />
            <StatStripBox label="Liquidity" value={poolUsdcReserve ? `$${formatCompactNumber(Number(poolUsdcReserve) * 2)}` : "$0"} />
            <StatStripBox label="Market Cap" value={`$${formatCompactNumber(token.marketCap)}`} />
            <StatStripBox label="24h Volume" value={`$${formatCompactNumber(token.volume24h)}`} />
            <StatStripBox label="24h Change" value={`${isPositive ? "+" : ""}${token.change24h.toFixed(2)}%`} greenStyle={isPositive} />
            <StatStripBox label="Total Swaps" value={token.txCount.toLocaleString()} />
          </div>
        </div>

        {/* Detailed Chart Terminal */}
        <Card className="bg-card/40 border-border/80 backdrop-blur-md overflow-hidden">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between pb-3 gap-3 border-b border-border/50 bg-secondary/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="text-xs uppercase tracking-wider font-mono">
                Interactive Chart Terminal
              </CardTitle>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Price / MCAP toggle */}
              <div className="flex bg-background/60 border border-border/85 rounded p-0.5">
                {(["price", "mcap"] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setChartView(view)}
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded transition-colors ${
                      chartView === view 
                        ? "bg-primary text-black" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {view === "price" ? "Price" : "MCap"}
                  </button>
                ))}
              </div>

              {/* Timeframes */}
              <div className="flex bg-background/60 border border-border/85 rounded p-0.5">
                {candleIntervals.map((tf) => (
                  <button
                    key={tf}
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded transition-colors ${
                      candleInterval === tf 
                        ? "bg-primary text-black" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setCandleInterval(tf)}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 h-[400px]">
            {candlesLoading ? (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-xs">
                <Loader2 className="w-4 h-4 text-primary animate-spin mr-2" />
                Aggregating candles...
              </div>
            ) : candlesError ? (
              <div className="w-full h-full flex items-center justify-center text-destructive font-mono text-xs">
                Failed to aggregate candles.
              </div>
            ) : formattedCandles.length > 0 ? (
              <MarketCandlestickChart candles={formattedCandles} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground font-mono text-xs gap-1.5">
                <span>No real swaps registered yet.</span>
                <span className="text-[10px] text-muted-foreground/60 uppercase">Chart awaits first swap execution</span>
              </div>
            )}
          </CardContent>
        </Card>



        {/* ─── MAIN DETAIL TABS ─── */}
        <div className="flex border-b border-border/40 pb-0.5 gap-2 overflow-x-auto shrink-0 font-mono text-xs">
          {[
            { id: "ledger", label: "Market Ledgers", icon: Activity },
            { id: "security", label: "Security Audit", icon: ShieldCheck, accentColor: securityAudit.status === "Secure" ? "#22c55e" : "#eab308" },
            { id: "discussion", label: "Meme Sentiment Feed", icon: MessageSquare }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = mainDetailTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMainDetailTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 border-t border-x rounded-t-lg font-bold transition-all ${
                  active
                    ? "bg-card/40 border-border/80 text-primary border-b-transparent shadow-[0_-2px_10px_rgba(34,197,94,0.06)]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                style={tab.accentColor && active ? { color: tab.accentColor } : {}}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {tab.id === "security" && (
                  <span 
                    className="text-[9px] px-1 rounded-sm border" 
                    style={{ 
                      borderColor: securityAudit.status === "Secure" ? "rgba(34,197,94,0.3)" : "rgba(234,179,8,0.3)",
                      backgroundColor: securityAudit.status === "Secure" ? "rgba(34,197,94,0.05)" : "rgba(234,179,8,0.05)",
                      color: securityAudit.status === "Secure" ? "#22c55e" : "#eab308"
                    }}
                  >
                    {securityAudit.score}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {mainDetailTab === "ledger" && (
          <Card className="bg-card/40 border-border/80 backdrop-blur-md overflow-hidden">
          <CardHeader className="p-0 border-b border-border/50 bg-secondary/15">
            <div className="flex overflow-x-auto">
              <TabButton
                active={activeTerminalTab === "txs"}
                onClick={() => setActiveTerminalTab("txs")}
                label="Transactions"
                count={computedStats.transactions.length}
              />
              <TabButton
                active={activeTerminalTab === "traders"}
                onClick={() => setActiveTerminalTab("traders")}
                label="Top Traders"
                count={computedStats.traders.length}
              />
              <TabButton
                active={activeTerminalTab === "holders"}
                onClick={() => setActiveTerminalTab("holders")}
                label="Holders"
                count={computedStats.holders.length}
              />
              <TabButton
                active={activeTerminalTab === "lps"}
                onClick={() => setActiveTerminalTab("lps")}
                label="Liquidity Providers"
                count={computedStats.lps.length}
              />
            </div>
          </CardHeader>
          
          <CardContent className="p-0 overflow-x-auto">
            
            {/* 1. Transactions Tab */}
            {activeTerminalTab === "txs" && (
              <div className="min-w-[800px] w-full">
                {computedStats.transactions.length === 0 ? (
                  <EmptyTabState text="No swaps recorded in database ledger." />
                ) : (
                  <table className="w-full border-collapse text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border/40 text-[10px] text-muted-foreground uppercase tracking-wider bg-secondary/10">
                        <th className="p-3">Time</th>
                        <th className="p-3">Type</th>
                        <th className="p-3 text-right">Value (USDC)</th>
                        <th className="p-3 text-right">Amount ({token.ticker})</th>
                        <th className="p-3 text-right">Price</th>
                        <th className="p-3">Trader</th>
                        <th className="p-3 text-center">Txn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {computedStats.transactions.map((t) => {
                        const isBuy = t.side === "buy";
                        const timeStr = new Date(t.timestamp).toLocaleTimeString();
                        return (
                          <tr key={t.id} className="hover:bg-secondary/10 transition-colors">
                            <td className="p-3 text-muted-foreground">{timeStr}</td>
                            <td className={`p-3 font-extrabold uppercase ${isBuy ? "text-primary" : "text-destructive"}`}>
                              {t.side}
                            </td>
                            <td className="p-3 text-right font-bold">${formatBalance(t.wusdcAmount)}</td>
                            <td className="p-3 text-right text-foreground">{formatBalance(t.tokenAmount)}</td>
                            <td className="p-3 text-right text-muted-foreground">${formatPrice(t.executionPrice)}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <Link 
                                  href={`/portfolio?address=${t.traderAddress}`} 
                                  className="hover:underline text-primary hover:text-primary-foreground font-semibold"
                                >
                                  {formatAddress(t.traderAddress)}
                                </Link>
                                <button 
                                  onClick={() => copyToClipboard(t.traderAddress)}
                                  className="text-muted-foreground/60 hover:text-foreground transition-colors p-0.5 rounded"
                                >
                                  {copiedAddress === t.traderAddress ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <a 
                                href={`https://testnet.arcscan.app/tx/${t.txHash}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center justify-center p-1 rounded hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* 2. Top Traders Tab */}
            {activeTerminalTab === "traders" && (
              <div className="min-w-[800px] w-full">
                {computedStats.traders.length === 0 ? (
                  <EmptyTabState text="No trading activity indexed to rank." />
                ) : (
                  <table className="w-full border-collapse text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border/40 text-[10px] text-muted-foreground uppercase tracking-wider bg-secondary/10">
                        <th className="p-3 text-center">Rank</th>
                        <th className="p-3">Trader Address</th>
                        <th className="p-3 text-right">Total Bought</th>
                        <th className="p-3 text-right">Total Sold</th>
                        <th className="p-3 text-right">Current Balance</th>
                        <th className="p-3 text-right">Realized & Unrealized PnL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {computedStats.traders.map((trader, i) => {
                        const isGain = trader.pnl >= 0;
                        return (
                          <tr key={trader.address} className="hover:bg-secondary/10 transition-colors">
                            <td className="p-3 text-center text-muted-foreground font-bold">{i + 1}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <Link 
                                  href={`/portfolio?address=${trader.address}`} 
                                  className="hover:underline text-primary font-semibold"
                                >
                                  {formatAddress(trader.address)}
                                </Link>
                                <button 
                                  onClick={() => copyToClipboard(trader.address)}
                                  className="text-muted-foreground/60 hover:text-foreground p-0.5"
                                >
                                  {copiedAddress === trader.address ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                            </td>
                            <td className="p-3 text-right">${trader.boughtVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right">${trader.soldVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-bold">{formatBalance(trader.balance)}</td>
                            <td className={`p-3 text-right font-extrabold ${isGain ? "text-primary" : "text-destructive"}`}>
                              {isGain ? "+" : ""}${trader.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* 3. Holders Tab */}
            {activeTerminalTab === "holders" && (
              <div className="min-w-[700px] w-full">
                {computedStats.holders.length === 0 ? (
                  <EmptyTabState text="Initial supply metadata missing." />
                ) : (
                  <table className="w-full border-collapse text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border/40 text-[10px] text-muted-foreground uppercase tracking-wider bg-secondary/10">
                        <th className="p-3 text-center">Rank</th>
                        <th className="p-3">Holder Address</th>
                        <th className="p-3 text-right">Balance ({token.ticker})</th>
                        <th className="p-3 text-right">Ownership Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {computedStats.holders.map((holder, i) => {
                        const isCreator = holder.address.toLowerCase() === token.creatorAddress.toLowerCase();
                        const isAmm = token.pairAddress && holder.address.toLowerCase() === token.pairAddress.toLowerCase();
                        return (
                          <tr key={holder.address} className="hover:bg-secondary/10 transition-colors">
                            <td className="p-3 text-center text-muted-foreground font-bold">{i + 1}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <Link 
                                  href={`/portfolio?address=${holder.address}`} 
                                  className="hover:underline text-primary font-semibold"
                                >
                                  {formatAddress(holder.address)}
                                </Link>
                                <button 
                                  onClick={() => copyToClipboard(holder.address)}
                                  className="text-muted-foreground/60 hover:text-foreground p-0.5"
                                >
                                  {copiedAddress === holder.address ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                                </button>
                                
                                {isAmm && (
                                  <span className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded uppercase">
                                    AMM Pool Reserves
                                  </span>
                                )}
                                {isCreator && (
                                  <span className="text-[9px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded uppercase">
                                    Creator
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right font-bold">{formatBalance(holder.balance)}</td>
                            <td className="p-3 text-right font-extrabold text-primary">{holder.pct.toFixed(4)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* 4. Liquidity Providers Tab */}
            {activeTerminalTab === "lps" && (
              <div className="min-w-[700px] w-full">
                {computedStats.lps.length === 0 ? (
                  <EmptyTabState text="No liquidity pool positions created for this token." />
                ) : (
                  <table className="w-full border-collapse text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border/40 text-[10px] text-muted-foreground uppercase tracking-wider bg-secondary/10">
                        <th className="p-3 text-center">Rank</th>
                        <th className="p-3">Provider Address</th>
                        <th className="p-3 text-right">LP Token Balance</th>
                        <th className="p-3 text-right">Ownership Percentage</th>
                        <th className="p-3 text-right">Liquidity Value (WUSDC equiv)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {computedStats.lps.map((lp, i) => (
                        <tr key={lp.address} className="hover:bg-secondary/10 transition-colors">
                          <td className="p-3 text-center text-muted-foreground font-bold">{i + 1}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              {lp.address.startsWith("0x") ? (
                                <Link 
                                  href={`/portfolio?address=${lp.address}`} 
                                  className="hover:underline text-primary font-semibold"
                                >
                                  {formatAddress(lp.address)}
                                </Link>
                              ) : (
                                <span className="font-bold text-foreground">{lp.address}</span>
                              )}
                              <button 
                                onClick={() => lp.address.startsWith("0x") && copyToClipboard(lp.address)}
                                className="text-muted-foreground/60 hover:text-foreground p-0.5 disabled:opacity-30"
                                disabled={!lp.address.startsWith("0x")}
                              >
                                {copiedAddress === lp.address ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                              </button>
                              
                              {lp.isUser && (
                                <span className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded uppercase">
                                  You
                                </span>
                              )}
                              {lp.isCreator && (
                                <span className="text-[9px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded uppercase">
                                  Creator
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right font-bold">{formatBalance(lp.balance)} LP</td>
                          <td className="p-3 text-right font-extrabold text-primary">{lp.share.toFixed(4)}%</td>
                          <td className="p-3 text-right font-bold text-foreground">${lp.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {mainDetailTab === "security" && (
        <Card className="bg-card/40 border-border/80 backdrop-blur-md overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-secondary/15 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-primary" />
                <CardTitle className="text-xs uppercase tracking-wider font-mono">
                  Token Trust Audit Report
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-xs text-muted-foreground uppercase">Safety Grade:</span>
                <span 
                  className="text-lg font-extrabold px-2 py-0.5 rounded border leading-none"
                  style={{
                    color: securityAudit.score >= 70 ? "#22c55e" : securityAudit.score >= 50 ? "#eab308" : "#ef4444",
                    borderColor: securityAudit.score >= 70 ? "rgba(34,197,94,0.3)" : securityAudit.score >= 50 ? "rgba(234,179,8,0.3)" : "rgba(239,68,68,0.3)",
                    backgroundColor: securityAudit.score >= 70 ? "rgba(34,197,94,0.05)" : securityAudit.score >= 50 ? "rgba(234,179,8,0.05)" : "rgba(239,68,68,0.05)"
                  }}
                >
                  {securityAudit.grade}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-6 font-mono text-xs">
            
            {/* Trust Score circular gauge or strip */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-5 bg-background/30 p-4 border border-border/40 rounded-xl">
              <div className="space-y-1 text-center md:text-left">
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Calculated Trust Weight</div>
                <div className="text-3xl font-extrabold text-foreground flex items-baseline justify-center md:justify-start gap-1">
                  {securityAudit.score} <span className="text-xs text-muted-foreground font-normal">/ 100</span>
                </div>
                <div className="text-[10px] text-muted-foreground uppercase">Risk Profile: <span className="font-bold text-foreground">{securityAudit.status}</span></div>
              </div>

              <div className="w-full md:w-3/5 space-y-1">
                <div className="flex justify-between text-[9px] text-muted-foreground uppercase">
                  <span>Vulnerability Scan</span>
                  <span>{securityAudit.score}% Secured</span>
                </div>
                <div className="w-full h-2 rounded-full bg-secondary/35 border border-border/20 flex overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${securityAudit.score}%`,
                      backgroundColor: securityAudit.score >= 70 ? "#22c55e" : securityAudit.score >= 50 ? "#eab308" : "#ef4444" 
                    }} 
                  />
                </div>
              </div>
            </div>

            {/* Cybernetic Liquidity Health Console */}
            <div className="space-y-3 bg-black/60 border border-primary/20 rounded-xl p-4.5 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                <div className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  DEX Reserve & Liquidity Health
                </div>
                <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                  market.reserves
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                }`}>
                  {market.reserves ? "🟢 OPTIMAL LIQUIDITY" : "🔴 UNLISTED RESERVES"}
                </span>
              </div>

              {market.reserves ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] text-muted-foreground uppercase">
                      <span>Reserve Ratio Health</span>
                      <span className="text-primary font-bold">
                        {Math.min(100, Math.round((Number(formatUnits(market.reserves.quoteReserve, 18)) * 2 / (token?.marketCap || 1)) * 100))}% Pool Depth
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-secondary/35 border border-border/20 flex overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-primary" 
                        style={{ 
                          width: `${Math.min(100, Math.round((Number(formatUnits(market.reserves.quoteReserve, 18)) * 2 / (token?.marketCap || 1)) * 100))}%` 
                        }} 
                      />
                    </div>
                    <div className="text-[8px] text-muted-foreground leading-relaxed mt-1">
                      AMM reserve holds <span className="text-primary font-bold">{poolUsdcReserve} WUSDC</span> and <span className="text-primary font-bold">{poolTokenReserve} ${token?.ticker}</span>. 
                      This provides optimal protection against whale price slippage.
                    </div>
                  </div>

                  <div className="space-y-2 border-t md:border-t-0 md:border-l border-primary/10 pt-2 md:pt-0 md:pl-4">
                    <div className="flex justify-between text-[9px] text-muted-foreground uppercase">
                      <span>Whale Concentration Weight</span>
                      <span className="text-yellow-400 font-bold">{securityAudit.checks.creatorOwnership.value}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-secondary/35 border border-border/20 flex overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-yellow-400" 
                        style={{ 
                          width: `${Math.min(100, parseFloat(securityAudit.checks.creatorOwnership.value) || 20)}%` 
                        }} 
                      />
                    </div>
                    <div className="text-[8px] text-muted-foreground leading-relaxed mt-1">
                      Creator owns <span className="text-yellow-400 font-bold">{securityAudit.checks.creatorOwnership.value}</span> of supply.
                      Holdings exceeding 10% are actively flagged as risk variables in automated copytrade transactions.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground italic text-[10px]">
                  [SYS] This token has no active reserves. Build an ApexiSwap pool on the Launchpad to list and fund LP pools.
                </div>
              )}
            </div>

            {/* Safety Checklist Table/List */}
            <div className="space-y-3.5">
              <h4 className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Safety Audit Checklist</h4>
              <div className="divide-y divide-border/30 border border-border/30 rounded-lg overflow-hidden bg-background/10">
                {Object.entries(securityAudit.checks).map(([key, check]) => {
                  const pass = check.status === "pass";
                  const fail = check.status === "fail";
                  return (
                    <div key={key} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        {pass ? (
                          <ShieldCheck className="h-4.5 w-4.5 text-primary shrink-0" />
                        ) : (
                          <ShieldAlert className={`h-4.5 w-4.5 shrink-0 ${fail ? "text-destructive" : "text-yellow-400"}`} />
                        )}
                        <span className="font-bold text-foreground/95">{check.label}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-muted-foreground">{check.value}</span>
                        <span 
                          className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                            pass
                              ? "bg-primary/10 border-primary/25 text-primary"
                              : fail
                              ? "bg-destructive/10 border-destructive/25 text-destructive"
                              : "bg-yellow-500/10 border-yellow-500/25 text-yellow-400"
                          }`}
                        >
                          {check.status === "pass" ? "Passed" : check.status === "warn" ? "Warning" : "Critical"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Suspicious flags or additional heuristics info */}
            <div className="text-[10px] leading-relaxed text-muted-foreground bg-secondary/15 rounded-lg p-3.5 border border-border/30 space-y-1.5">
              <div className="font-bold uppercase text-foreground/75 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" /> Architecture Extensibility Layer
              </div>
              <p>
                ArcMeme Market OS scans real-time liquidity depth, transaction velocity, holder concentrations, and smart contract mint logic. Rug-pull and honeypot heuristics are computed on-chain. Keep LP locks audited before trading meme assets.
              </p>
            </div>

            {/* AI Degen Auditor Panel */}
            <div className="border border-primary/20 bg-background/40 rounded-xl p-4.5 space-y-4">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <h4 className="text-[11px] font-black uppercase text-primary flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-primary animate-pulse" />
                    AI Degen Auditor Scan
                  </h4>
                  <p className="text-[9px] text-muted-foreground uppercase leading-none">
                    Hyper-Decompiler Bytecode heuristic analyst
                  </p>
                </div>
                
                <Button
                  onClick={runAiAudit}
                  disabled={isAuditing}
                  className="h-8 text-black bg-primary hover:bg-primary/90 font-extrabold uppercase text-[10px] tracking-wider px-4 flex items-center gap-1.5 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                >
                  {isAuditing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Decompiling...
                    </>
                  ) : (
                    <>
                      <Activity className="h-3.5 w-3.5" />
                      Run AI Degen Audit
                    </>
                  )}
                </Button>
              </div>

              {isAuditing && (
                <div className="bg-black/80 border border-primary/20 rounded-lg p-3.5 font-mono text-[9px] text-primary/80 space-y-2 relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-primary/30 animate-pulse" />
                  <div className="flex items-center gap-2 text-primary font-black animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    DECOMPILER SCAN ACTIVE... DO NOT INTERRUPT SYSTEM INTERACTION
                  </div>
                  <div className="space-y-1 border-t border-primary/10 pt-2 opacity-70">
                    <div className="animate-[pulse_1s_infinite]">LOG: decompiling contract methods and bytecode chunks...</div>
                    <div className="animate-[pulse_1.2s_infinite]">LOG: running creator concentration weight algorithms...</div>
                    <div className="animate-[pulse_1.4s_infinite]">LOG: simulating honeypot swap outcomes...</div>
                  </div>
                </div>
              )}

              {aiAuditResult && !isAuditing && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-secondary/15 border border-border/40 rounded-lg p-3 flex flex-col justify-between">
                      <div className="text-[9px] text-muted-foreground uppercase font-extrabold">Calculated Safety Score:</div>
                      <div className="flex items-baseline gap-1.5 pt-2">
                        <span 
                          className="text-3xl font-black"
                          style={{
                            color: aiAuditResult.verdict === "safe" ? "#22c55e" : aiAuditResult.verdict === "warning" ? "#eab308" : "#ef4444"
                          }}
                        >
                          {aiAuditResult.safetyScore}
                        </span>
                        <span className="text-[10px] text-muted-foreground">/ 100</span>
                      </div>
                      <div className="text-[8px] uppercase text-muted-foreground pt-1.5">
                        Verdict status: <span 
                          className="font-bold"
                          style={{
                            color: aiAuditResult.verdict === "safe" ? "#22c55e" : aiAuditResult.verdict === "warning" ? "#eab308" : "#ef4444"
                          }}
                        >
                          {aiAuditResult.verdict} risk profile
                        </span>
                      </div>
                    </div>

                    <div className="bg-secondary/15 border border-border/40 rounded-lg p-3 flex flex-col justify-between">
                      <div className="text-[9px] text-muted-foreground uppercase font-extrabold">Creator Allocation Weight:</div>
                      <div className="flex items-baseline gap-1 pt-2">
                        <span className="text-3xl font-black text-foreground">{aiAuditResult.creatorConcentration}%</span>
                      </div>
                      <div className="text-[8px] uppercase text-muted-foreground pt-1.5">
                        Supply holding index
                      </div>
                    </div>
                  </div>

                  <div 
                    className="border rounded-lg p-3 text-[10px] leading-relaxed uppercase space-y-1 font-bold"
                    style={{
                      color: aiAuditResult.verdict === "safe" ? "#22c55e" : aiAuditResult.verdict === "warning" ? "#eab308" : "#ef4444",
                      borderColor: aiAuditResult.verdict === "safe" ? "rgba(34,197,94,0.2)" : aiAuditResult.verdict === "warning" ? "rgba(234,179,8,0.2)" : "rgba(239,68,68,0.2)",
                      backgroundColor: aiAuditResult.verdict === "safe" ? "rgba(34,197,94,0.03)" : aiAuditResult.verdict === "warning" ? "rgba(234,179,8,0.03)" : "rgba(239,68,68,0.03)"
                    }}
                  >
                    <div className="text-[8px] uppercase opacity-70">AI HEURISTIC SCANNER VERDICT:</div>
                    <div>{aiAuditResult.satiricalWarning}</div>
                  </div>

                  <div className="bg-black/90 border border-border/40 rounded-lg p-3 font-mono text-[8px] text-primary/75 space-y-1 max-h-36 overflow-y-auto">
                    <div className="text-[8px] font-black border-b border-primary/10 pb-1 text-primary">AUDITOR TERMINAL SCAN OUTPUTS</div>
                    {aiAuditResult.auditLogs.map((log, i) => (
                      <div key={i} className="flex gap-1.5 leading-normal">
                        <span className="text-primary/40 shrink-0">[{i+1}]</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </CardContent>
        </Card>
      )}

      {mainDetailTab === "discussion" && (
        <Card className="bg-card/40 border-border/80 backdrop-blur-md overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-secondary/15 px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-primary" />
              <CardTitle className="text-xs uppercase tracking-wider font-mono">
                Meme sentiment discussion
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <CommentsSection tokenId={token.id} connectedWalletAddress={walletAddress} />
          </CardContent>
        </Card>
      )}
    </div>

      {/* ─── RIGHT COLUMN: Compact Trading Widgets & Socials ─── */}
      <div className="w-full lg:w-[360px] flex flex-col gap-4 shrink-0 font-mono pb-10">
        
        {/* Full-screen neon green pulse overlay on hype boost click */}
        {showHypePulse && (
          <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center animate-out fade-out duration-1000">
            <div className="absolute inset-0 bg-primary/5 backdrop-blur-[1px] animate-pulse" />
            <div className="w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] border-[6px] border-primary/20 rounded-full animate-ping" />
          </div>
        )}

        {/* Watchlist & Alerts Button Strip (DEX Screener style) */}
        <div className="grid grid-cols-2 gap-3 bg-card/45 border border-border/80 rounded-xl p-3.5 backdrop-blur-md text-xs shadow-sm">
          <Button
            variant="outline"
            onClick={toggleWatchlist}
            className={`h-11 font-extrabold uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 border transition-all duration-300 ${
              isWatched
                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/35 hover:bg-yellow-500/20 shadow-[0_0_12px_rgba(234,179,8,0.12)]"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/20"
            }`}
          >
            <Star className="h-4.5 w-4.5 shrink-0" fill={isWatched ? "currentColor" : "none"} />
            <span>{isWatched ? "Watched" : "Watchlist"}</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setAlertModalOpen(true)}
            className="h-11 font-extrabold uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/20 transition-all duration-300"
          >
            <Bell className="h-4.5 w-4.5 shrink-0" />
            <span>Set Alert</span>
          </Button>
        </div>

        {/* Trading widget terminal */}
        <Card id="trade-console" className="border-border/80 bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Trade Execution Terminal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {renderTradeTerminal()}
          </CardContent>
        </Card>

        {/* Meme Sentiment & Hype Boost Card */}
        <Card className="border-border/80 bg-card/40 backdrop-blur-md overflow-hidden relative">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full blur-lg pointer-events-none" />
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary animate-pulse" />
              Arena Mood & Hype Reactor
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4 font-mono text-xs">
            
            {/* Bull / Bear Sentiment Poll */}
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-extrabold uppercase">
                <span className="flex items-center gap-1 text-primary">
                  <GrowthUpIcon className="h-4 w-4 shrink-0 animate-pulse" />
                  Pump Up: {bullPct.toFixed(0)}%
                </span>
                <span className="flex items-center gap-1 text-destructive">
                  Pump Down: {bearPct.toFixed(0)}%
                  <GrowthDownIcon className="h-4 w-4 shrink-0" />
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden flex bg-destructive/30 border border-border/20">
                <div className="h-full bg-primary transition-all duration-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" style={{ width: `${bullPct}%` }} />
                <div className="h-full bg-destructive transition-all duration-500" style={{ width: `${bearPct}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => castVote("bull")}
                  className="h-8 border border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 text-[10px] uppercase font-bold flex items-center justify-center gap-1.5"
                >
                  <GrowthUpIcon className="h-3.5 w-3.5" />
                  Pump Up
                </Button>
                <Button
                  size="sm"
                  onClick={() => castVote("bear")}
                  className="h-8 border border-destructive/25 bg-destructive/5 text-destructive hover:bg-destructive/10 text-[10px] uppercase font-bold flex items-center justify-center gap-1.5"
                >
                  Pump Down
                  <GrowthDownIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {aiSentiment && (
              <div className="border-t border-border/20 pt-3.5 space-y-3">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-extrabold uppercase">
                  <span>AI Sentiment Radar</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary text-[9px] font-black tracking-widest animate-pulse">
                    {aiSentiment.hypeStatus}
                  </span>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                    <span>Degen Buzz Score:</span>
                    <span className="text-foreground font-black">{aiSentiment.buzzScore} / 100</span>
                  </div>
                  <div className="h-2 rounded bg-secondary/35 border border-border/10 overflow-hidden flex">
                    <div 
                      className="h-full bg-primary transition-all duration-1000 shadow-[0_0_10px_rgba(34,197,94,0.3)]" 
                      style={{ width: `${aiSentiment.buzzScore}%` }} 
                    />
                  </div>
                </div>

                <div className="bg-secondary/15 border border-border/20 rounded p-2.5 space-y-1 text-[9px] leading-relaxed uppercase">
                  <div className="text-[8px] font-bold text-muted-foreground">AI SUMMARY TELEMETRY:</div>
                  <div className="text-foreground/90 font-medium">{aiSentiment.sentimentSummary}</div>
                </div>
              </div>
            )}

            <div className="border-t border-border/20 pt-3.5 space-y-2.5">
              <div className="flex justify-between items-center text-[10px] text-muted-foreground font-extrabold uppercase">
                <span>Hype Energy Matrix</span>
                <span className="text-primary font-black animate-bounce">{hypeScore} Points</span>
              </div>
              <Button
                onClick={handleHypeBoost}
                className="w-full h-10 text-black bg-primary hover:bg-primary/90 font-extrabold uppercase tracking-widest text-[11px] shadow-[0_0_20px_rgba(34,197,94,0.25)] flex items-center justify-center gap-2 group"
              >
                <Zap className="h-4 w-4 fill-black group-hover:scale-125 transition-transform animate-pulse" />
                Trigger Hype Boost!
              </Button>
              <div className="text-[8px] text-center text-muted-foreground uppercase leading-relaxed mt-1">
                Hype Boost multiplies discoverability trending velocity
              </div>
            </div>

          </CardContent>
        </Card>

        {/* LP reserves overview panel */}
        <Card className="border-border/80 bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              Liquidity Reserves
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-border/20">
              <span className="text-muted-foreground">AMM Pair Status</span>
              <span className={`px-2 py-0.5 rounded-[3px] font-extrabold uppercase text-[9px] border ${
                market.isTradeable 
                  ? "bg-primary/10 border-primary/25 text-primary" 
                  : "bg-yellow-500/10 border-yellow-500/25 text-yellow-400"
              }`}>
                {market.isTradeable ? "Active & Swappable" : "Unlisted reserves"}
              </span>
            </div>
            
            {market.isTradeable && poolTokenReserve && poolUsdcReserve ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pooled {token.ticker}</span>
                  <span className="font-bold text-foreground">{poolTokenReserve}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pooled WUSDC</span>
                  <span className="font-bold text-foreground">{poolUsdcReserve}</span>
                </div>
                <div className="flex justify-between border-t border-border/20 pt-2 font-semibold">
                  <span className="text-muted-foreground">Pool Valuation</span>
                  <span className="text-primary font-extrabold">${(Number(poolUsdcReserve) * 2).toLocaleString(undefined, { maximumFractionDigits: 2 })} WUSDC</span>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground leading-normal text-center py-2">
                Reserves are empty. Deposit liquidity to create swap pools.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Advanced Liquidity Pool Manager */}
        <Card className="border-border/80 bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Liquidity Manager
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            
            {/* Liquidity Add / Withdraw tabs */}
            <div className="flex bg-secondary/35 p-1 rounded-lg border border-border/40">
              <Button
                variant="ghost"
                onClick={() => {
                  setLiquidityTab("add");
                  liquidity.reset();
                }}
                className={`flex-1 h-8 text-[11px] uppercase font-bold transition-all ${
                  liquidityTab === "add"
                    ? "bg-primary text-black hover:bg-primary shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Add
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setLiquidityTab("withdraw");
                  liquidity.reset();
                }}
                className={`flex-1 h-8 text-[11px] uppercase font-bold transition-all ${
                  liquidityTab === "withdraw"
                    ? "bg-destructive text-white hover:bg-destructive shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Withdraw
              </Button>
            </div>

            {liquidityTab === "add" ? (
              <div className="space-y-3.5">
                <div>
                  <div className="mb-1.5 flex justify-between text-[10px] font-bold text-muted-foreground">
                    <span>TOKEN BALANCE</span>
                    <span className="text-foreground">{market.tokenBalance}</span>
                  </div>
                  <Input
                    type="number"
                    placeholder="Token amount"
                    value={liquidityTokenAmount}
                    onChange={(event) => {
                      const val = event.target.value;
                      setLiquidityTokenAmount(val);
                      if (market.reserves && market.reserves.baseReserve > 0n && market.reserves.quoteReserve > 0n) {
                        setLiquidityUsdcAmount(quoteLiquidityAmount(val, "token"));
                      }
                      liquidity.reset();
                    }}
                    className="font-mono bg-background/50 h-10 border-border/60"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-[10px] font-bold text-muted-foreground">
                    <span>WUSDC BALANCE</span>
                    <span className="text-foreground">{usdcBalance ?? "0.000"}</span>
                  </div>
                  <Input
                    type="number"
                    placeholder="USDC amount"
                    value={liquidityUsdcAmount}
                    onChange={(event) => {
                      const val = event.target.value;
                      setLiquidityUsdcAmount(val);
                      if (market.reserves && market.reserves.baseReserve > 0n && market.reserves.quoteReserve > 0n) {
                        setLiquidityTokenAmount(quoteLiquidityAmount(val, "usdc"));
                      }
                      liquidity.reset();
                    }}
                    className="font-mono bg-background/50 h-10 border-border/60"
                  />
                </div>
                {expectedLpShare !== null && (
                  <div className="flex justify-between items-center text-[10px] font-bold text-primary bg-primary/5 border border-primary/20 rounded p-2.5 mt-2">
                    <span className="uppercase">Expected LP Share</span>
                    <span>{expectedLpShare.toFixed(4)}%</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground">
                  <span>LP TOKEN SHARES</span>
                  <span className="text-primary font-bold">{market.lpBalance} LP</span>
                </div>
                <Input
                  type="number"
                  placeholder="LP token amount"
                  value={liquidityLpAmount}
                  onChange={(event) => {
                    setLiquidityLpAmount(event.target.value);
                    liquidity.reset();
                  }}
                  className="font-mono bg-background/50 h-10 border-border/60"
                />
                <div className="grid grid-cols-3 gap-1.5">
                  {[25, 50, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setLiquidityLpAmount(formatBalance((numericLpBalance * pct) / 100));
                        liquidity.reset();
                      }}
                      className="py-1 text-[9px] font-bold border border-border/70 rounded hover:border-primary/50 text-muted-foreground hover:text-primary transition-all uppercase"
                    >
                      {pct === 100 ? "MAX" : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error alerts or transaction notifications */}
            {liquidity.status.status === "error" && (
              <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-[11px] text-destructive leading-relaxed flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{liquidity.status.message}</span>
              </div>
            )}
            {liquidity.status.status === "success" && (
              <a
                href={`https://testnet.arcscan.app/tx/${liquidity.status.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] text-primary hover:underline font-semibold leading-relaxed"
              >
                Liquidity {liquidity.status.action === "add" ? "added" : "withdrawn"} confirmed. View on ArcScan.
              </a>
            )}

            {/* Action buttons */}
            {state.status !== "connected" ? (
              <div className="text-center text-[10px] text-muted-foreground font-semibold py-2.5 border border-border/50 rounded-lg bg-secondary/20 uppercase tracking-wider">
                Connect Wallet to Manage
              </div>
            ) : !state.isArcTestnet ? (
              <div className="text-center text-[10px] text-yellow-400 font-semibold py-2.5 border border-yellow-500/30 rounded-lg bg-yellow-500/10 uppercase tracking-wider">
                Switch network to configure reserves
              </div>
            ) : liquidityTab === "withdraw" && !market.isTradeable ? (
              <div className="text-center text-[10px] text-yellow-400 font-semibold py-2.5 border border-yellow-500/30 rounded-lg bg-yellow-500/10 uppercase tracking-wider">
                Add liquidity first to form the AMM pool
              </div>
            ) : (
              <Button
                className={`w-full font-extrabold uppercase tracking-widest h-12 text-black ${
                  liquidityTab === "add" 
                    ? "bg-primary hover:bg-primary/90" 
                    : "bg-destructive hover:bg-destructive/90 text-white"
                }`}
                disabled={liquidityTab === "add" ? !canAddLiquidity : !canWithdrawLiquidity}
                onClick={liquidityTab === "add" ? handleAddLiquidity : handleWithdrawLiquidity}
              >
                {isLiquidityPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {liquidityStepLabel}
                  </span>
                ) : (
                  liquidityStepLabel
                )}
              </Button>
            )}

          </CardContent>
        </Card>

        {/* Detailed links & Explorer parameters */}
        <Card className="border-border/80 bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Registry Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Creator</span>
              <Link href={`/portfolio?address=${token.creatorAddress}`} className="text-primary hover:underline font-bold">
                {formatAddress(token.creatorAddress)}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Creation Date</span>
              <span className="text-foreground font-semibold">{new Date(token.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Supply</span>
              <span className="text-foreground font-bold">{token.totalSupply.toLocaleString()}</span>
            </div>
            
            {token.contractAddress && (
              <div className="flex justify-between items-center gap-2 border-t border-border/20 pt-2 mt-2">
                <span className="text-muted-foreground flex-shrink-0">ERC20 Contract</span>
                <a
                  href={`https://testnet.arcscan.app/address/${token.contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary truncate hover:underline flex items-center gap-1 font-bold"
                  title={token.contractAddress}
                >
                  {token.contractAddress.slice(0, 6)}...{token.contractAddress.slice(-4)}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            )}

            {token.pairAddress && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground flex-shrink-0">ApexiSwap LP Pair</span>
                <a
                  href={`https://testnet.arcscan.app/address/${token.pairAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary truncate hover:underline flex items-center gap-1 font-bold"
                  title={token.pairAddress}
                >
                  {token.pairAddress.slice(0, 6)}...{token.pairAddress.slice(-4)}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            )}

            {/* Social media connections */}
            {(token.website || token.twitter || token.telegram) && (
              <div className="grid grid-cols-3 gap-2 border-t border-border/20 pt-3 mt-3">
                {token.website && (
                  <Button variant="outline" size="sm" className="h-8 font-mono text-[10px] uppercase gap-1" asChild>
                    <a href={token.website} target="_blank" rel="noreferrer">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      Website
                    </a>
                  </Button>
                )}
                {token.twitter && (
                  <Button variant="outline" size="sm" className="h-8 font-mono text-[10px] uppercase gap-1" asChild>
                    <a href={`https://twitter.com/${token.twitter}`} target="_blank" rel="noreferrer">
                      <Twitter className="h-3.5 w-3.5 shrink-0" />
                      Twitter
                    </a>
                  </Button>
                )}
                {token.telegram && (
                  <Button variant="outline" size="sm" className="h-8 font-mono text-[10px] uppercase gap-1" asChild>
                    <a href={token.telegram} target="_blank" rel="noreferrer">
                      <Send className="h-3.5 w-3.5 shrink-0" />
                      Telegram
                    </a>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Sticky mobile action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-t border-border/80 p-3 flex gap-3 lg:hidden">
        <Button
          onClick={() => {
            setTradeTab("buy");
            setIsMobileTradeOpen(true);
          }}
          className="flex-1 bg-primary hover:bg-primary/90 text-black font-extrabold uppercase tracking-widest h-12"
        >
          Buy
        </Button>
        <Button
          onClick={() => {
            setTradeTab("sell");
            setIsMobileTradeOpen(true);
          }}
          className="flex-1 bg-destructive hover:bg-destructive/90 text-white font-extrabold uppercase tracking-widest h-12"
        >
          Sell
        </Button>
      </div>

      {/* Slide-up overlay containing trade terminal */}
      <Sheet open={isMobileTradeOpen} onOpenChange={setIsMobileTradeOpen}>
        <SheetContent side="bottom" className="h-[85vh] bg-background border-t border-border overflow-y-auto px-4 pb-10 z-[100]">
          <SheetHeader className="text-left pb-4 border-b border-border/40 font-mono">
            <SheetTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Quick Swap: {token.ticker}
            </SheetTitle>
          </SheetHeader>
          <div className="pt-4 max-w-md mx-auto">
            {renderTradeTerminal()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sleek Cyber-Alert Management Dialog */}
      <Dialog open={alertModalOpen} onOpenChange={setAlertModalOpen}>
        <DialogContent className="border-border/80 bg-card/95 backdrop-blur-xl max-w-md p-6 font-mono text-xs z-[150] shadow-[0_0_50px_rgba(34,197,94,0.08)] border-primary/20">
          <DialogHeader className="border-b border-border/40 pb-3 mb-4 text-left">
            <DialogTitle className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
              <Bell className="h-4.5 w-4.5 text-primary animate-pulse" />
              Manage Price Alerts: ${token.ticker}
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground uppercase mt-1">
              Configure telemetry thresholds to push system & browser notifications
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <label className="text-[10px] text-muted-foreground uppercase font-bold">Alert Trigger Metric</label>
              <select
                value={alertMetric}
                onChange={(event) => setAlertMetric(event.target.value as AlertRule["metric"])}
                className="w-full h-11 rounded-lg border border-border/60 bg-background/50 px-3.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors uppercase cursor-pointer"
              >
                <option value="price_above">Price goes over ($)</option>
                <option value="price_below">Price goes below ($)</option>
                <option value="volume_spike">24h Volume Exceeds ($)</option>
                <option value="liquidity_change">Liquidity (MCap) Exceeds ($)</option>
                <option value="whale_swap">Individual Whale Swap ($)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-muted-foreground uppercase font-bold">Target Value Threshold</label>
              <div className="relative">
                <span className="absolute left-3.5 top-3.5 text-muted-foreground/60 font-bold">$</span>
                <Input
                  value={alertTargetValue}
                  onChange={(e) => setAlertTargetValue(e.target.value)}
                  placeholder="0.000000"
                  type="number"
                  className="pl-7 h-11 bg-background/50 border-border/60 font-mono text-xs focus-visible:ring-primary/40 focus:border-primary/50"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border/30 mt-5 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAlertModalOpen(false)}
              className="h-11 font-bold uppercase tracking-wider text-[10px] border-border/60 hover:bg-secondary/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAlert}
              className="h-11 font-extrabold uppercase tracking-widest text-[10px] text-black bg-primary hover:bg-primary/90"
            >
              Create Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function StatStripBox({ 
  label, 
  value, 
  highlight = false, 
  greenStyle = null 
}: { 
  label: string; 
  value: string; 
  highlight?: boolean; 
  greenStyle?: boolean | null;
}) {
  return (
    <div className="flex flex-col gap-1 p-2 bg-background/30 rounded-lg border border-border/20 text-center md:text-left">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground/80 font-bold">{label}</span>
      <span className={`font-bold font-mono tracking-tight ${
        highlight 
          ? "text-primary text-[13px] drop-shadow-[0_0_8px_rgba(34,197,94,0.2)]" 
          : greenStyle === true 
          ? "text-primary font-bold" 
          : greenStyle === false 
          ? "text-destructive font-bold" 
          : "text-foreground"
      }`}>
        {value}
      </span>
    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  label, 
  count 
}: { 
  active: boolean; 
  onClick: () => void; 
  label: string; 
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 text-[10px] uppercase font-bold tracking-widest font-mono border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
        active
          ? "border-primary text-primary bg-background/40"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/10"
      }`}
    >
      <span>{label}</span>
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
        active 
          ? "bg-primary/20 text-primary border border-primary/25" 
          : "bg-secondary/40 text-muted-foreground border border-border/20"
      }`}>
        {count}
      </span>
    </button>
  );
}

function EmptyTabState({ text }: { text: string }) {
  return (
    <div className="p-8 text-center font-mono text-xs text-muted-foreground leading-relaxed">
      {text}
    </div>
  );
}
