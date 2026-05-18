import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetToken, useGetTokenChart, getGetTokenQueryKey, getGetTokenChartQueryKey, type Trade } from "@workspace/api-client-react";
import { TokenLogo } from "@/components/token-card";
import { formatCompactNumber, formatAddress, formatBalance } from "@/lib/utils";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useTokenMarket } from "@/hooks/use-token-market";
import { useTokenTrade } from "@/hooks/use-token-trade";
import { Loader2 } from "lucide-react";
import { formatUnits, parseUnits } from "ethers";
import { calculateAmountIn, calculateAmountOut } from "@/lib/arc-amm";

export function TokenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, refresh: refreshWallet } = useWallet();
  const queryClient = useQueryClient();

  const { data: token, isLoading: tokenLoading, isError: tokenError, refetch: refetchToken } = useGetToken(id!, {
    query: { enabled: !!id, queryKey: getGetTokenQueryKey(id!) },
  });

  const { data: chartData } = useGetTokenChart(id!, {
    query: { enabled: !!id, queryKey: getGetTokenChartQueryKey(id!) },
  });

  const tradesQueryKey = ["token-trades", id] as const;
  const { data: trades = [], isLoading: tradesLoading, isError: tradesError } = useQuery({
    queryKey: tradesQueryKey,
    enabled: !!id,
    queryFn: async () => {
      try {
        const response = await fetch(`/api/tokens/${encodeURIComponent(id!)}/trades`);
        const indexingError = response.headers.get("x-arcmeme-indexing-error");
        if (indexingError) {
          console.warn("[trades] Backend indexing error", indexingError);
        }
        if (!response.ok) {
          const body = await response.text();
          console.error("[trades] Failed to load trades", response.status, body);
          return [];
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
          console.error("[trades] Unexpected trades payload", data);
          return [];
        }
        return data as Trade[];
      } catch (error) {
        console.error("[trades] Request failed", error);
        return [];
      }
    },
    refetchInterval: token?.marketType === "amm_pool" ? 15000 : false,
  });

  const [tradeTab, setTradeTab] = useState<"buy" | "sell">("buy");
  const [tradeInputAmount, setTradeInputAmount] = useState("");
  const [tradeOutputAmount, setTradeOutputAmount] = useState("");
  const walletAddress = state.status === "connected" ? state.address : undefined;
  const market = useTokenMarket(token, walletAddress);
  const trade = useTokenTrade();

  const usdcBalance =
    state.status === "connected" && state.isArcTestnet
      ? formatBalance(state.usdcBalance)
      : state.status === "connected"
      ? "—"
      : null;
  const numericUsdcBalance =
    usdcBalance !== null && Number.isFinite(Number(usdcBalance)) ? Number(usdcBalance) : null;

  if (tokenLoading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
      <div className="p-8 text-center text-muted-foreground">
        Token not found. rug pulled?
      </div>
    );
  }

  const isPositive = token.change24h >= 0;
  const displayedPrice = market.price ?? token.price;
  const isTradingPending =
    trade.status.status === "quoting" ||
    trade.status.status === "approving" ||
    trade.status.status === "confirming";
  const activeBalance = tradeTab === "buy" ? usdcBalance : market.tokenBalance;
  const numericActiveBalance =
    activeBalance !== null && Number.isFinite(Number(activeBalance)) ? Number(activeBalance) : null;
  const poolTokenReserve = market.reserves
    ? formatBalance(formatUnits(market.reserves.baseReserve, market.tokenDecimals))
    : null;
  const poolUsdcReserve = market.reserves
    ? formatBalance(formatUnits(market.reserves.quoteReserve, 18))
    : null;
  const canTrade =
    state.status === "connected" &&
    state.isArcTestnet &&
    market.isTradeable &&
    market.reserves !== null &&
    Number(tradeInputAmount) > 0 &&
    !isTradingPending;

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
        const amountIn = parseUnits(amount, 18);
        const amountOut = calculateAmountOut(amountIn, market.reserves.quoteReserve, market.reserves.baseReserve);
        return formatSwapAmount(amountOut, market.tokenDecimals);
      }

      const amountIn = parseUnits(amount, market.tokenDecimals);
      const amountOut = calculateAmountOut(amountIn, market.reserves.baseReserve, market.reserves.quoteReserve);
      return formatSwapAmount(amountOut, 18);
    } catch {
      return "";
    }
  };

  const inputFromOutput = (amount: string) => {
    if (!market.reserves || !amount || Number(amount) <= 0) return "";
    try {
      if (tradeTab === "buy") {
        const amountOut = parseUnits(amount, market.tokenDecimals);
        const amountIn = calculateAmountIn(amountOut, market.reserves.quoteReserve, market.reserves.baseReserve);
        return formatSwapAmount(amountIn, 18);
      }

      const amountOut = parseUnits(amount, 18);
      const amountIn = calculateAmountIn(amountOut, market.reserves.baseReserve, market.reserves.quoteReserve);
      return formatSwapAmount(amountIn, market.tokenDecimals);
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
    const txHash = await trade.executeTrade({
      token,
      side: tradeTab,
      amount: tradeInputAmount,
      reserves: market.reserves,
      tokenDecimals: market.tokenDecimals,
      amm: market.amm,
    });

    if (!txHash) return;
    setTradeInputAmount("");
    setTradeOutputAmount("");
    await queryClient.invalidateQueries({ queryKey: tradesQueryKey });
    await Promise.all([market.refresh(), refreshWallet()]);
  };

  return (
    <div className="max-w-7xl mx-auto w-full p-4 flex flex-col lg:flex-row gap-6 pb-20">

      {/* Left Col: Chart & Info */}
      <div className="flex-1 flex flex-col gap-6">

        {/* Token Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <TokenLogo token={token} size="lg" />
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-tighter">
                ${token.ticker}
              </h1>
              <div className="text-muted-foreground">{token.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono font-bold">
              ${displayedPrice.toFixed(6)}
            </div>
            {market.price !== null && (
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                live pool price
              </div>
            )}
            <div
              className={`font-mono text-lg font-medium ${isPositive ? "text-primary" : "text-destructive"}`}
            >
              {isPositive ? "+" : ""}
              {token.change24h.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Chart */}
        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
            <CardTitle className="text-sm font-medium uppercase tracking-wider">
              Price Chart
            </CardTitle>
            <div className="flex gap-2">
              {["1H", "4H", "1D"].map((tf) => (
                <Button key={tf} variant="outline" size="sm" className="h-6 text-[10px]">
                  {tf}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0 h-[400px]">
            {chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={
                          isPositive
                            ? "hsl(var(--primary))"
                            : "hsl(var(--destructive))"
                        }
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={
                          isPositive
                            ? "hsl(var(--primary))"
                            : "hsl(var(--destructive))"
                        }
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(tick) =>
                      new Date(tick).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    }
                    hide
                  />
                  <YAxis domain={["auto", "auto"]} hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                    }}
                    itemStyle={{
                      color: "hsl(var(--foreground))",
                      fontFamily: "var(--font-mono)",
                    }}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={
                      isPositive
                        ? "hsl(var(--primary))"
                        : "hsl(var(--destructive))"
                    }
                    fillOpacity={1}
                    fill="url(#colorClose)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                No chart data
              </div>
            )}
          </CardContent>
        </Card>

        {/* Description & Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-2 text-muted-foreground">
              About
            </h3>
            <p className="text-sm leading-relaxed">{token.description}</p>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-2 text-muted-foreground">
              Info
            </h3>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creator</span>
                <span className="text-primary">
                  {formatAddress(token.creatorAddress)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(token.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Supply</span>
                <span>{formatCompactNumber(token.totalSupply)}</span>
              </div>
              {token.contractAddress && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground flex-shrink-0">Contract</span>
                  <a
                    href={`https://testnet.arcscan.app/address/${token.contractAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary truncate hover:underline flex items-center gap-1"
                    title={token.contractAddress}
                  >
                    {token.contractAddress.slice(0, 6)}...{token.contractAddress.slice(-4)}
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" className="flex-shrink-0"><path d="M6.5 1H11V5.5M11 1L5 7M2 3H1v8h8V9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </a>
                </div>
              )}
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground flex-shrink-0">Market</span>
                {token.marketType === "amm_pool" && token.pairAddress ? (
                  <a
                    href={`https://testnet.arcscan.app/address/${token.pairAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary truncate hover:underline"
                    title={token.pairAddress}
                  >
                    AMM Pool {token.pairAddress.slice(0, 6)}...{token.pairAddress.slice(-4)}
                  </a>
                ) : (
                  <span className="text-yellow-400">No liquidity pool</span>
                )}
              </div>
              {token.routerAddress && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground flex-shrink-0">Router</span>
                  <a
                    href={`https://testnet.arcscan.app/address/${token.routerAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary truncate hover:underline"
                    title={token.routerAddress}
                  >
                    {token.routerAddress.slice(0, 6)}...{token.routerAddress.slice(-4)}
                  </a>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              {token.website && (
                <Button variant="outline" size="sm" asChild>
                  <a href={token.website} target="_blank" rel="noreferrer">
                    Website
                  </a>
                </Button>
              )}
              {token.twitter && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://twitter.com/${token.twitter}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Twitter
                  </a>
                </Button>
              )}
              {token.telegram && (
                <Button variant="outline" size="sm" asChild>
                  <a href={token.telegram} target="_blank" rel="noreferrer">
                    Telegram
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Col: Terminal/Trade Panel */}
      <div className="w-full lg:w-[350px] flex flex-col gap-4">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatPanel label="Market Cap" value={`$${formatCompactNumber(token.marketCap)}`} />
          <StatPanel label="Volume 24h" value={`$${formatCompactNumber(token.volume24h)}`} />
          <StatPanel label="Holders" value={token.holders.toLocaleString()} />
          <StatPanel label="Transactions" value={token.txCount.toLocaleString()} />
        </div>

        {/* Trade Terminal */}
        <Card className="border-border bg-card/80 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg uppercase tracking-tight">
              Trade {token.ticker}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Buy / Sell tabs */}
            <div className="flex bg-secondary/50 p-1 rounded-md">
              <Button
                variant="ghost"
                onClick={() => {
                  setTradeTab("buy");
                  setTradeInputAmount("");
                  setTradeOutputAmount("");
                  trade.reset();
                }}
                className={`flex-1 h-8 text-xs font-bold transition-colors ${
                  tradeTab === "buy"
                    ? "bg-background shadow-sm text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
                data-testid="button-trade-buy"
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
                className={`flex-1 h-8 text-xs font-bold transition-colors ${
                  tradeTab === "sell"
                    ? "bg-background shadow-sm text-destructive"
                    : "text-muted-foreground hover:text-destructive"
                }`}
                data-testid="button-trade-sell"
              >
                Sell
              </Button>
            </div>

            {/* Quote inputs */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">
                  You pay ({tradeTab === "buy" ? "USDC" : token.ticker})
                </span>
                <span className="text-muted-foreground">
                  Balance:{" "}
                  {activeBalance !== null ? (
                    <span className="text-foreground font-medium">
                      {tradeTab === "buy" ? "$" : ""}{activeBalance}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={tradeInputAmount}
                  onChange={(e) => handleInputAmountChange(e.target.value)}
                  className="font-mono text-lg bg-background/50 h-12 pr-20"
                  data-testid="input-trade-amount"
                />
                <div className="absolute right-3 top-3 font-mono text-xs font-bold text-muted-foreground tracking-wider">
                  {tradeTab === "buy" ? "USDC" : token.ticker}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground">
                    You receive ({tradeTab === "buy" ? token.ticker : "USDC"})
                  </span>
                  <span className="text-muted-foreground">
                    reserve quote
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={tradeOutputAmount}
                    onChange={(e) => handleOutputAmountChange(e.target.value)}
                    className="font-mono text-lg bg-background/50 h-12 pr-20"
                    data-testid="input-trade-output-amount"
                  />
                  <div className="absolute right-3 top-3 font-mono text-xs font-bold text-muted-foreground tracking-wider">
                    {tradeTab === "buy" ? token.ticker : "USDC"}
                  </div>
                </div>
              </div>

              {/* Quick-fill buttons */}
              {activeBalance !== null && activeBalance !== "—" && (
                <div className="flex gap-1">
                  {[25, 50, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        if (numericActiveBalance !== null) {
                          handleInputAmountChange(formatBalance((numericActiveBalance * pct) / 100));
                        }
                      }}
                      className="flex-1 text-[10px] font-mono py-1 rounded bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      data-testid={`button-fill-${pct}`}
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    onClick={() => activeBalance && handleInputAmountChange(formatBalance(activeBalance))}
                    className="flex-1 text-[10px] font-mono py-1 rounded bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    data-testid="button-fill-max"
                  >
                    MAX
                  </button>
                </div>
              )}

              <div className="text-xs font-mono text-muted-foreground text-right">
                {market.reserves ? "Quote uses current pool reserves" : "Waiting for pool reserves"}
              </div>
              {market.error && (
                <div className="text-xs font-mono text-destructive text-right">
                  Market refresh failed: {market.error}
                </div>
              )}
              {trade.status.status === "error" && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive font-mono">
                  {trade.status.message}
                </div>
              )}
              {trade.status.status === "success" && (
                <a
                  href={`https://testnet.arcscan.app/tx/${trade.status.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-primary font-mono hover:underline"
                >
                  Swap confirmed. View transaction.
                </a>
              )}
            </div>

            {/* Connect wallet prompt or trade button */}
            {state.status !== "connected" ? (
              <div className="text-center text-xs text-muted-foreground font-mono py-2 border border-border/50 rounded-md bg-secondary/20">
                Connect wallet to trade
              </div>
            ) : !state.isArcTestnet ? (
              <div className="text-center text-xs text-yellow-400 font-mono py-2 border border-yellow-500/30 rounded-md bg-yellow-500/10">
                Switch to Arc Testnet to trade
              </div>
            ) : !market.isTradeable ? (
              <div className="text-center text-xs text-yellow-400 font-mono py-2 border border-yellow-500/30 rounded-md bg-yellow-500/10">
                Liquidity pool required before trading
              </div>
            ) : (
              <Button
                className="w-full font-bold uppercase tracking-wider h-12 text-black"
                size="lg"
                data-testid="button-place-trade"
                disabled={!canTrade}
                onClick={handleTrade}
              >
                {isTradingPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {trade.status.status === "approving" ? "Approving..." : "Confirming..."}
                  </span>
                ) : (
                  `${tradeTab === "buy" ? "Buy" : "Sell"} ${token.ticker}`
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Pool Reserves */}
        <Card className="border-border bg-card/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-xs font-mono uppercase">
              <span className="text-muted-foreground">TOKEN/WUSDC Pool</span>
              <span className={market.isTradeable ? "text-primary font-bold" : "text-yellow-400 font-bold"}>
                {market.isTradeable ? "Live" : "Unlisted"}
              </span>
            </div>
            {market.isTradeable && poolTokenReserve && poolUsdcReserve ? (
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{token.ticker}</span>
                  <span>{poolTokenReserve}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WUSDC</span>
                  <span>{poolUsdcReserve}</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-2 mt-2">
                  <span className="text-muted-foreground">Price</span>
                  <span className="text-primary">${displayedPrice.toFixed(6)}</span>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground text-center">
                Create a liquidity pool before real swaps are available.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider">Recent Trades</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tradesLoading ? (
              <div className="p-4 text-xs font-mono text-muted-foreground">Indexing swaps...</div>
            ) : tradesError ? (
              <div className="p-4 text-xs font-mono text-destructive">Could not load trades.</div>
            ) : trades.length > 0 ? (
              <div className="divide-y divide-border/50">
                {trades.slice(0, 8).map((tradeItem) => (
                  <a
                    key={tradeItem.id}
                    href={`https://testnet.arcscan.app/tx/${tradeItem.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="grid grid-cols-[56px_1fr] gap-3 p-3 text-xs font-mono hover:bg-secondary/30 transition-colors"
                  >
                    <span className={tradeItem.side === "buy" ? "text-primary font-bold uppercase" : "text-destructive font-bold uppercase"}>
                      {tradeItem.side}
                    </span>
                    <span className="min-w-0 space-y-1">
                      <span className="flex justify-between gap-2">
                        <span className="truncate">{formatBalance(tradeItem.tokenAmount)} {token.ticker}</span>
                        <span className="text-muted-foreground">${formatBalance(tradeItem.wusdcAmount)}</span>
                      </span>
                      <span className="flex justify-between gap-2 text-[10px] text-muted-foreground">
                        <span className="truncate">{formatAddress(tradeItem.traderAddress)}</span>
                        <span>${tradeItem.executionPrice.toFixed(6)}</span>
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="p-4 text-xs font-mono text-muted-foreground">
                No on-chain swaps indexed yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card/50 border border-border p-3 rounded-lg flex flex-col">
      <span className="text-[10px] uppercase text-muted-foreground tracking-wider">
        {label}
      </span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}
