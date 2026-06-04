import { Link, useLocation } from "wouter";
import { Activity, BarChart3, Bell, PlusCircle, Radar, Star, WalletCards, Trophy } from "lucide-react";

const navItems = [
  { href: "/", label: "Terminal", icon: BarChart3 },
  { href: "/portfolio", label: "Portfolio", icon: WalletCards },
  { href: "/launch", label: "Launch", icon: PlusCircle },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <aside className="hidden lg:flex fixed top-0 left-0 z-40 h-screen w-64 shrink-0 flex-col border-r border-border/80 bg-background/78 backdrop-blur-xl overflow-y-auto hide-scrollbar">
      <Link href="/" className="flex h-16 items-center gap-3 border-b border-border/70 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden border border-primary/40 bg-black/40 shadow-[0_0_24px_rgba(34,197,94,0.16)]">
          <img src="/arcmeme-logo.png" alt="ArcMeme Logo" className="h-full w-full object-cover" />
        </div>
        <div>
          <div className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-primary to-primary bg-clip-text text-transparent">ArcMeme</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Market OS</div>
        </div>
      </Link>

      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                active
                  ? "border-primary/30 bg-primary/10 text-primary shadow-[0_0_18px_rgba(34,197,94,0.12)]"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
              <span className="font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-2 px-3">
        <div className="rounded-lg border border-border/80 bg-card/50 p-3">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Discovery Stack
          </div>
          <div className="space-y-2 text-xs">
            <Link href="/?filter=watchlist" className="flex items-center justify-between hover:bg-secondary/15 p-1 rounded transition-colors group cursor-pointer">
              <span className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                <Star className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" /> Watchlist
              </span>
              <span className="font-mono text-primary bg-primary/10 border border-primary/20 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">local</span>
            </Link>
            <Link href="/?alerts=show" className="flex items-center justify-between hover:bg-secondary/15 p-1 rounded transition-colors group cursor-pointer">
              <span className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                <Bell className="h-3.5 w-3.5 text-primary group-hover:animate-bounce" /> Alerts
              </span>
              <span className="font-mono text-primary bg-primary/10 border border-primary/20 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">armed</span>
            </Link>
            <Link href="/launch" className="flex items-center justify-between hover:bg-secondary/15 p-1 rounded transition-colors group cursor-pointer">
              <span className="flex items-center gap-2 text-muted-foreground group-hover:text-yellow-400 transition-colors">
                <WalletCards className="h-3.5 w-3.5 text-yellow-400" /> Arc Pooling
              </span>
              <span className="font-mono text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">beta</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-border/70 p-4">
        <div className="rounded-lg bg-primary/10 p-3 font-mono text-[11px] leading-relaxed text-primary/90">
          Real launched tokens only. Fast filters, live pools, and on-chain trade history.
        </div>
      </div>
    </aside>
  );
}
