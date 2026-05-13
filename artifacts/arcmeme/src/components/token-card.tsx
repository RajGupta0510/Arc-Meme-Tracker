import { Link } from "wouter";
import { formatCompactNumber } from "@/lib/utils";
import type { Token } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

export function TokenCard({ token, index }: { token: Token; index?: number }) {
  const isPositive = token.change24h >= 0;

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
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-inner group-hover:scale-110 transition-transform"
                style={{ backgroundColor: token.logoColor || "#22c55e" }}
              >
                {token.ticker.slice(0, 3)}
              </div>
              <div>
                <div className="font-bold uppercase tracking-tight flex items-center gap-2">
                  ${token.ticker}
                  <span className="text-[10px] text-muted-foreground font-normal normal-case bg-secondary px-1.5 py-0.5 rounded-sm">Arc</span>
                </div>
                <div className="text-xs text-muted-foreground line-clamp-1">{token.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-sm">${token.price.toFixed(6)}</div>
              <div className={`font-mono text-xs font-medium ${isPositive ? "text-primary" : "text-destructive"}`}>
                {isPositive ? "+" : ""}{token.change24h.toFixed(2)}%
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-auto pt-3 border-t border-border/50">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">MCap</span>
              <span className="font-mono text-xs font-bold">${formatCompactNumber(token.marketCap)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Vol (24h)</span>
              <span className="font-mono text-xs font-bold">${formatCompactNumber(token.volume24h)}</span>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}