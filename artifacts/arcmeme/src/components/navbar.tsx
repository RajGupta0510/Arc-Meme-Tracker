import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [location] = useLocation();

  const connectWallet = () => {
    setWallet("0x71C...97d4");
  };

  const disconnectWallet = () => {
    setWallet(null);
  };

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
            <Link href="/" className={`transition-colors hover:text-primary ${location === "/" ? "text-primary" : "text-muted-foreground"}`}>
              Terminal
            </Link>
            <Link href="/launch" className={`transition-colors hover:text-primary ${location === "/launch" ? "text-primary" : "text-muted-foreground"}`}>
              Launch Token
            </Link>
          </nav>
          {wallet ? (
            <Button variant="outline" onClick={disconnectWallet} className="font-mono text-xs">
              {wallet}
            </Button>
          ) : (
            <Button onClick={connectWallet} className="font-mono text-xs font-bold uppercase tracking-wider">
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
      <TickerTape />
    </div>
  );
}

function TickerTape() {
  const [items, setItems] = useState<{ ticker: string; price: string; change: number }[]>([]);

  useEffect(() => {
    // Generate some fake real-time looking ticker data
    const gen = () => {
      const names = ["PEPE", "DOGE", "SHIB", "WIF", "BONK", "FLOKI", "BOME", "MEME", "MOG", "POPCAT"];
      return names.map(n => ({
        ticker: n,
        price: (Math.random() * 0.1).toFixed(6),
        change: (Math.random() * 20) - 10
      })).sort(() => Math.random() - 0.5);
    };
    
    setItems(gen());
    const int = setInterval(() => {
      setItems(prev => prev.map(item => ({
        ...item,
        price: (parseFloat(item.price) * (1 + (Math.random() * 0.04 - 0.02))).toFixed(6),
        change: item.change + (Math.random() * 2 - 1)
      })));
    }, 3000);
    return () => clearInterval(int);
  }, []);

  return (
    <div className="w-full bg-black/50 border-t border-border overflow-hidden h-8 flex items-center">
      <div className="flex animate-[ticker_20s_linear_infinite] whitespace-nowrap min-w-full">
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-6 font-mono text-xs">
            <span className="font-bold text-muted-foreground">{item.ticker}</span>
            <span>${item.price}</span>
            <span className={item.change >= 0 ? "text-primary" : "text-destructive"}>
              {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}