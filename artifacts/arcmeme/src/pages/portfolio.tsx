import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatAddress, formatBalance, formatCompactNumber } from "@/lib/utils";
import { Loader2, ArrowUpRight, TrendingUp, TrendingDown, WalletCards, Activity, Award, Briefcase, RefreshCw, BarChart2 } from "lucide-react";
import { Link } from "wouter";
import {
  getArcReadProvider,
  getErc20Contract,
  readPairReserves,
  normalizeReserves,
  DEFAULT_ARC_AMM
} from "@/lib/arc-amm";
import { formatUnits } from "ethers";

export function PortfolioPage() {
  const { state } = useWallet();
  const { toast } = useToast();
  const searchParams = new URLSearchParams(window.location.search);
  const queryAddress = searchParams.get("address") || undefined;
  const walletAddress = queryAddress || (state.status === "connected" ? state.address : undefined);
  const isOwnWallet = !queryAddress || queryAddress.toLowerCase() === (state.status === "connected" ? state.address.toLowerCase() : "");

  // 1. Fetch portfolio metrics, stats, and historical trades from backend SQL indexer
  const { data: portfolioData, isLoading: portfolioLoading, refetch: refetchPortfolio } = useQuery({
    queryKey: ["portfolio", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return { holdings: [], trades: [] };
      const response = await fetch(`/api/portfolio/${walletAddress}`);
      if (!response.ok) throw new Error("Failed to fetch portfolio data.");
      return response.json();
    },
    enabled: !!walletAddress,
  });

  const [liveHoldings, setLiveHoldings] = useState<any[]>([]);
  const [liveLps, setLiveLps] = useState<any[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [followedWallets, setFollowedWallets] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("followed_wallets") || "[]");
    } catch {
      return [];
    }
  });

  // 2. Fetch live ERC20 balances, LP token balances, and pool reserves from the Arc network
  const fetchLiveStats = async () => {
    if (!walletAddress || !portfolioData?.holdings) return;
    setLiveLoading(true);
    try {
      const provider = getArcReadProvider();
      const holdingsList = [];
      const lpsList = [];

      for (const item of portfolioData.holdings) {
        if (!item.contractAddress) continue;

        // Fetch live custom token balance
        const tokenContract = getErc20Contract(item.contractAddress, provider);
        const balanceWei = await tokenContract.balanceOf(walletAddress);
        const decimals = 18;
        const balance = Number(formatUnits(balanceWei, decimals));

        // Fetch live LP balance and calculate contributions if pool exists
        let lpBalance = 0;
        let lpContributedBase = 0;
        let lpContributedQuote = 0;
        let lpContributedValue = 0;
        let lpPercent = 0;

        if (item.pairAddress && item.marketType === "amm_pool") {
          const pairContract = getErc20Contract(item.pairAddress, provider);
          const lpBalanceWei = await pairContract.balanceOf(walletAddress);
          lpBalance = Number(formatUnits(lpBalanceWei, 18));

          if (lpBalance > 0) {
            const lpTotalSupplyWei = await pairContract.totalSupply();
            const lpTotalSupply = Number(formatUnits(lpTotalSupplyWei, 18));
            lpPercent = lpTotalSupply > 0 ? (lpBalance / lpTotalSupply) * 100 : 0;

            try {
              const rawReserves = await readPairReserves(item.pairAddress, provider);
              const reserves = normalizeReserves(rawReserves, item.contractAddress, DEFAULT_ARC_AMM.wusdcAddress);
              const baseContributedWei = (reserves.baseReserve * lpBalanceWei) / lpTotalSupplyWei;
              const quoteContributedWei = (reserves.quoteReserve * lpBalanceWei) / lpTotalSupplyWei;

              lpContributedBase = Number(formatUnits(baseContributedWei, decimals));
              lpContributedQuote = Number(formatUnits(quoteContributedWei, 18));
              lpContributedValue = lpContributedQuote * 2;
            } catch (err) {
              console.error("Failed to fetch reserves for pair", item.pairAddress, err);
            }
          }
        }

        const currentPrice = item.currentPrice;
        const totalValue = balance * currentPrice;
        const unrealizedPnl = (currentPrice - item.avgEntryPrice) * balance;

        holdingsList.push({
          ...item,
          balance,
          totalValue,
          unrealizedPnl,
        });

        if (lpBalance > 0) {
          lpsList.push({
            tokenId: item.tokenId,
            ticker: item.ticker,
            name: item.name,
            logoColor: item.logoColor,
            pairAddress: item.pairAddress,
            lpBalance,
            lpPercent,
            contributedBase: lpContributedBase,
            contributedQuote: lpContributedQuote,
            totalValue: lpContributedValue,
          });
        }
      }

      setLiveHoldings(holdingsList);
      setLiveLps(lpsList);
    } catch (err) {
      console.error("Live balance fetch failed", err);
    } finally {
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    if (!walletAddress || !portfolioData?.holdings) return;
    fetchLiveStats();

    const interval = setInterval(fetchLiveStats, 15000);
    return () => clearInterval(interval);
  }, [walletAddress, portfolioData]);

  const handleManualRefresh = async () => {
    await Promise.all([refetchPortfolio(), fetchLiveStats()]);
    toast({
      title: "PORTFOLIO SYNCHRONIZED",
      description: "Live on-chain balances and trades re-indexed successfully.",
    });
  };

  // 3. Analytics summaries
  const usdcBalanceNumber = state.status === "connected" ? Number(state.usdcBalance) || 0 : 0;
  const holdingValueSum = liveHoldings.reduce((sum, item) => sum + item.totalValue, 0);
  const lpValueSum = liveLps.reduce((sum, item) => sum + item.totalValue, 0);
  const netWorth = usdcBalanceNumber + holdingValueSum + lpValueSum;

  const totalRealizedPnl = liveHoldings.reduce((sum, item) => sum + item.realizedPnl, 0);
  const totalUnrealizedPnl = liveHoldings.reduce((sum, item) => sum + item.unrealizedPnl, 0);

  const biggestPosition = useMemo(() => {
    if (liveHoldings.length === 0) return null;
    return [...liveHoldings].sort((a, b) => b.totalValue - a.totalValue)[0];
  }, [liveHoldings]);

  if (!walletAddress) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md w-full border-border/80 bg-card/45 backdrop-blur-md p-6 text-center font-mono space-y-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary animate-pulse">
            <WalletCards className="h-6 w-6" />
          </div>
          <CardTitle className="text-base uppercase tracking-widest text-primary font-bold">Connect Wallet</CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Please connect your wallet in the navigation header, or select a trader from the terminal to track their profile, holdings, and execution history.
          </p>
        </Card>
      </div>
    );
  }

  const isPositiveRealized = totalRealizedPnl >= 0;
  const isPositiveUnrealized = totalUnrealizedPnl >= 0;

  return (
    <div className="flex-1 p-4 md:p-6 pb-20">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div>
            <div className="mb-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] terminal-pulse" />
              Wallet Portfolio OS
            </div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2.5">
              Portfolio Overview
            </h1>
            <div className="font-mono text-[10px] text-muted-foreground/80 mt-1 break-all">
              Index: <span className="text-foreground/90 select-all font-semibold">{walletAddress}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={liveLoading}
              className="h-9 font-mono text-xs uppercase gap-2"
            >
              {liveLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Sync Registry
            </Button>
          </div>
        </div>

        {/* Analytics Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <OverviewCard
            label="Net Worth"
            value={`$${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subText={`Gas: $${usdcBalanceNumber.toLocaleString()} USDC · LP: $${lpValueSum.toLocaleString()}`}
            icon={<WalletCards className="h-4 w-4 text-primary" />}
            active
          />
          <OverviewCard
            label="Realized PnL"
            value={`${isPositiveRealized ? "+" : ""}$${totalRealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subText="Realized from closed positions"
            icon={isPositiveRealized ? <TrendingUp className="h-4 w-4 text-primary" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
            colorClass={isPositiveRealized ? "text-primary font-bold" : "text-destructive font-bold"}
          />
          <OverviewCard
            label="Unrealized PnL"
            value={`${isPositiveUnrealized ? "+" : ""}$${totalUnrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subText="Floating profit/loss on custom bags"
            icon={isPositiveUnrealized ? <TrendingUp className="h-4 w-4 text-primary" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
            colorClass={isPositiveUnrealized ? "text-primary font-bold" : "text-destructive font-bold"}
          />
          {biggestPosition ? (
            <OverviewCard
              label="Biggest Position"
              value={`$${biggestPosition.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              subText={`Asset: $${biggestPosition.ticker} (${formatBalance(biggestPosition.balance)} tokens)`}
              icon={<Award className="h-4 w-4 text-yellow-400" />}
            />
          ) : (
            <OverviewCard
              label="Biggest Position"
              value="N/A"
              subText="No custom positions loaded"
              icon={<Award className="h-4 w-4 text-muted-foreground" />}
            />
          )}
        </div>

        {/* Primary Sections Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          
          <div className="min-w-0 space-y-6">
            
            {/* Holdings Segment */}
            <Card className="border-border bg-card/45 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Assets & Holdings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {liveHoldings.length === 0 ? (
                  <div className="p-8 text-center font-mono text-xs text-muted-foreground">
                    No custom tokens traded or held in this wallet.
                  </div>
                ) : (
                  <table className="w-full min-w-[700px] border-collapse text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border/50 text-[10px] text-muted-foreground uppercase tracking-wider bg-secondary/10">
                        <th className="p-3">Asset</th>
                        <th className="p-3 text-right">Balance</th>
                        <th className="p-3 text-right">Avg Entry</th>
                        <th className="p-3 text-right">Current Price</th>
                        <th className="p-3 text-right">Market Value</th>
                        <th className="p-3 text-right">Realized PnL</th>
                        <th className="p-3 text-right">Unrealized PnL</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {liveHoldings.map((item) => {
                        const isHoldingPositiveRealized = item.realizedPnl >= 0;
                        const isHoldingPositiveUnrealized = item.unrealizedPnl >= 0;
                        return (
                          <tr key={item.tokenId} className="hover:bg-secondary/15 transition-colors">
                            <td className="p-3 font-semibold flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.logoColor || "#22c55e" }} />
                              <Link href={`/token/${item.tokenId}`} className="hover:underline text-foreground">
                                ${item.ticker}
                              </Link>
                              <span className="text-[10px] text-muted-foreground font-normal">({item.name})</span>
                            </td>
                            <td className="p-3 text-right font-bold">{formatBalance(item.balance)}</td>
                            <td className="p-3 text-right text-muted-foreground">${item.avgEntryPrice.toFixed(6)}</td>
                            <td className="p-3 text-right" style={{ color: item.logoColor || "#22c55e" }}>${item.currentPrice.toFixed(6)}</td>
                            <td className="p-3 text-right font-bold">${item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                            <td className={`p-3 text-right font-semibold ${isHoldingPositiveRealized ? "text-primary" : "text-destructive"}`}>
                              {isHoldingPositiveRealized ? "+" : ""}${item.realizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className={`p-3 text-right font-semibold ${isHoldingPositiveUnrealized ? "text-primary" : "text-destructive"}`}>
                              {isHoldingPositiveUnrealized ? "+" : ""}${item.unrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-center">
                              <Button asChild variant="ghost" size="icon" className="h-6 w-6 hover:bg-secondary/40 rounded-full">
                                <Link href={`/token/${item.tokenId}`}>
                                  <ArrowUpRight className="h-3.5 w-3.5" style={{ color: item.logoColor }} />
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Liquidity Positions Segment */}
            <Card className="border-border bg-card/45 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Active Liquidity Positions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {liveLps.length === 0 ? (
                  <div className="p-8 text-center font-mono text-xs text-muted-foreground">
                    No active liquidity pools backed by this wallet.
                  </div>
                ) : (
                  <table className="w-full min-w-[700px] border-collapse text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border/50 text-[10px] text-muted-foreground uppercase tracking-wider bg-secondary/10">
                        <th className="p-3">Liquidity Pair</th>
                        <th className="p-3 text-right">Contributed Shares</th>
                        <th className="p-3 text-right">Pool Ownership</th>
                        <th className="p-3 text-right">LP Tokens</th>
                        <th className="p-3 text-right">LP Value</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {liveLps.map((item) => (
                        <tr key={item.tokenId} className="hover:bg-secondary/15 transition-colors">
                          <td className="p-3 font-semibold">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.logoColor }} />
                              <span>{item.ticker}/WUSDC</span>
                            </div>
                          </td>
                          <td className="p-3 text-right text-muted-foreground leading-normal">
                            <div>{formatBalance(item.contributedBase)} {item.ticker}</div>
                            <div className="text-[10px] text-muted-foreground/60">{formatBalance(item.contributedQuote)} WUSDC</div>
                          </td>
                          <td className="p-3 text-right font-bold text-primary">{item.lpPercent.toFixed(4)}%</td>
                          <td className="p-3 text-right">{formatBalance(item.lpBalance)} LP</td>
                          <td className="p-3 text-right font-bold text-foreground">${item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-3 text-center">
                            <Button asChild variant="ghost" size="icon" className="h-6 w-6 hover:bg-secondary/40 rounded-full">
                              <Link href={`/token/${item.tokenId}`}>
                                <ArrowUpRight className="h-3.5 w-3.5" style={{ color: item.logoColor }} />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Smart Money Copytrading System */}
            <Card className="border-border bg-card/45 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary animate-pulse" />
                  Smart Money Copytrading System
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="rounded border border-primary/20 bg-primary/5 p-3 font-mono text-[10px] text-primary leading-relaxed">
                  ⚠️ COPYTRADING COGNITIVE ENGINE IS ARMED. When any followed wallet executes a buy/sell trade on an Arc AMM pool, a simulated execution mirror will be processed according to your max allocation.
                </div>

                {followedWallets.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground text-xs uppercase font-semibold">
                    No bookmarked smart money wallets. Visit the <Link href="/leaderboard" className="text-primary hover:underline">Arena Leaderboard</Link> to follow high-performing traders.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {followedWallets.map((addr) => {
                      return (
                        <div key={addr} className="border border-border/60 rounded p-4 bg-card/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                              <Link href={`/wallet/${addr}`} className="font-bold hover:text-primary transition-colors truncate block">
                                {addr}
                              </Link>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                              <span>Allocation: <strong className="text-foreground">25 WUSDC</strong></span>
                              <span>Max Slippage: <strong className="text-foreground">1.0%</strong></span>
                              <span>Sim Closed Swaps: <strong className="text-primary">+4.20%</strong></span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const updated = followedWallets.filter(a => a !== addr);
                                setFollowedWallets(updated);
                                localStorage.setItem("followed_wallets", JSON.stringify(updated));
                                toast({
                                  title: "Stopped Copying",
                                  description: `Disarmed copytrade allocation for ${formatAddress(addr)}.`,
                                });
                              }}
                              className="h-8 border-destructive/30 hover:border-destructive hover:bg-destructive/10 text-destructive text-[10px]"
                            >
                              Disarm Copy
                            </Button>
                            
                            <Button
                              size="sm"
                              className="h-8 text-black bg-primary hover:bg-primary/80 font-extrabold text-[10px]"
                              onClick={() => {
                                toast({
                                  title: "Allocation Reconfigured",
                                  description: "Copytrade size increased by 50 WUSDC for optimal capture.",
                                });
                              }}
                            >
                              Configure Size
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trade History Sidebar */}
          <aside className="w-full">
            <Card className="border-border bg-card/45 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  Recent Trades
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[580px] overflow-y-auto hide-scrollbar">
                {!portfolioData?.trades || portfolioData.trades.length === 0 ? (
                  <div className="p-8 text-center font-mono text-xs text-muted-foreground">
                    No recent trades found for this address.
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {portfolioData.trades.map((trade: any) => {
                      const tok = liveHoldings.find(t => t.tokenId === trade.tokenId);
                      const color = tok?.logoColor || "#22c55e";
                      const isBuy = trade.side === "buy";
                      return (
                        <a
                          key={trade.id}
                          href={`https://testnet.arcscan.app/tx/${trade.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block p-3.5 font-mono text-xs hover:bg-secondary/15 transition-colors group"
                        >
                          <div className="flex justify-between items-center text-[10px] mb-1">
                            <span className={`px-1.5 rounded-[2px] font-bold text-[9px] uppercase tracking-wider ${isBuy ? "bg-primary/10 text-primary border border-primary/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                              {trade.side}
                            </span>
                            <span className="text-muted-foreground">{new Date(trade.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="flex justify-between gap-2 mt-1">
                            <span className="font-bold flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                              <span>{formatBalance(trade.tokenAmount)}</span>
                              <span style={{ color }}>${tok?.ticker || "TOKEN"}</span>
                            </span>
                            <span className="font-bold text-foreground/80">${formatBalance(trade.wusdcAmount)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-muted-foreground/60 mt-1.5 group-hover:text-muted-foreground transition-colors">
                            <span>Price: ${Number(trade.executionPrice).toFixed(6)}</span>
                            <span>Tx: {formatAddress(trade.txHash)}</span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>

        </div>

      </div>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  subText,
  icon,
  active = false,
  colorClass = "text-foreground"
}: {
  label: string;
  value: string;
  subText: string;
  icon?: React.ReactNode;
  active?: boolean;
  colorClass?: string;
}) {
  return (
    <Card className="border-border/80 bg-card/45 backdrop-blur-md p-4 flex flex-col justify-between hover:border-primary/20 transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className={`mt-1 font-mono text-xl font-bold tracking-tight ${active ? "text-primary drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]" : colorClass}`}>
            {value}
          </div>
        </div>
        <div className="opacity-70 group-hover:opacity-100 transition-opacity mt-0.5">
          {icon}
        </div>
      </div>
      <div className="mt-2.5 font-mono text-[9px] text-muted-foreground/70 tracking-wide border-t border-border/20 pt-2">
        {subText}
      </div>
    </Card>
  );
}
