import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, BarChart3, Bell, PlusCircle, Radar, Star, WalletCards, Trophy, BookOpen, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BugReportModal } from "@/components/bug-report-modal";

const navItems = [
  { href: "/", label: "Terminal", icon: BarChart3 },
  { href: "/portfolio", label: "Portfolio", icon: WalletCards },
  { href: "/launch", label: "Launch", icon: PlusCircle },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/docs", label: "Docs", icon: BookOpen },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [bugModalOpen, setBugModalOpen] = useState(false);

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
              className={`group flex items-center gap-3 rounded border px-3 py-2.5 text-sm transition-all relative after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-[var(--accent-neon)] after:scale-x-0 hover:after:scale-x-100 after:origin-left after:transition-transform after:duration-300 ${
                active
                  ? "border-l-2 border-l-primary border-y-primary/20 border-r-primary/20 bg-primary/12 text-primary font-bold shadow-sm"
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
              <span className="font-mono text-[var(--accent-neon)] bg-white/5 backdrop-blur-md border border-white/10 text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">local</span>
            </Link>
            <Link href="/?alerts=show" className="flex items-center justify-between hover:bg-secondary/15 p-1 rounded transition-colors group cursor-pointer">
              <span className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                <Bell className="h-3.5 w-3.5 text-primary group-hover:animate-bounce" /> Alerts
              </span>
              <span className="font-mono text-[var(--accent-neon)] bg-white/5 backdrop-blur-md border border-white/10 text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">armed</span>
            </Link>
            <Link href="/launch" className="flex items-center justify-between hover:bg-secondary/15 p-1 rounded transition-colors group cursor-pointer">
              <span className="flex items-center gap-2 text-muted-foreground group-hover:text-yellow-400 transition-colors">
                <WalletCards className="h-3.5 w-3.5 text-yellow-400" /> Arc Pooling
              </span>
              <span className="font-mono text-yellow-400 bg-white/5 backdrop-blur-md border border-white/10 text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">beta</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-3 px-3">
        <Button
          onClick={() => setBugModalOpen(true)}
          variant="outline"
          className="w-full flex items-center justify-center gap-2 border border-dashed border-border/80 hover:border-[var(--accent-neon)] bg-background/20 text-muted-foreground hover:text-[var(--accent-neon)] hover:shadow-[0_0_12px_var(--accent-neon-glow-card)] font-mono text-[10px] uppercase tracking-wider py-3 rounded transition-all duration-300 cursor-pointer"
        >
          <Bug className="h-3.5 w-3.5" />
          Report Issue
        </Button>
      </div>

      <div className="mt-auto border-t border-border/70 p-4">
        <div className="rounded-lg bg-primary/10 p-3 font-mono text-[11px] leading-relaxed text-primary/90">
          Real launched tokens only. Fast filters, live pools, and on-chain trade history.
        </div>
      </div>

      <BugReportModal open={bugModalOpen} onOpenChange={setBugModalOpen} />
    </aside>
  );
}
