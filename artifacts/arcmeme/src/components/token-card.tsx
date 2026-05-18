import { Link } from "wouter";
import { formatCompactNumber } from "@/lib/utils";
import type { Token } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

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

export function TokenCard({ token, index }: { token: Token; index?: number }) {
  const price = safeNumber(token.price);
  const change24h = safeNumber(token.change24h);
  const marketCap = safeNumber(token.marketCap);
  const volume24h = safeNumber(token.volume24h);
  const ticker = token.ticker || "TOKEN";
  const isPositive = change24h >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index ?? 0) * 0.05, duration: 0.2 }}
      className="h-full"
    >
      <Link href={`/token/${token.id}`}>
        <Card className="h-full p-4 hover:border-primary/50 transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.1)] cursor-pointer bg-card/50 backdrop-blur flex flex-col gap-3 group">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="group-hover:scale-110 transition-transform">
                <TokenLogo token={token} size="sm" />
              </div>
              <div>
                <div className="font-bold uppercase tracking-tight flex items-center gap-2">
                  ${ticker}
                  <span className="text-[10px] text-muted-foreground font-normal normal-case bg-secondary px-1.5 py-0.5 rounded-sm">Arc</span>
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
        </Card>
      </Link>
    </motion.div>
  );
}
