import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Trophy, 
  TrendingUp, 
  Activity, 
  UserCheck, 
  Copy, 
  ExternalLink,
  ShieldAlert,
  Zap,
  Bookmark,
  ArrowUpRight,
  TrendingDown
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { formatAddress } from "@/lib/utils";

type LeaderboardEntry = {
  address: string;
  realizedPnl: number;
  winRate: number;
  tradesCount: number;
  volume: number;
  rank: number;
  type: "whale" | "degen" | "lp_giant";
};

export function LeaderboardPage() {
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [followedWallets, setFollowedWallets] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("followed_wallets") || "[]");
    } catch {
      return [];
    }
  });

  const { data: leaderboard = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const handleCopy = (address: string, index: number) => {
    navigator.clipboard.writeText(address);
    setCopiedIndex(index);
    toast({
      title: "Address Copied",
      description: `Copied ${formatAddress(address)} to clipboard.`,
    });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleFollowToggle = (address: string) => {
    let updated: string[];
    if (followedWallets.includes(address)) {
      updated = followedWallets.filter(a => a !== address);
      toast({
        title: "Wallet Unfollowed",
        description: `Removed ${formatAddress(address)} from copytrade watch.`,
      });
    } else {
      updated = [...followedWallets, address];
      toast({
        title: "Wallet Bookmarked",
        description: `Now following ${formatAddress(address)} for copytrade events!`,
      });
    }
    setFollowedWallets(updated);
    localStorage.setItem("followed_wallets", JSON.stringify(updated));
  };

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 bg-background relative overflow-hidden">
      {/* Abstract Background Cyber Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/80 pb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-widest mb-1">
            <Trophy className="h-4 w-4 animate-pulse" />
            Arc Trading Arena
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">
            DEGEN LEADERBOARD
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl mt-1">
            Track top-performing smart money wallets, high-frequency traders, and meme pool snipers on the Arc blockchain.
          </p>
        </div>
        
        {/* Arena Telemetry */}
        <div className="flex items-center gap-4 bg-card/40 border border-primary/20 backdrop-blur-md px-4 py-3 rounded-lg font-mono text-xs text-primary shadow-[0_0_20px_rgba(34,197,94,0.06)]">
          <Zap className="h-4 w-4 text-primary animate-bounce" />
          <div>
            <div className="text-muted-foreground text-[10px] uppercase">STATUS</div>
            <div className="font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              LIVE TELEMETRY
            </div>
          </div>
        </div>
      </div>

      {/* Arena Highlights */}
      <div className="grid gap-6 md:grid-cols-3 relative z-10">
        <Card className="border-primary/10 bg-card/30 backdrop-blur-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground uppercase">Top Earner</span>
              <Trophy className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="mt-3 text-2xl font-black text-primary font-mono">+$98,400.50</div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              0x1a2e3f4b5c...e0f <span className="text-primary font-bold">(91% WR)</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-card/30 backdrop-blur-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground uppercase">Most Active</span>
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-3 text-2xl font-black text-foreground font-mono">142 Trades</div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              0x7a250d5630...88d <span className="text-primary font-bold">($85.4K VOL)</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-card/30 backdrop-blur-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground uppercase">LP Giant</span>
              <UserCheck className="h-5 w-5 text-blue-400" />
            </div>
            <div className="mt-3 text-2xl font-black text-blue-400 font-mono">+$28,150.00</div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              0xbb9bc244d7...413 <span className="text-blue-400 font-bold">(POOL LP)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard Table Container */}
      <Card className="border-border/80 bg-card/30 backdrop-blur-lg shadow-[0_4px_30px_rgba(0,0,0,0.3)] overflow-hidden relative z-10">
        <CardHeader className="border-b border-border/70 py-4">
          <CardTitle className="font-mono text-xs uppercase text-muted-foreground flex items-center justify-between">
            <span>Rankings sorted by PnL</span>
            <span>Update Interval: 15s</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <div className="font-mono text-xs text-primary tracking-widest uppercase animate-pulse">Syncing Arena...</div>
            </div>
          ) : (
            <table className="w-full min-w-[900px] text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-border/80 text-muted-foreground bg-card/60">
                  <th className="py-4 px-6 text-center w-16">RANK</th>
                  <th className="py-4 px-6">TRADER / SMART ADDRESS</th>
                  <th className="py-4 px-6 text-center">TYPE</th>
                  <th className="py-4 px-6 text-right">TOTAL VOLUME</th>
                  <th className="py-4 px-6 text-center">TRADES</th>
                  <th className="py-4 px-6 text-center">WIN RATE</th>
                  <th className="py-4 px-6 text-right text-primary">REALIZED PNL</th>
                  <th className="py-4 px-6 text-center w-40">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {leaderboard.map((entry, index) => {
                  const isFollowed = followedWallets.includes(entry.address);
                  const isTop3 = entry.rank <= 3;
                  const rankColors = [
                    "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
                    "bg-zinc-300/10 text-zinc-300 border-zinc-400/30",
                    "bg-amber-600/10 text-amber-500 border-amber-600/30"
                  ];

                  return (
                    <tr 
                      key={entry.address} 
                      className="hover:bg-primary/5 transition-colors group/row"
                    >
                      {/* Rank Column */}
                      <td className="py-4 px-6 text-center font-bold">
                        {isTop3 ? (
                          <div className={`mx-auto w-8 h-8 rounded-full border flex items-center justify-center text-sm ${rankColors[entry.rank - 1]} shadow-[0_0_12px_rgba(0,0,0,0.2)]`}>
                            {entry.rank}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">{entry.rank}</span>
                        )}
                      </td>

                      {/* Address Column */}
                      <td className="py-4 px-6 font-bold">
                        <div className="flex items-center gap-2">
                          <Link 
                            href={`/wallet/${entry.address}`}
                            className="hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            <span>{formatAddress(entry.address)}</span>
                            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover/row:opacity-100 transition-opacity text-primary" />
                          </Link>
                          <button
                            onClick={() => handleCopy(entry.address, index)}
                            className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                            title="Copy Wallet Address"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* Trader Type */}
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded text-[10px] uppercase font-bold border ${
                          entry.type === "whale" 
                            ? "bg-purple-950/40 border-purple-500/30 text-purple-400"
                            : entry.type === "lp_giant"
                            ? "bg-blue-950/40 border-blue-500/30 text-blue-400"
                            : "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                        }`}>
                          {entry.type}
                        </span>
                      </td>

                      {/* Total Volume */}
                      <td className="py-4 px-6 text-right font-semibold text-foreground">
                        ${entry.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Trades Count */}
                      <td className="py-4 px-6 text-center text-foreground font-semibold">
                        {entry.tradesCount}
                      </td>

                      {/* Win Rate */}
                      <td className="py-4 px-6 text-center font-bold text-foreground">
                        <div className="flex items-center justify-center gap-1">
                          <span>{entry.winRate}%</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        </div>
                      </td>

                      {/* Realized PnL */}
                      <td className="py-4 px-6 text-right font-black text-sm">
                        <span className={entry.realizedPnl >= 0 ? "text-primary shadow-glow-green" : "text-destructive"}>
                          {entry.realizedPnl >= 0 ? "+" : ""}${entry.realizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link href={`/wallet/${entry.address}`}>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 border-border hover:border-primary/40 hover:bg-primary/10 hover:text-primary gap-1"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View
                            </Button>
                          </Link>
                          
                          <Button
                            size="sm"
                            onClick={() => handleFollowToggle(entry.address)}
                            variant={isFollowed ? "default" : "outline"}
                            className={`h-8 gap-1 ${
                              isFollowed 
                                ? "bg-primary text-black hover:bg-primary/80 border-primary shadow-[0_0_12px_rgba(34,197,94,0.3)] font-extrabold"
                                : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Bookmark className={`h-3.5 w-3.5 ${isFollowed ? "fill-black" : ""}`} />
                            {isFollowed ? "Armed" : "Track"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
