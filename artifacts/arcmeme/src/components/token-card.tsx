import { Link } from "wouter";
import { formatAddress, formatCompactNumber } from "@/lib/utils";
import type { Token } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Star } from "lucide-react";

function safeNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function TokenLogo({ token, size = "sm" }: { token: Token; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "w-16 h-16 text-2xl" : "w-10 h-10 text-sm";
  const ticker = token.ticker || "TOKEN";

  if (token.logoUrl) {
    return (
      <img
        src={token.logoUrl}
        alt={ticker}
        className={`${dim} rounded-full object-cover shadow-inner flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-bold text-white shadow-inner flex-shrink-0`}
      style={{ backgroundColor: token.logoColor || "#22c55e" }}
    >
      {ticker.slice(0, 3)}
    </div>
  );
}

function Sparkline({ token, accentColor }: { token: Token; accentColor: string }) {
  const seed = Array.from(token.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const points = Array.from({ length: 18 }, (_, index) => {
    const wave = Math.cos((seed + index * 13) / 10) * 13;
    const drift = token.marketType === "amm_pool" ? index * 0.7 : -index * 0.2;
    return Math.max(10, Math.min(58, 36 - wave - drift));
  });
  const path = points.map((y, index) => `${index === 0 ? "M" : "L"}${index * 7},${y}`).join(" ");

  return (
    <svg viewBox="0 0 119 68" className="h-16 w-full overflow-visible" style={{ color: accentColor }}>
      <path d={`${path} L119,68 L0,68 Z`} fill="currentColor" className="opacity-[0.06]" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" style={{ filter: `drop-shadow(0 0 5px ${accentColor}80)` }} />
    </svg>
  );
}

export function TokenCard({
  token,
  index,
  watched = false,
  onToggleWatch,
}: {
  token: Token;
  index?: number;
  watched?: boolean;
  onToggleWatch?: (id: string) => void;
}) {
  const price = safeNumber(token.price);
  const change24h = safeNumber(token.change24h);
  const marketCap = safeNumber(token.marketCap);
  const volume24h = safeNumber(token.volume24h);
  const ticker = token.ticker || "TOKEN";
  const isPositive = change24h >= 0;
  const isLive = token.marketType === "amm_pool" && Boolean(token.pairAddress);
  const accentColor = token.logoColor || "#22c55e";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index ?? 0) * 0.04, duration: 0.22 }}
      className="h-full"
    >
      <Card
        className="h-full overflow-hidden p-0 border border-border/80 bg-card/60 backdrop-blur-md flex flex-col group rounded-lg relative transition-all duration-300"
        style={{
          // Use style variables to support dynamic styling
          ["--token-glow" as any]: `${accentColor}15`,
          ["--token-border" as any]: `${accentColor}50`,
        }}
      >
        {/* Dynamic Accent Background Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/20 opacity-40 pointer-events-none" />
        
        <Link href={`/token/${token.id}`} className="flex flex-1 flex-col gap-3.5 p-4 z-10 relative">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="group-hover:scale-105 transition-transform duration-300 relative">
                <TokenLogo token={token} size="sm" />
                <div
                  className="absolute inset-0 rounded-full blur-md opacity-25 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
              <div>
                <div className="font-bold uppercase tracking-tight flex items-center gap-2 text-foreground/90 font-mono">
                  <span style={{ color: accentColor }} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.05)]">${ticker}</span>
                </div>
                <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{token.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-sm text-foreground/90">${price.toFixed(6)}</div>
              <div className={`font-mono text-xs font-semibold ${isPositive ? "text-primary" : "text-destructive"}`}>
                {isPositive ? "▲" : "▼"} {isPositive ? "+" : ""}{change24h.toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="py-2 opacity-95 group-hover:opacity-100 transition-opacity duration-300">
            <Sparkline token={token} accentColor={accentColor} />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-auto pt-3 border-t border-border/40 font-mono">
            <div className="flex flex-col bg-background/20 p-2 rounded border border-border/20">
              <span className="text-[9px] uppercase text-muted-foreground tracking-wider">MCap</span>
              <span className="text-xs font-bold text-foreground/80">${formatCompactNumber(marketCap)}</span>
            </div>
            <div className="flex flex-col bg-background/20 p-2 rounded border border-border/20">
              <span className="text-[9px] uppercase text-muted-foreground tracking-wider">Vol (24h)</span>
              <span className="text-xs font-bold text-foreground/80">${formatCompactNumber(volume24h)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground border-t border-border/30 pt-3">
            <span className="hover:text-foreground/80 transition-colors">{formatAddress(token.contractAddress ?? "")}</span>
            <span className="uppercase text-[8px] px-1 bg-secondary/30 rounded border border-border/20">Tradeable</span>
          </div>
        </Link>

        {/* Action button drawers */}
        <div className="flex border-t border-border/40 bg-background/35 z-10 font-mono">
          <button
            type="button"
            onClick={() => onToggleWatch?.(token.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[10px] uppercase transition-colors ${
              watched ? "text-yellow-400 bg-yellow-400/5" : "text-muted-foreground hover:text-yellow-400 hover:bg-yellow-400/5"
            }`}
          >
            <Star className="h-3 w-3" fill={watched ? "currentColor" : "none"} />
            {watched ? "Watching" : "Watch"}
          </button>
          <Link
            href={`/token/${token.id}`}
            className="flex flex-1 items-center justify-center border-l border-border/40 px-3 py-2 text-[10px] uppercase text-primary transition-all duration-300 hover:bg-primary/10"
            style={{ color: accentColor }}
          >
            Trade →
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}
