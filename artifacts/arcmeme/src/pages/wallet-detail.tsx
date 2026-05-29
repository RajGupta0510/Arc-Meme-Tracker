import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Bookmark, 
  BookmarkCheck,
  Copy, 
  Check, 
  DollarSign, 
  ExternalLink,
  ArrowLeft,
  PieChart,
  Grid
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { formatAddress } from "@/lib/utils";
import { useWallet } from "@/hooks/use-wallet";

type WalletHoldings = {
  tokenId: string;
  ticker: string;
  name: string;
  logoColor: string;
  balance: number;
  value: number;
  avgEntry: number;
  realizedPnl: number;
};

type WalletTrade = {
  id: string;
  tokenId: string;
  pairAddress: string;
  txHash: string;
  side: "buy" | "sell";
  tokenAmount: number;
  wusdcAmount: number;
  executionPrice: number;
  traderAddress: string;
  timestamp: string;
};

type WalletAnalytics = {
  address: string;
  realizedPnl: number;
  winRate: number;
  volume: number;
  tradesCount: number;
  holdings: WalletHoldings[];
  trades: WalletTrade[];
};

export function WalletDetailPage() {
  const { address } = useParams<{ address: string }>();
  const { toast } = useToast();
  const { state: walletState } = useWallet();
  const [copied, setCopied] = useState(false);
  const [followedWallets, setFollowedWallets] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("followed_wallets") || "[]");
    } catch {
      return [];
    }
  });

  const isFollowed = address ? followedWallets.includes(address) : false;

  const { data: analytics, isLoading, isError } = useQuery<WalletAnalytics>({
    queryKey: [`/api/wallet/${address}`, address],
    queryFn: async () => {
      const res = await fetch(`/api/wallet/${encodeURIComponent(address!)}`);
      if (!res.ok) throw new Error("Failed to fetch wallet analytics");
      return res.json();
    },
    enabled: !!address,
    refetchInterval: 15000,
  });

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast({
      title: "Address Copied",
      description: "Wallet address copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFollowToggle = async () => {
    if (!address) return;
    const userAddr = walletState.status === "connected" ? walletState.address : null;

    let updated: string[];
    if (isFollowed) {
      updated = followedWallets.filter(a => a !== address);
      if (userAddr) {
        try {
          await fetch(`/api/copytrade/targets/${userAddr}/${address}`, {
            method: "DELETE",
          });
        } catch (err) {
          console.error(err);
        }
      }
      toast({
        title: "Wallet Unfollowed",
        description: `Removed ${formatAddress(address)} from copytrade watch.`,
      });
    } else {
      updated = [...followedWallets, address];
      if (userAddr) {
        try {
          await fetch(`/api/copytrade/targets/${userAddr}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetAddress: address,
              allocationUsdc: 25.0,
              maxSlippage: 1.0,
              isActive: 1,
            }),
          });
        } catch (err) {
          console.error(err);
        }
      }
      toast({
        title: "Wallet Bookmarked",
        description: `Now following ${formatAddress(address)} for copytrade events!`,
      });
    }
    setFollowedWallets(updated);
    localStorage.setItem("followed_wallets", JSON.stringify(updated));
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <div className="font-mono text-xs text-primary tracking-widest uppercase animate-pulse">Syncing Wallet Telemetry...</div>
      </div>
    );
  }

  if (isError || !analytics) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-4 p-4 text-center">
        <div className="text-destructive font-mono text-lg font-bold">ERROR SECURE SYNC FAILURE</div>
        <p className="text-muted-foreground text-sm max-w-sm">Failed to retrieve real-time wallet analytics for this address.</p>
        <Link href="/leaderboard">
          <Button variant="outline" className="border-border gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Leaderboard
          </Button>
        </Link>
      </div>
    );
  }

  const pnlIsPositive = analytics.realizedPnl >= 0;

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 bg-background relative overflow-hidden font-mono text-xs">
      {/* Glow Rings */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Breadcrumb / Top Row */}
      <div className="flex items-center justify-between border-b border-border/80 pb-5 relative z-10">
        <div className="flex items-center gap-4">
          <Link href="/leaderboard">
            <Button size="sm" variant="ghost" className="h-8 p-0 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Arena
            </Button>
          </Link>
          
          <div className="h-4 w-[1px] bg-border/80 hidden sm:block" />
          
          <div className="hidden sm:flex items-center gap-2 text-primary uppercase text-[10px] tracking-widest">
            <Wallet className="h-3.5 w-3.5" />
            Wallet Telemetry Card
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleFollowToggle}
          variant={isFollowed ? "default" : "outline"}
          className={`h-8 gap-1.5 ${
            isFollowed
              ? "bg-primary text-black hover:bg-primary/80 border-primary shadow-[0_0_12px_rgba(34,197,94,0.3)] font-extrabold"
              : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          {isFollowed ? <BookmarkCheck className="h-4 w-4 fill-black" /> : <Bookmark className="h-4 w-4" />}
          {isFollowed ? "Copytrading Armed" : "Bookmark Wallet"}
        </Button>
      </div>

      {/* Profile Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/20 border border-border/60 p-6 rounded-lg relative z-10 backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full border-2 border-primary/40 bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_20px_rgba(34,197,94,0.12)]">
            <Wallet className="h-7 w-7" />
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">SMART ADDRESS INDEX</div>
            <h2 className="text-lg md:text-xl font-black text-foreground flex items-center gap-2 mt-1">
              <span>{analytics.address}</span>
              <button 
                onClick={handleCopy}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                title="Copy Address"
              >
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </button>
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-muted-foreground text-[10px]">REAL-TIME INDEXED TELEMETRY STREAM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 relative z-10">
        <Card className="border-border/80 bg-card/30 backdrop-blur-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-muted-foreground uppercase text-[10px]">
              <span>Realized profit</span>
              {pnlIsPositive ? <TrendingUp className="h-4 w-4 text-primary" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
            </div>
            <div className={`mt-3 text-2xl font-black ${pnlIsPositive ? "text-primary shadow-glow-green" : "text-destructive"}`}>
              {pnlIsPositive ? "+" : ""}${analytics.realizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">Cumulative PnL recorded</div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/30 backdrop-blur-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-muted-foreground uppercase text-[10px]">
              <span>Win Rate %</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 text-2xl font-black text-foreground">
              {analytics.winRate}%
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">Ratio of positive closed swaps</div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/30 backdrop-blur-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-muted-foreground uppercase text-[10px]">
              <span>Total Volume</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 text-2xl font-black text-foreground">
              ${analytics.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">USDC volume swapped</div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/30 backdrop-blur-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-muted-foreground uppercase text-[10px]">
              <span>Closed Swaps</span>
              <Grid className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 text-2xl font-black text-foreground">
              {analytics.tradesCount}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">Trades indexed across pool lifecycle</div>
          </CardContent>
        </Card>
      </div>

      {/* Holdings Section */}
      <div className="grid gap-8 lg:grid-cols-3 relative z-10">
        
        {/* Holdings Table */}
        <Card className="lg:col-span-2 border-border/80 bg-card/30 backdrop-blur-lg overflow-hidden">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              CURRENT HOLDINGS DISTRIBUTION
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {analytics.holdings.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs uppercase font-semibold">
                No active token holdings detected
              </div>
            ) : (
              <table className="w-full text-left border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground bg-card/40">
                    <th className="py-3 px-4">TOKEN</th>
                    <th className="py-3 px-4 text-right">BALANCE</th>
                    <th className="py-3 px-4 text-right">AVG ENTRY PRICE</th>
                    <th className="py-3 px-4 text-right">REALIZED PNL</th>
                    <th className="py-3 px-4 text-right text-primary">HOLDINGS VALUE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {analytics.holdings.map((hold) => (
                    <tr key={hold.tokenId} className="hover:bg-primary/5 transition-colors">
                      <td className="py-3 px-4 font-bold">
                        <Link href={`/token/${hold.tokenId}`} className="hover:text-primary transition-colors flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full inline-block" 
                            style={{ backgroundColor: hold.logoColor }}
                          />
                          <span>{hold.name}</span>
                          <span className="text-muted-foreground font-normal">(${hold.ticker})</span>
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {hold.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-muted-foreground">
                        ${hold.avgEntry.toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 8 })}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        <span className={hold.realizedPnl >= 0 ? "text-primary" : "text-destructive"}>
                          {hold.realizedPnl >= 0 ? "+" : ""}${hold.realizedPnl.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-primary">
                        ${hold.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Recent Swap Logs */}
        <Card className="border-border/80 bg-card/30 backdrop-blur-lg overflow-hidden">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              RECENT SWAP LOGS
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto max-h-[400px] divide-y divide-border/60">
            {analytics.trades.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs uppercase font-semibold">
                No swaps recorded for this wallet
              </div>
            ) : (
              analytics.trades.map((t) => {
                const isBuy = t.side === "buy";
                return (
                  <div key={t.id} className="p-4 hover:bg-primary/5 transition-colors space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isBuy 
                          ? "bg-primary/10 border-primary/20 text-primary" 
                          : "bg-destructive/10 border-destructive/20 text-destructive"
                      }`}>
                        {t.side.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-bold">
                        {t.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} $ARC-TOKEN
                      </span>
                      <span className="text-muted-foreground">
                        {t.wusdcAmount.toFixed(2)} USDC
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Price: ${t.executionPrice.toLocaleString(undefined, { minimumFractionDigits: 8 })}</span>
                      <a 
                        href={`https://explorer.arc.network/tx/${t.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-primary flex items-center gap-0.5"
                      >
                        Tx <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
