import { Link } from "wouter";
import { useState, useEffect } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useWallet } from "@/hooks/use-wallet";
import { ListTokensSort, getListTokensQueryKey, useListTokens } from "@workspace/api-client-react";
import { formatCompactNumber } from "@/lib/utils";
import { 
  Activity, 
  Bell, 
  Menu, 
  PlusCircle, 
  Radar, 
  Star,
  Wallet,
  LogOut,
  PieChart,
  Copy,
  ExternalLink,
  ChevronDown,
  Check,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type AlertRule = {
  id: string;
  tokenId: string;
  ticker: string;
  metric: "price_above" | "price_below" | "volume_spike" | "liquidity_change" | "whale_swap";
  target: number;
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

export function Navbar() {
  const { state, connect, disconnect, switchToArcTestnet, getShortAddress } = useWallet();

  const isConnected = state.status === "connected";
  const isConnecting = state.status === "connecting";
  const hasError = state.status === "error";

  return (
    <div className="w-full flex flex-col border-b border-border/80 bg-background/82 backdrop-blur-xl sticky top-0 z-50">
      <div className="flex h-16 items-center px-4 w-full justify-between">
        <Link href="/" className="lg:hidden flex items-center gap-2 text-primary font-bold text-xl tracking-tighter">
          <Radar className="h-5 w-5" />
          ArcMeme
        </Link>
        <div className="hidden lg:flex items-center gap-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Arc Testnet</div>
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
          <div className="font-mono text-xs text-primary">Live terminal</div>
        </div>

        <div className="flex items-center gap-6">
          <MarketUtilityDrawers />
          <Button asChild size="sm" className="hidden sm:inline-flex gap-2 font-mono text-xs uppercase text-black">
            <Link href="/launch"><PlusCircle className="h-3.5 w-3.5" /> Launch Token</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground hover:text-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-border bg-background/95 p-0 backdrop-blur-xl flex flex-col h-full z-[100]">
              <div className="flex h-16 items-center gap-3 border-b border-border/70 px-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary shadow-[0_0_24px_rgba(34,197,94,0.16)]">
                  <Radar className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-extrabold tracking-tight text-primary">ArcMeme</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Market OS</div>
                </div>
              </div>
              
              <nav className="flex flex-col gap-1.5 p-4 flex-1">
                <Link href="/" className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground transition-all">
                  <Activity className="h-4 w-4" />
                  <span className="font-semibold">Terminal</span>
                </Link>
                <Link href="/portfolio" className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground transition-all">
                  <Wallet className="h-4 w-4" />
                  <span className="font-semibold">Portfolio</span>
                </Link>
                <Link href="/launch" className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground transition-all">
                  <PlusCircle className="h-4 w-4" />
                  <span className="font-semibold">Launch Token</span>
                </Link>
              </nav>

              <div className="p-4 border-t border-border/70">
                <div className="rounded-lg bg-primary/10 p-3 font-mono text-[11px] leading-relaxed text-primary/90">
                  Real launched tokens only. Fast filters, live pools, and on-chain trade history.
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <WalletButton
            state={state}
            isConnected={isConnected}
            isConnecting={isConnecting}
            hasError={hasError}
            onConnect={connect}
            onDisconnect={disconnect}
            onSwitchNetwork={switchToArcTestnet}
            getShortAddress={getShortAddress}
          />
        </div>
      </div>

      {hasError && state.status === "error" && (
        <div className="bg-destructive/10 border-t border-destructive/30 text-destructive text-xs text-center py-1 px-4 font-mono">
          {state.message}
        </div>
      )}

      {isConnected && state.status === "connected" && !state.isArcTestnet && (
        <div
          className="bg-yellow-500/10 border-t border-yellow-500/30 text-yellow-400 text-xs text-center py-1 px-4 font-mono cursor-pointer hover:bg-yellow-500/20 transition-colors"
          onClick={switchToArcTestnet}
          data-testid="banner-wrong-network"
        >
          Wrong network — click to switch to Arc Network Testnet
        </div>
      )}

      <TickerTape />
    </div>
  );
}

function MarketUtilityDrawers() {
  const { toast } = useToast();
  const { data: tokens = [] } = useListTokens(
    { sort: ListTokensSort.newest, limit: 100 },
    {
      query: {
        queryKey: getListTokensQueryKey({ sort: ListTokensSort.newest, limit: 100 }),
        refetchInterval: 15000,
      },
    },
  );
  const [watchlist, setWatchlist] = useState<string[]>(() => readJson("arcmeme.watchlist", []));
  const [alerts, setAlerts] = useState<AlertRule[]>(() => readJson("arcmeme.alerts", []));
  const [notifiedAlerts, setNotifiedAlerts] = useState<string[]>(() => readJson("arcmeme.notifiedAlerts", []));

  const refreshLocalState = () => {
    setWatchlist(readJson("arcmeme.watchlist", []));
    setAlerts(readJson("arcmeme.alerts", []));
    setNotifiedAlerts(readJson("arcmeme.notifiedAlerts", []));
  };

  const watchedTokens = tokens.filter((token) => watchlist.includes(token.id));
  const activity = tokens.slice(0, 12);

  // Global Price & Vol Alert Checker
  useEffect(() => {
    if (tokens.length === 0 || alerts.length === 0) return;

    const triggered = alerts.filter((alert) => {
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

    const fresh = triggered.filter((alert) => !notifiedAlerts.includes(alert.id));
    if (fresh.length === 0) return;

    fresh.forEach((alert) => {
      let label = "";
      if (alert.metric === "price_above") label = "Price rose above";
      if (alert.metric === "price_below") label = "Price dropped below";
      if (alert.metric === "volume_spike") label = "24h Volume exceeded";
      if (alert.metric === "liquidity_change") label = "Liquidity exceeded";

      toast({
        title: `ALERT TRIGGERED: $${alert.ticker}`,
        description: `${label} target of $${alert.target.toLocaleString()}`,
        variant: "default",
      });

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`ArcMeme Alert: $${alert.ticker}`, {
          body: `${label} target of $${alert.target.toLocaleString()}`,
        });
      }
    });

    setNotifiedAlerts((current) => {
      const next = [...new Set([...current, ...fresh.map((alert) => alert.id)])];
      window.localStorage.setItem("arcmeme.notifiedAlerts", JSON.stringify(next));
      return next;
    });
  }, [tokens, alerts, notifiedAlerts, toast]);

  return (
    <div className="hidden sm:flex items-center gap-1">
      <UtilityDrawer icon={<Star className="h-4 w-4" />} title="Watchlist" onOpen={refreshLocalState}>
        <div className="space-y-2">
          {watchedTokens.length === 0 ? (
            <EmptyDrawerState text="Star tokens in the terminal to pin them here." />
          ) : watchedTokens.map((token) => (
            <Link key={token.id} href={`/token/${token.id}`} className="flex items-center justify-between rounded-md border border-border bg-background/40 p-3 transition-colors hover:border-primary/50">
              <span className="font-bold" style={{ color: token.logoColor || "#22c55e" }}>${token.ticker}</span>
              <span className="font-mono text-xs text-primary">${token.price.toFixed(6)}</span>
            </Link>
          ))}
        </div>
      </UtilityDrawer>

      <UtilityDrawer icon={<Bell className="h-4 w-4" />} title="Alerts" onOpen={refreshLocalState}>
        <div className="space-y-2 max-h-[380px] overflow-y-auto hide-scrollbar">
          {alerts.length === 0 ? (
            <EmptyDrawerState text="Create Price, Vol, or Liquidity alerts from the terminal toolbar." />
          ) : alerts.map((alert) => {
            const triggered = notifiedAlerts.includes(alert.id);
            let metricName = "";
            if (alert.metric === "price_above") metricName = "Price Above";
            if (alert.metric === "price_below") metricName = "Price Below";
            if (alert.metric === "volume_spike") metricName = "Vol Spike";
            if (alert.metric === "liquidity_change") metricName = "Liquidity";
            if (alert.metric === "whale_swap") metricName = "Whale Swap";

            return (
              <button
                key={alert.id}
                onClick={() => {
                  const next = alerts.filter((item) => item.id !== alert.id);
                  setAlerts(next);
                  window.localStorage.setItem("arcmeme.alerts", JSON.stringify(next));
                }}
                className="w-full rounded-md border border-border bg-background/40 p-3 text-left transition-colors hover:border-destructive/50"
              >
                <div className="flex justify-between font-mono text-xs">
                  <span>${alert.ticker} ({metricName})</span>
                  <span className={triggered ? "text-primary" : "text-muted-foreground"}>
                    ${alert.target.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5 flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                  <span>{triggered ? "Triggered" : "Active"}</span>
                  <span className="text-[9px] hover:text-destructive">Click to remove</span>
                </div>
              </button>
            );
          })}
        </div>
      </UtilityDrawer>

      <UtilityDrawer icon={<Activity className="h-4 w-4" />} title="Live Activity" onOpen={refreshLocalState}>
        <div className="space-y-2">
          {activity.length === 0 ? (
            <EmptyDrawerState text="No launched token activity yet." />
          ) : activity.map((token) => (
            <Link key={token.id} href={`/token/${token.id}`} className="block rounded-md border border-border bg-background/40 p-3 transition-colors hover:border-primary/50">
              <div className="flex items-center justify-between">
                <span className="font-bold" style={{ color: token.logoColor || "#22c55e" }}>${token.ticker}</span>
                <span className={`font-mono text-[10px] uppercase ${token.marketType === "amm_pool" ? "text-primary" : "text-yellow-400"}`}>
                  {token.marketType === "amm_pool" ? "Pool live" : "Needs pool"}
                </span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">Vol ${formatCompactNumber(token.volume24h)} · Tx {token.txCount}</div>
            </Link>
          ))}
        </div>
      </UtilityDrawer>
    </div>
  );
}

function UtilityDrawer({
  icon,
  title,
  children,
  onOpen,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <Sheet onOpenChange={(open) => open && onOpen()}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary">
          {icon}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[360px] border-border bg-background/95 p-4 backdrop-blur-xl sm:max-w-[420px]">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-mono text-sm uppercase tracking-widest text-primary">{title}</SheetTitle>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

function EmptyDrawerState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-4 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

type WalletButtonProps = {
  state: ReturnType<typeof useWallet>["state"];
  isConnected: boolean;
  isConnecting: boolean;
  hasError: boolean;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
  onSwitchNetwork: () => Promise<void>;
  getShortAddress: (address: string) => string;
};

function getAddressGradient(address: string) {
  if (!address) return "linear-gradient(135deg, #22c55e 0%, #15803d 100%)";
  const clean = address.replace("0x", "");
  const h1 = parseInt(clean.slice(0, 4), 16) % 360;
  const h2 = parseInt(clean.slice(4, 8), 16) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 85%, 60%) 0%, hsl(${h2}, 85%, 45%) 100%)`;
}

function WalletButton({
  state,
  isConnected,
  isConnecting,
  hasError,
  onConnect,
  onDisconnect,
  onSwitchNetwork,
  getShortAddress,
}: WalletButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (state.status === "connected") {
      navigator.clipboard.writeText(state.address);
      setCopied(true);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isConnecting) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="font-mono text-xs border-primary/30 bg-primary/5 text-primary gap-2 h-9 px-4 rounded-lg animate-pulse"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Connecting...
      </Button>
    );
  }

  if (isConnected && state.status === "connected") {
    const isWrongNetwork = !state.isArcTestnet;
    const gradient = getAddressGradient(state.address);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/80 bg-black/40 backdrop-blur-md hover:border-primary/50 transition-all font-mono text-xs text-foreground outline-none group"
            data-testid="button-connected-wallet"
          >
            {/* Status dot */}
            <div className={`h-2 w-2 rounded-full ${isWrongNetwork ? "bg-yellow-500 animate-pulse" : "bg-primary shadow-[0_0_8px_hsl(var(--primary))]"}`} />
            
            {/* Balance */}
            <span className="text-muted-foreground hidden md:inline border-r border-border/60 pr-2 mr-0.5 font-bold">
              {state.usdcBalance} USDC
            </span>

            {/* Truncated Address */}
            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {getShortAddress(state.address)}
            </span>

            {/* Personalized Gradient Avatar */}
            <div
              className="h-5 w-5 rounded-full border border-border/60 shrink-0"
              style={{ background: gradient }}
            />
            
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 border-border bg-card/95 backdrop-blur-xl p-2" align="end">
          <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
            Active Session
          </DropdownMenuLabel>
          
          <div className="px-2 py-2 flex flex-col gap-1 bg-background/50 border border-border/50 rounded-md mb-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-muted-foreground">Address</span>
              <button 
                onClick={handleCopy}
                className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded"
                title="Copy Address"
              >
                {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <span className="font-mono text-xs text-foreground select-all break-all leading-tight">
              {state.address}
            </span>
            
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
              <span className="font-mono text-[11px] text-muted-foreground">USDC Balance</span>
              <span className="font-mono text-xs font-bold text-primary">{state.usdcBalance} USDC</span>
            </div>
          </div>

          <DropdownMenuItem asChild>
            <Link href="/portfolio" className="flex w-full items-center gap-2 cursor-pointer font-mono text-xs py-2 px-2 hover:bg-primary/10 hover:text-primary text-foreground rounded transition-all">
              <PieChart className="h-3.5 w-3.5" />
              <span>Wallet Portfolio</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <a 
              href={`https://testnet.arcscan.app/address/${state.address}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 cursor-pointer font-mono text-xs py-2 px-2 hover:bg-primary/10 hover:text-primary text-foreground rounded transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>View Explorer</span>
            </a>
          </DropdownMenuItem>

          {isWrongNetwork && (
            <DropdownMenuItem 
              onClick={onSwitchNetwork}
              className="flex items-center gap-2 cursor-pointer font-mono text-xs py-2 px-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded transition-all mt-1"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>Switch to Arc Testnet</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="bg-border/60 my-1.5" />

          <DropdownMenuItem 
            onClick={onDisconnect}
            className="flex items-center gap-2 cursor-pointer font-mono text-xs py-2 px-2 text-destructive hover:bg-destructive/10 rounded transition-all"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Disconnect Session</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Disconnected state
  return (
    <Button
      onClick={onConnect}
      className="font-mono text-xs uppercase text-black font-bold tracking-wider hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all h-9 rounded-lg"
      data-testid="button-connect-wallet"
    >
      <Wallet className="h-3.5 w-3.5 mr-1.5" />
      Connect Wallet
    </Button>
  );
}

function TickerTape() {
  const { data: items = [] } = useListTokens(
    { sort: ListTokensSort.newest, limit: 12 },
    {
      query: {
        queryKey: getListTokensQueryKey({ sort: ListTokensSort.newest, limit: 12 }),
        refetchInterval: 15000,
      },
    },
  );

  if (items.length === 0) return null;

  return (
    <div className="w-full bg-black/50 border-t border-border overflow-hidden h-8 flex items-center">
      <div className="flex animate-[ticker_20s_linear_infinite] whitespace-nowrap min-w-full">
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-6 font-mono text-xs">
            <span className="font-bold text-muted-foreground">{item.ticker}</span>
            <span>${item.price.toFixed(6)}</span>
            <span className={item.marketType === "amm_pool" ? "text-primary" : "text-yellow-400"}>
              {item.marketType === "amm_pool" ? "POOL" : "NEW"}
            </span>
            <span className="text-muted-foreground">
              ${formatCompactNumber(item.volume24h)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
