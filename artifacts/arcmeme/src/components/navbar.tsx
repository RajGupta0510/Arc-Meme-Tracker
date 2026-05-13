import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";

export function Navbar() {
  const [location] = useLocation();
  const { state, connect, disconnect, switchToArcTestnet, getShortAddress } = useWallet();

  const isConnected = state.status === "connected";
  const isConnecting = state.status === "connecting";
  const hasError = state.status === "error";

  return (
    <div className="w-full flex flex-col border-b border-border bg-background sticky top-0 z-50">
      <div className="flex h-16 items-center px-4 max-w-7xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl tracking-tighter">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
            <path d="M12 2L2 22h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M12 8L6 18h12L12 8z" fill="currentColor" />
          </svg>
          ArcMeme
        </Link>

        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
            <Link
              href="/"
              className={`transition-colors hover:text-primary ${location === "/" ? "text-primary" : "text-muted-foreground"}`}
              data-testid="link-terminal"
            >
              Terminal
            </Link>
            <Link
              href="/launch"
              className={`transition-colors hover:text-primary ${location === "/launch" ? "text-primary" : "text-muted-foreground"}`}
              data-testid="link-launch"
            >
              Launch Token
            </Link>
          </nav>

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
  const [items, setItems] = useState<{ ticker: string; price: string; change: number }[]>([]);

  useEffect(() => {
    const names = ["PEPE", "DOGE", "SHIB", "WIF", "BONK", "FLOKI", "BOME", "MEME", "MOG", "POPCAT"];
    const gen = () =>
      names.map((n) => ({
        ticker: n,
        price: (Math.random() * 0.1).toFixed(6),
        change: Math.random() * 20 - 10,
      }));

    setItems(gen());
    const interval = setInterval(() => {
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          price: (parseFloat(item.price) * (1 + (Math.random() * 0.04 - 0.02))).toFixed(6),
          change: item.change + (Math.random() * 2 - 1),
        }))
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-black/50 border-t border-border overflow-hidden h-8 flex items-center">
      <div className="flex animate-[ticker_20s_linear_infinite] whitespace-nowrap min-w-full">
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-6 font-mono text-xs">
            <span className="font-bold text-muted-foreground">{item.ticker}</span>
            <span>${item.price}</span>
            <span className={item.change >= 0 ? "text-primary" : "text-destructive"}>
              {item.change >= 0 ? "+" : ""}
              {item.change.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
