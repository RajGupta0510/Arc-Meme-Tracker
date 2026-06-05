import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useWallet } from "@/hooks/use-wallet";
import { useAudioTelemetry } from "@/hooks/use-audio-telemetry";
import { ListTokensSort, getListTokensQueryKey, useListTokens, type Token } from "@workspace/api-client-react";
import { useLiveTokenData } from "@/hooks/use-live-token-data";
import { formatCompactNumber, formatPrice } from "@/lib/utils";
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
  Droplet,
  ExternalLink,
  ChevronDown,
  Check,
  Loader2,
  Volume2,
  VolumeX,
  Trophy,
  WalletCards,
  BookOpen,
  Bug
} from "lucide-react";
import { BugReportModal } from "@/components/bug-report-modal";
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
  const { isMuted, toggleMute } = useAudioTelemetry();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bugModalOpen, setBugModalOpen] = useState(false);

  const isConnected = state.status === "connected";
  const isConnecting = state.status === "connecting";
  const hasError = state.status === "error";

  return (
    <div className="w-full flex flex-col border-b border-border/80 bg-background/82 backdrop-blur-xl sticky top-0 z-50">
      <div className="flex h-16 items-center px-4 w-full justify-between">
        {/* Left Side Logo Brand and Mobile Menu */}
        <div className="flex items-center gap-2 lg:gap-4">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground hover:text-foreground h-8 w-8 sm:h-9 sm:w-9 p-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-border bg-background/95 p-0 backdrop-blur-xl flex flex-col h-full z-[100]">
              <div className="flex h-16 items-center gap-3 border-b border-border/70 px-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden border border-primary/40 bg-black/40 shadow-[0_0_24px_rgba(34,197,94,0.16)]">
                  <img src="/arcmeme-logo.png" alt="ArcMeme Logo" className="h-full w-full object-cover" />
                </div>
                <div>
                  <div className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-primary to-primary bg-clip-text text-transparent">ArcMeme</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Market OS</div>
                </div>
              </div>
              
              <nav className="flex flex-col gap-1.5 p-4 flex-1">
                <Link href="/" onClick={() => setMobileMenuOpen(false)} className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                  location === "/"
                    ? "border-l-2 border-l-primary border-y-primary/20 border-r-primary/20 bg-primary/12 text-primary font-bold shadow-sm"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground"
                }`}>
                  <Activity className="h-4 w-4" />
                  <span className="font-semibold">Terminal</span>
                </Link>
                <Link href="/portfolio" onClick={() => setMobileMenuOpen(false)} className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                  location === "/portfolio"
                    ? "border-l-2 border-l-primary border-y-primary/20 border-r-primary/20 bg-primary/12 text-primary font-bold shadow-sm"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground"
                }`}>
                  <Wallet className="h-4 w-4" />
                  <span className="font-semibold">Portfolio</span>
                </Link>
                <Link href="/launch" onClick={() => setMobileMenuOpen(false)} className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                  location === "/launch"
                    ? "border-l-2 border-l-primary border-y-primary/20 border-r-primary/20 bg-primary/12 text-primary font-bold shadow-sm"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground"
                }`}>
                  <PlusCircle className="h-4 w-4" />
                  <span className="font-semibold">Launch Token</span>
                </Link>
                <Link href="/leaderboard" onClick={() => setMobileMenuOpen(false)} className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                  location === "/leaderboard"
                    ? "border-l-2 border-l-primary border-y-primary/20 border-r-primary/20 bg-primary/12 text-primary font-bold shadow-sm"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground"
                }`}>
                  <Trophy className="h-4 w-4" />
                  <span className="font-semibold">Leaderboard</span>
                </Link>
                <Link href="/docs" onClick={() => setMobileMenuOpen(false)} className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                  location === "/docs"
                    ? "border-l-2 border-l-primary border-y-primary/20 border-r-primary/20 bg-primary/12 text-primary font-bold shadow-sm"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground"
                }`}>
                  <BookOpen className="h-4 w-4" />
                  <span className="font-semibold">Docs</span>
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setBugModalOpen(true);
                  }}
                  className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground transition-all cursor-pointer text-left"
                >
                  <Bug className="h-4 w-4" />
                  <span className="font-semibold">Report Issue</span>
                </button>

                <div className="h-[1px] bg-border/40 my-2" />

                <div className="mt-2">
                  <div className="rounded-lg border border-border/80 bg-card/50 p-3">
                    <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                      Discovery Stack
                    </div>
                    <div className="space-y-2 text-xs">
                      <Link href="/?filter=watchlist" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between hover:bg-secondary/15 p-1 rounded transition-colors group cursor-pointer">
                        <span className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                          <Star className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" /> Watchlist
                        </span>
                        <span className="font-mono text-primary bg-primary/10 border border-primary/20 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">local</span>
                      </Link>
                      <Link href="/?alerts=show" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between hover:bg-secondary/15 p-1 rounded transition-colors group cursor-pointer">
                        <span className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                          <Bell className="h-3.5 w-3.5 text-primary group-hover:animate-bounce" /> Alerts
                        </span>
                        <span className="font-mono text-primary bg-primary/10 border border-primary/20 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">armed</span>
                      </Link>
                      <Link href="/launch" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between hover:bg-secondary/15 p-1 rounded transition-colors group cursor-pointer">
                        <span className="flex items-center gap-2 text-muted-foreground group-hover:text-yellow-400 transition-colors">
                          <WalletCards className="h-3.5 w-3.5 text-yellow-400" /> Arc Pooling
                        </span>
                        <span className="font-mono text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">beta</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </nav>

              <div className="p-4 border-t border-border/70">
                <div className="rounded-lg bg-primary/10 p-3 font-mono text-[11px] leading-relaxed text-primary/90">
                  Real launched tokens only. Fast filters, live pools, and on-chain trade history.
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex lg:hidden items-center gap-2 font-bold text-xl tracking-tighter text-foreground">
            <div className="flex h-6 w-6 items-center justify-center rounded overflow-hidden border border-primary/40 bg-black/40">
              <img src="/arcmeme-logo.png" alt="ArcMeme Logo" className="h-full w-full object-cover" />
            </div>
            <span className="hidden min-[400px]:inline bg-gradient-to-r from-white via-primary to-primary bg-clip-text text-transparent">ArcMeme</span>
          </Link>

          {/* Desktop Arc Testnet Badge docked to left */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Arc Testnet</div>
            <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
            <div className="font-mono text-xs text-primary">Live terminal</div>
          </div>
        </div>

        {/* Right Side Controls and Wallet Connect */}
        <div className="flex items-center gap-1.5 sm:gap-6">
          <div className="flex items-center gap-0.5 sm:gap-1">
            <MarketUtilityDrawers />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-primary transition-colors p-0"
              title={isMuted ? "Unmute terminal sounds" : "Mute terminal sounds"}
            >
              {isMuted ? <VolumeX className="h-4 w-4 sm:h-4.5 sm:w-4.5" /> : <Volume2 className="h-4 w-4 sm:h-4.5 sm:w-4.5" />}
            </Button>
          </div>
          <Button asChild size="sm" className="hidden sm:inline-flex gap-2 font-mono text-xs uppercase text-black bg-gradient-to-r from-[var(--accent-neon)] to-[var(--accent-neon-dark)] hover:shadow-[0_0_15px_var(--accent-neon-glow)] transition-all duration-300 shimmer-hover active:scale-95 border-none">
            <Link href="/launch"><PlusCircle className="h-3.5 w-3.5" /> Launch Token</Link>
          </Button>

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
      <BugReportModal open={bugModalOpen} onOpenChange={setBugModalOpen} />
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
    <div className="flex items-center gap-0.5 sm:gap-1">
      <UtilityDrawer icon={<Star className="h-4 w-4" />} title="Watchlist" onOpen={refreshLocalState}>
        <div className="space-y-2">
          {watchedTokens.length === 0 ? (
            <EmptyDrawerState text="Star tokens in the terminal to pin them here." />
          ) : watchedTokens.map((token) => (
            <Link key={token.id} href={`/token/${token.id}`} className="flex items-center justify-between rounded-md border border-border bg-background/40 p-3 transition-colors hover:border-primary/50">
              <span className="font-bold" style={{ color: token.logoColor || "#22c55e" }}>${token.ticker}</span>
              <span className="font-mono text-xs text-primary">${formatPrice(token.price)}</span>
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
        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-primary p-0">
          {icon}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-[360px] sm:max-w-[420px] border-border bg-background/95 p-4 backdrop-blur-xl">
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
  const [modalOpen, setModalOpen] = useState(false);

  const hasMetaMask = typeof window !== "undefined" && window.ethereum !== undefined;
  const isMobile = typeof navigator !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const handleWalletConnectClick = async () => {
    if (hasMetaMask && !isMobile) {
      await onConnect();
    } else {
      setModalOpen(true);
    }
  };

  const handleMetaMaskSelect = async () => {
    setModalOpen(false);
    if (isMobile) {
      const dappUrl = window.location.host + window.location.pathname + window.location.search;
      window.location.href = `metamask://dapp/${dappUrl}`;
    } else {
      if (hasMetaMask) {
        await onConnect();
      } else {
        window.open("https://metamask.io/download/", "_blank");
      }
    }
  };

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
            className="flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 rounded-lg border border-border/80 bg-black/40 backdrop-blur-md hover:border-primary/50 transition-all font-mono text-xs text-foreground outline-none group"
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

          <DropdownMenuItem asChild>
            <a 
              href="https://faucet.circle.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 cursor-pointer font-mono text-xs py-2 px-2 hover:bg-primary/10 hover:text-primary text-foreground rounded transition-all"
            >
              <Droplet className="h-3.5 w-3.5" />
              <span>Faucet</span>
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
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <DialogTrigger asChild>
        <Button
          onClick={handleWalletConnectClick}
          className="font-mono text-xs uppercase text-black bg-gradient-to-r from-[var(--accent-neon)] to-[var(--accent-neon-dark)] hover:shadow-[0_0_15px_var(--accent-neon-glow)] transition-all duration-300 shimmer-hover active:scale-95 font-bold tracking-wider h-9 rounded px-2 sm:px-4 border-none"
          data-testid="button-connect-wallet"
        >
          <Wallet className="h-3.5 w-3.5 mr-1.5 shrink-0" />
          <span>Connect<span className="hidden sm:inline"> Wallet</span></span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[360px] border-border bg-card/95 backdrop-blur-xl p-6 font-mono text-xs text-foreground z-[200]">
        <DialogHeader className="mb-4">
          <DialogTitle className="font-mono text-sm uppercase tracking-widest text-primary text-center">
            Connect Wallet
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground text-center text-[10px] leading-relaxed">
            {isMobile 
              ? "Select MetaMask to open the ArcMeme terminal in your MetaMask App browser." 
              : "Select MetaMask to connect your browser extension wallet."}
          </p>
          
          <button
            onClick={handleMetaMaskSelect}
            className="w-full flex items-center justify-between border border-border/80 hover:border-primary/50 bg-background/40 hover:bg-primary/5 p-4 rounded-lg transition-all text-left outline-none group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-black/40 border border-primary/20 p-1.5 shrink-0 group-hover:border-primary/50 transition-colors">
                <Wallet className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <span className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">MetaMask</span>
                <div className="text-[9px] text-muted-foreground mt-0.5">
                  {isMobile ? "Open MetaMask Mobile App" : hasMetaMask ? "Connect browser extension" : "Install MetaMask Wallet"}
                </div>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </button>
          
          <div className="pt-2 border-t border-border/40 text-[9px] text-muted-foreground leading-relaxed text-center">
            ArcMeme secure telemetry indexer. By connecting, you authorize on-chain interactions on the Arc Testnet.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TickerItem({ token }: { token: Token }) {
  const live = useLiveTokenData(token);
  const isPositive = live.change24h >= 0;
  return (
    <div className="flex items-center gap-3 px-8 font-mono text-xs border-r border-border/30 hover:bg-white/[0.02] transition-colors py-1 select-none">
      <span className="font-extrabold text-foreground tracking-tight">${token.ticker}</span>
      <span className="text-[var(--accent-neon)] font-bold">${formatPrice(live.price)}</span>
      <span className={`flex items-center gap-0.5 font-bold ${isPositive ? "text-[var(--accent-neon)]" : "text-[var(--accent-destructive)]"}`}>
        <span>{isPositive ? "▲" : "▼"}</span>
        <span>{isPositive ? "+" : ""}{live.change24h.toFixed(1)}%</span>
      </span>
      <span className="text-muted-foreground text-[10px]">
        VOL: <span className="text-foreground/75 font-semibold">${formatCompactNumber(live.volume24h)}</span>
      </span>
    </div>
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
    <div className="w-full bg-[var(--bg-sidebar)] border-t border-border/80 overflow-hidden h-9 flex items-center relative after:absolute after:inset-y-0 after:right-0 after:w-16 after:bg-gradient-to-l after:from-[var(--bg-base)] after:to-transparent after:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-16 before:bg-gradient-to-r before:from-[var(--bg-base)] before:to-transparent before:pointer-events-none before:z-10 after:z-10">
      <div className="flex animate-[ticker_25s_linear_infinite] whitespace-nowrap min-w-full will-change-transform py-1">
        {[...items, ...items].map((item, i) => (
          <TickerItem key={i} token={item} />
        ))}
      </div>
    </div>
  );
}
