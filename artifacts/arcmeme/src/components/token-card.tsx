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

function Sparkline({ token }: { token: Token }) {
  const seed = Array.from(token.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const points = Array.from({ length: 18 }, (_, index) => {
    const wave = Math.cos((seed + index * 13) / 10) * 13;
    const drift = token.marketType === "amm_pool" ? index * 0.7 : -index * 0.2;
    return Math.max(10, Math.min(58, 36 - wave - drift));
  });
  const path = points.map((y, index) => `${index === 0 ? "M" : "L"}${index * 7},${y}`).join(" ");

  return (
    <svg viewBox="0 0 119 68" className="h-16 w-full text-primary">
      <path d={`${path} L119,68 L0,68 Z`} className="fill-primary/10" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" className="drop-shadow-[0_0_7px_rgba(34,197,94,0.5)]" />
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index ?? 0) * 0.05, duration: 0.2 }}
      className="h-full"
    >
      <Card className="h-full overflow-hidden p-0 hover:border-primary/60 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_0_28px_rgba(34,197,94,0.14)] bg-card/75 backdrop-blur flex flex-col group rounded-lg">
        <Link href={`/token/${token.id}`} className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="group-hover:scale-110 transition-transform">
                <TokenLogo token={token} size="sm" />
              </div>
              <div>
                <div className="font-bold uppercase tracking-tight flex items-center gap-2">
                  ${ticker}
                  <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-sm border ${
                    isLive
                      ? "text-primary border-primary/30 bg-primary/10"
                      : "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"
                  }`}>
                    {isLive ? "Live" : "Needs Pool"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground line-clamp-1">{token.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-sm">${price.toFixed(6)}</div>
              <div className={`font-mono text-xs font-medium ${isPositive ? "text-primary" : "text-destructive"}`}>
                {isPositive ? "+" : ""}{change24h.toFixed(2)}%
              </div>
            </div>
          </div>

          <Sparkline token={token} />

          <div className="grid grid-cols-2 gap-2 mt-auto pt-3 border-t border-border/50">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">MCap</span>
              <span className="font-mono text-xs font-bold">${formatCompactNumber(marketCap)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Vol (24h)</span>
              <span className="font-mono text-xs font-bold">${formatCompactNumber(volume24h)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border/40 pt-3">
            <span>{formatAddress(token.contractAddress ?? "")}</span>
            <span>{isLive ? "Tradeable" : "Add liquidity"}</span>
          </div>
        </Link>
        <div className="flex border-t border-border/50 bg-background/30">
          <button
            type="button"
            onClick={() => onToggleWatch?.(token.id)}
            className={`flex flex-1 items-center justify-center gap-2 px-3 py-2 font-mono text-[11px] uppercase transition-colors ${
              watched ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"
            }`}
          >
            <Star className="h-3.5 w-3.5" fill={watched ? "currentColor" : "none"} />
            {watched ? "Watching" : "Watch"}
          </button>
          <Link
            href={`/token/${token.id}`}
            className="flex flex-1 items-center justify-center border-l border-border/50 px-3 py-2 font-mono text-[11px] uppercase text-primary transition-colors hover:bg-primary/10"
          >
            {isLive ? "Trade" : "Pool"}
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}
