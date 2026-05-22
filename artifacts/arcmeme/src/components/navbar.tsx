import { Link } from "wouter";
import { useState } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useWallet } from "@/hooks/use-wallet";
import { ListTokensSort, getListTokensQueryKey, useListTokens } from "@workspace/api-client-react";
import { formatCompactNumber } from "@/lib/utils";
import { Activity, Bell, Menu, PlusCircle, Radar, Star } from "lucide-react";

type AlertRule = {
  id: string;
  tokenId: string;
  ticker: string;
  metric: "price" | "marketCap";
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
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
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
    </div>
  );
}

function MarketUtilityDrawers() {
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

  const refreshLocalState = () => {
    setWatchlist(readJson("arcmeme.watchlist", []));
    setAlerts(readJson("arcmeme.alerts", []));
  };

  const watchedTokens = tokens.filter((token) => watchlist.includes(token.id));
  const activity = tokens.slice(0, 12);

  return (
    <div className="hidden sm:flex items-center gap-1">
      <UtilityDrawer icon={<Star className="h-4 w-4" />} title="Watchlist" onOpen={refreshLocalState}>
        <div className="space-y-2">
          {watchedTokens.length === 0 ? (
            <EmptyDrawerState text="Star tokens in the terminal to pin them here." />
          ) : watchedTokens.map((token) => (
            <Link key={token.id} href={`/token/${token.id}`} className="flex items-center justify-between rounded-md border border-border bg-background/40 p-3 transition-colors hover:border-primary/50">
              <span className="font-bold">${token.ticker}</span>
              <span className="font-mono text-xs text-primary">${token.price.toFixed(6)}</span>
            </Link>
          ))}
        </div>
      </UtilityDrawer>

      <UtilityDrawer icon={<Bell className="h-4 w-4" />} title="Alerts" onOpen={refreshLocalState}>
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <EmptyDrawerState text="Create price or market-cap alerts from the terminal toolbar." />
          ) : alerts.map((alert) => {
            const token = tokens.find((item) => item.id === alert.tokenId);
            const current = alert.metric === "price" ? token?.price : token?.marketCap;
            const triggered = current !== undefined && current >= alert.target;
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
                  <span>${alert.ticker} {alert.metric}</span>
                  <span className={triggered ? "text-primary" : "text-muted-foreground"}>{alert.metric === "price" ? "$" : "$"}{alert.target.toFixed(alert.metric === "price" ? 6 : 0)}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Click to remove</div>
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
                <span className="font-bold">${token.ticker}</span>
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
  onConnect: () => void;
  onDisconnect: () => void;
  onSwitchNetwork: () => void;
  getShortAddress: (a: string) => string;
};

function WalletButton({
  state,
  isConnected,
  isConnecting,
  onConnect,
  onDisconnect,
  onSwitchNetwork,
  getShortAddress,
}: WalletButtonProps) {
  const [showMenu, setShowMenu] = useState(false);

  if (isConnecting) {
    return (
      <Button disabled className="font-mono text-xs font-bold uppercase tracking-wider opacity-70" data-testid="button-wallet-connecting">
        <span className="animate-pulse">Connecting...</span>
      </Button>
    );
  }

  if (isConnected && state.status === "connected") {
    const { address, isArcTestnet } = state;
    return (
      <div className="relative">
        <Button
          variant="outline"
          onClick={() => setShowMenu((v) => !v)}
          className={`font-mono text-xs gap-2 ${!isArcTestnet ? "border-yellow-500/50 text-yellow-400" : "border-primary/50 text-primary"}`}
          data-testid="button-wallet-connected"
        >
          <span
            className={`w-2 h-2 rounded-full ${isArcTestnet ? "bg-primary" : "bg-yellow-400"}`}
          />
          {getShortAddress(address)}
        </Button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-2 z-20 bg-card border border-border rounded-lg shadow-xl p-2 min-w-[200px] flex flex-col gap-1">
              <div className="px-3 py-2 text-[10px] uppercase text-muted-foreground tracking-widest border-b border-border mb-1">
                {isArcTestnet ? "Arc Network Testnet" : "Wrong Network"}
              </div>
              <div className="px-3 py-1.5 font-mono text-xs text-foreground break-all" data-testid="text-full-address">
                {address}
              </div>
              {!isArcTestnet && (
                <button
                  onClick={() => { onSwitchNetwork(); setShowMenu(false); }}
                  className="text-left px-3 py-1.5 text-xs text-yellow-400 hover:bg-yellow-500/10 rounded-md transition-colors"
                  data-testid="button-switch-network"
                >
                  Switch to Arc Testnet
                </button>
              )}
              <button
                onClick={() => { onDisconnect(); setShowMenu(false); }}
                className="text-left px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                data-testid="button-disconnect"
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <Button
      onClick={onConnect}
      className="font-mono text-xs font-bold uppercase tracking-wider"
      data-testid="button-connect-wallet"
    >
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
