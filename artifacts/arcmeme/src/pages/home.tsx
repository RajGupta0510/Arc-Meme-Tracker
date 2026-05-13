import { useGetPlatformStats, useGetTrendingTokens, useListTokens, getGetTrendingTokensQueryKey, getListTokensQueryKey, getGetPlatformStatsQueryKey } from "@workspace/api-client-react";
import { formatCompactNumber } from "@/lib/utils";
import { TokenCard } from "@/components/token-card";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ListTokensSort } from "@workspace/api-client-react";
import { motion } from "framer-motion";

export function HomePage() {
  const { data: stats } = useGetPlatformStats({ query: { queryKey: getGetPlatformStatsQueryKey() } });
  const { data: trending } = useGetTrendingTokens({ query: { queryKey: getGetTrendingTokensQueryKey() } });
  
  const [sort, setSort] = useState<ListTokensSort>(ListTokensSort.newest);
  const { data: tokens, isLoading } = useListTokens({ sort, limit: 50 }, { query: { queryKey: getListTokensQueryKey({ sort, limit: 50 }) } });

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 flex flex-col gap-8 pb-20">
      
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4 mt-4">
        <StatBox label="Total Tokens" value={stats?.totalTokens?.toLocaleString() ?? "-"} />
        <StatBox label="24h Volume" value={`$${formatCompactNumber(stats?.totalVolume24h || 0)}`} textClass="text-primary" />
        <StatBox label="Total MCap" value={`$${formatCompactNumber(stats?.totalMarketCap || 0)}`} />
        <StatBox label="Active Traders" value={stats?.activeTraders?.toLocaleString() ?? "-"} />
        <StatBox label="Launched (24h)" value={stats?.tokensLaunched24h?.toString() ?? "-"} />
      </div>

      {/* Trending Section */}
      {trending && trending.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h2 className="text-xl font-bold tracking-tight uppercase">Hot on Arc</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar">
            {trending.map((token, i) => (
              <div key={token.id} className="min-w-[280px] sm:min-w-[320px] snap-start">
                <TokenCard token={token} index={i} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Terminal */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-border pb-4">
          <h2 className="text-xl font-bold tracking-tight uppercase">Terminal</h2>
          <div className="flex flex-wrap gap-2">
            {Object.values(ListTokensSort).map((s) => (
              <Button 
                key={s} 
                variant={sort === s ? "default" : "outline"}
                size="sm"
                className="font-mono text-xs uppercase"
                onClick={() => setSort(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-[120px] bg-card/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tokens?.map((token, i) => (
              <TokenCard key={token.id} token={token} index={i} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

function StatBox({ label, value, textClass = "" }: { label: string; value: string; textClass?: string }) {
  return (
    <div className="bg-card/30 border border-border p-3 rounded-md flex flex-col items-center justify-center text-center">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">{label}</div>
      <div className={`font-mono text-lg font-bold ${textClass}`}>{value}</div>
    </div>
  );
}