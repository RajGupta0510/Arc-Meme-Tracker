import { useParams } from "wouter";
import { useGetToken, useGetTokenChart, getGetTokenQueryKey, getGetTokenChartQueryKey } from "@workspace/api-client-react";
import { formatCompactNumber, formatAddress } from "@/lib/utils";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export function TokenDetailPage() {
  const { id } = useParams<{ id: string }>();
  
  const { data: token, isLoading: tokenLoading } = useGetToken(id!, { 
    query: { enabled: !!id, queryKey: getGetTokenQueryKey(id!) } 
  });
  
  const { data: chartData } = useGetTokenChart(id!, { 
    query: { enabled: !!id, queryKey: getGetTokenChartQueryKey(id!) } 
  });

  const [buyAmount, setBuyAmount] = useState("");

  if (tokenLoading) {
    return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!token) {
    return <div className="p-8 text-center text-muted-foreground">Token not found. rug pulled?</div>;
  }

  const isPositive = token.change24h >= 0;

  return (
    <div className="max-w-7xl mx-auto w-full p-4 flex flex-col lg:flex-row gap-6 pb-20">
      
      {/* Left Col: Chart & Info */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Token Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl text-white shadow-lg"
              style={{ backgroundColor: token.logoColor || "#22c55e" }}
            >
              {token.ticker.slice(0, 3)}
            </div>
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-tighter">${token.ticker}</h1>
              <div className="text-muted-foreground">{token.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono font-bold">${token.price.toFixed(6)}</div>
            <div className={`font-mono text-lg font-medium ${isPositive ? "text-primary" : "text-destructive"}`}>
              {isPositive ? "+" : ""}{token.change24h.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Chart */}
        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
            <CardTitle className="text-sm font-medium uppercase tracking-wider">Price Chart</CardTitle>
            <div className="flex gap-2">
              {["1H", "4H", "1D"].map(tf => (
                <Button key={tf} variant="outline" size="sm" className="h-6 text-[10px]">{tf}</Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0 h-[400px]">
            {chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(tick) => new Date(tick).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    hide
                  />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-mono)' }}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="close" 
                    stroke={isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))"} 
                    fillOpacity={1} 
                    fill="url(#colorClose)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-sm">No chart data</div>
            )}
          </CardContent>
        </Card>

        {/* Description & Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-2 text-muted-foreground">About</h3>
            <p className="text-sm leading-relaxed">{token.description}</p>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-2 text-muted-foreground">Info</h3>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creator</span>
                <span className="text-primary">{formatAddress(token.creatorAddress)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(token.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Supply</span>
                <span>{formatCompactNumber(token.totalSupply)}</span>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              {token.website && <Button variant="outline" size="sm" asChild><a href={token.website} target="_blank" rel="noreferrer">Website</a></Button>}
              {token.twitter && <Button variant="outline" size="sm" asChild><a href={`https://twitter.com/${token.twitter}`} target="_blank" rel="noreferrer">Twitter</a></Button>}
              {token.telegram && <Button variant="outline" size="sm" asChild><a href={token.telegram} target="_blank" rel="noreferrer">Telegram</a></Button>}
            </div>
          </div>
        </div>

      </div>

      {/* Right Col: Terminal/Trade Panel */}
      <div className="w-full lg:w-[350px] flex flex-col gap-4">
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatPanel label="Market Cap" value={`$${formatCompactNumber(token.marketCap)}`} />
          <StatPanel label="Volume 24h" value={`$${formatCompactNumber(token.volume24h)}`} />
          <StatPanel label="Holders" value={token.holders.toLocaleString()} />
          <StatPanel label="Transactions" value={token.txCount.toLocaleString()} />
        </div>

        {/* Trade Terminal */}
        <Card className="border-border bg-card/80 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg uppercase tracking-tight">Trade {token.ticker}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex bg-secondary/50 p-1 rounded-md">
              <Button variant="ghost" className="flex-1 bg-background shadow-sm hover:bg-background h-8 text-xs font-bold text-primary">Buy</Button>
              <Button variant="ghost" className="flex-1 text-muted-foreground h-8 text-xs font-bold hover:text-destructive">Sell</Button>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">Amount (ARC)</span>
                <span>Balance: 0.00</span>
              </div>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="0.0" 
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  className="font-mono text-lg bg-background/50 h-12 pr-16"
                />
                <div className="absolute right-3 top-3 font-mono text-muted-foreground">ARC</div>
              </div>
              {buyAmount && (
                <div className="text-xs font-mono text-muted-foreground text-right">
                  ≈ {(parseFloat(buyAmount) / token.price).toLocaleString(undefined, {maximumFractionDigits:2})} {token.ticker}
                </div>
              )}
            </div>

            <Button className="w-full font-bold uppercase tracking-wider h-12 text-black" size="lg">
              Place Trade
            </Button>
          </CardContent>
        </Card>

        {/* Bonding Curve */}
        <Card className="border-border bg-card/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-xs font-mono uppercase">
              <span className="text-muted-foreground">Bonding Curve Progress</span>
              <span className="text-primary font-bold">47%</span>
            </div>
            <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: '47%' }} />
            </div>
            <p className="text-[10px] text-muted-foreground text-center">When cap reaches 100%, liquidity is locked on ArcSwap.</p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

function StatPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card/50 border border-border p-3 rounded-lg flex flex-col">
      <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}