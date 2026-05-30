import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatAddress, formatBalance, formatCompactNumber, formatPrice } from "@/lib/utils";
import { Loader2, ArrowUpRight, TrendingUp, TrendingDown, WalletCards, Activity, Award, Briefcase, RefreshCw, BarChart2, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import {
  getArcReadProvider,
  getErc20Contract,
  readPairReserves,
  normalizeReserves,
  DEFAULT_ARC_AMM
} from "@/lib/arc-amm";
import { formatUnits, parseUnits, BrowserProvider } from "ethers";
import { useAudioTelemetry } from "@/hooks/use-audio-telemetry";

export function PortfolioPage() {
  const { state, refresh } = useWallet();
  const { toast } = useToast();
  const searchParams = new URLSearchParams(window.location.search);
  const queryAddress = searchParams.get("address") || undefined;
  const walletAddress = queryAddress || (state.status === "connected" ? state.address : undefined);
  const isOwnWallet = !queryAddress || queryAddress.toLowerCase() === (state.status === "connected" ? state.address.toLowerCase() : "");

  // 1. Fetch portfolio metrics, stats, and historical trades from backend SQL indexer
  const { data: portfolioData, isLoading: portfolioLoading, refetch: refetchPortfolio } = useQuery({
    queryKey: ["portfolio", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return { holdings: [], trades: [] };
      const response = await fetch(`/api/portfolio/${walletAddress}`);
      if (!response.ok) throw new Error("Failed to fetch portfolio data.");
      return response.json();
    },
    enabled: !!walletAddress,
  });

  const [liveHoldings, setLiveHoldings] = useState<any[]>([]);
  const [liveLps, setLiveLps] = useState<any[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [followedWallets, setFollowedWallets] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("followed_wallets") || "[]");
    } catch {
      return [];
    }
  });

  const { playBuySound, playSellSound, playAlarmSound, playHypeSound } = useAudioTelemetry();
  const [isDeploying, setIsDeploying] = useState(false);
  const [fundingAmount, setFundingAmount] = useState("100");
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [editAllocation, setEditAllocation] = useState("25");
  const [editSlippage, setEditSlippage] = useState("1.0");
  const [manualTargetAddress, setManualTargetAddress] = useState("");

  // Fetch AA Smart Wallet status
  const { data: smartWallet, refetch: refetchSmartWallet } = useQuery({
    queryKey: ["copytrade-wallet", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;
      const res = await fetch(`/api/copytrade/wallet/${walletAddress}`);
      if (!res.ok) throw new Error("Failed to fetch copytrade wallet");
      return res.json();
    },
    enabled: !!walletAddress,
    refetchInterval: 5000,
  });

  // Fetch followed copytargets registry
  const { data: copytargets, refetch: refetchCopytargets } = useQuery({
    queryKey: ["copytrade-targets", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      const res = await fetch(`/api/copytrade/targets/${walletAddress}`);
      if (!res.ok) throw new Error("Failed to fetch copytrade targets");
      return res.json();
    },
    enabled: !!walletAddress,
    refetchInterval: 5000,
  });

  // Fetch automated execution logs
  const { data: copylogs, refetch: refetchCopylogs } = useQuery({
    queryKey: ["copytrade-actions", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      const res = await fetch(`/api/copytrade/actions/${walletAddress}`);
      if (!res.ok) throw new Error("Failed to fetch copytrade actions");
      return res.json();
    },
    enabled: !!walletAddress,
    refetchInterval: 3000,
  });

  // Sound feedback for new successful copytrade events
  const [lastActionsCount, setLastActionsCount] = useState(0);
  useEffect(() => {
    if (!copylogs) return;
    if (copylogs.length > lastActionsCount) {
      const latest = copylogs[0]; // ordered desc
      if (latest && latest.status === "success") {
        if (latest.side === "buy") {
          playBuySound(Number(latest.mirrorAmount) * 100);
        } else {
          playSellSound(Number(latest.mirrorAmount) * 100);
        }
      } else if (latest && latest.status === "failed") {
        playAlarmSound();
      }
    }
    setLastActionsCount(copylogs?.length || 0);
  }, [copylogs, lastActionsCount]);

  // Sync localStorage followed wallets to backend copytargets registry
  useEffect(() => {
    if (!walletAddress || followedWallets.length === 0) return;
    const syncBookmarks = async () => {
      try {
        for (const addr of followedWallets) {
          await fetch(`/api/copytrade/targets/${walletAddress}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetAddress: addr,
              allocationUsdc: 25.0,
              maxSlippage: 1.0,
              isActive: 1,
            }),
          });
        }
        refetchCopytargets();
      } catch (err) {
        console.error("Failed to sync bookmarks to copytargets", err);
      }
    };
    syncBookmarks();
  }, [walletAddress]);

  const handleDeployWallet = async () => {
    if (!walletAddress) return;
    setIsDeploying(true);
    playHypeSound();
    
    // Cyber scan simulation delay
    await new Promise((resolve) => setTimeout(resolve, 3500));
    
    try {
      const res = await fetch(`/api/copytrade/wallet/${walletAddress}/deploy`, {
        method: "POST",
      });
      if (res.ok) {
        await Promise.all([refetchSmartWallet(), refetchPortfolio()]);
        toast({
          title: "AA SMART WALLET ACTIVATED",
          description: "Deterministic smart contract wallet successfully registered and deployed on Arc Testnet.",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "DEPLOYMENT ERROR",
        description: "Failed to deploy smart contract copytrading wallet.",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleFundWallet = async () => {
    if (!walletAddress || !smartWallet) return;
    const amount = Number(fundingAmount);
    if (Number.isNaN(amount) || amount <= 0) return;

    try {
      const eth = (window as any).ethereum;
      if (eth && state.status === "connected") {
        toast({
          title: "AUTHORIZING DEPOSIT",
          description: `Please confirm the $${amount} USDC transfer in MetaMask to fund your Smart Wallet.`,
        });
        const provider = new BrowserProvider(eth);
        const signer = await provider.getSigner();
        
        const tx = await signer.sendTransaction({
          to: smartWallet.smartWalletAddress,
          value: parseUnits(fundingAmount, 18),
        });
        
        toast({
          title: "DEPOSIT BROADCASTED",
          description: `Transaction pending. Hash: ${tx.hash.slice(0, 10)}...`,
        });
        await tx.wait();
      }

      const res = await fetch(`/api/copytrade/wallet/${walletAddress}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (res.ok) {
        playBuySound(amount * 50);
        await Promise.all([refetchSmartWallet(), refetchPortfolio()]);
        toast({
          title: "DEPOSIT COMPLETED",
          description: `Successfully deposited and credited $${amount} USDC to your Account Abstraction wallet.`,
        });
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 4001) {
        toast({
          variant: "destructive",
          title: "TRANSACTION REJECTED",
          description: "The deposit transaction was rejected in MetaMask.",
        });
      } else {
        // Fallback simulation in case of testnet gas/congestion issues
        try {
          const res = await fetch(`/api/copytrade/wallet/${walletAddress}/fund`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount }),
          });
          if (res.ok) {
            playBuySound(amount * 50);
            await Promise.all([refetchSmartWallet(), refetchPortfolio()]);
            toast({
              title: "DEPOSIT COMPLETED (SIMULATED)",
              description: `Successfully credited $${amount} WUSDC to your Smart Wallet balance.`,
            });
          }
        } catch (simErr) {
          console.error(simErr);
        }
      }
    }
  };

  const handleWithdrawWallet = async () => {
    if (!walletAddress || !smartWallet) return;
    const amount = Number(fundingAmount);
    if (Number.isNaN(amount) || amount <= 0) return;

    if (smartWallet.balanceUsdc < amount) {
      playAlarmSound();
      toast({
        variant: "destructive",
        title: "INSUFFICIENT BALANCE",
        description: `Your smart wallet registry only holds $${smartWallet.balanceUsdc.toFixed(2)} USDC.`,
      });
      return;
    }

    try {
      toast({
        title: "WITHDRAWAL RELAYING",
        description: `Relaying $${amount} USDC from Smart Wallet back to your owner address...`,
      });

      await new Promise((resolve) => setTimeout(resolve, 2500));

      const res = await fetch(`/api/copytrade/wallet/${walletAddress}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (res.ok) {
        playSellSound(amount * 50);
        await Promise.all([
          refetchSmartWallet(),
          refetchPortfolio(),
          state.status === "connected" ? refresh() : Promise.resolve(),
        ]);
        toast({
          title: "WITHDRAWAL SUCCESSFUL",
          description: `Successfully withdrawn $${amount} USDC. Funds are now available in your MetaMask wallet.`,
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "WITHDRAWAL ERROR",
        description: "An error occurred while relaying withdrawal.",
      });
    }
  };

  const handleToggleTargetActive = async (target: any) => {
    if (!walletAddress) return;
    const newActive = target.isActive === 1 ? 0 : 1;
    try {
      const res = await fetch(`/api/copytrade/targets/${walletAddress}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAddress: target.targetAddress,
          allocationUsdc: target.allocationUsdc,
          maxSlippage: target.maxSlippage,
          isActive: newActive,
        }),
      });
      if (res.ok) {
        if (newActive) playHypeSound();
        else playAlarmSound();
        await refetchCopytargets();
        toast({
          title: newActive ? "COPYTRADE ACTIVE" : "COPYTRADE DISARMED",
          description: `Mirrored swap actions for ${formatAddress(target.targetAddress)} are now ${newActive ? "armed" : "disarmed"}.`,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTargetSettings = async (targetAddress: string) => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/copytrade/targets/${walletAddress}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAddress,
          allocationUsdc: Number(editAllocation),
          maxSlippage: Number(editSlippage),
          isActive: 1,
        }),
      });
      if (res.ok) {
        playHypeSound();
        setEditingTarget(null);
        await refetchCopytargets();
        toast({
          title: "TARGET RECONFIGURED",
          description: `Updated copytrade size and slippage thresholds for ${formatAddress(targetAddress)}.`,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTarget = async (targetAddress: string) => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/copytrade/targets/${walletAddress}/${targetAddress}`, {
        method: "DELETE",
      });
      if (res.ok) {
        playAlarmSound();
        const updated = followedWallets.filter(a => a.toLowerCase() !== targetAddress.toLowerCase());
        setFollowedWallets(updated);
        localStorage.setItem("followed_wallets", JSON.stringify(updated));
        await refetchCopytargets();
        toast({
          title: "STOPPED COPYING",
          description: `Disarmed and removed target address ${formatAddress(targetAddress)} from watchlist.`,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddManualTarget = async () => {
    if (!walletAddress || !manualTargetAddress) return;
    const cleanAddr = manualTargetAddress.trim();
    const evmPattern = /^0x[a-fA-F0-9]{40}$/;
    if (!evmPattern.test(cleanAddr)) {
      playAlarmSound();
      toast({
        variant: "destructive",
        title: "INVALID ADDRESS FORMAT",
        description: "Please enter a valid EVM wallet address starting with 0x.",
      });
      return;
    }

    try {
      const res = await fetch(`/api/copytrade/targets/${walletAddress}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAddress: cleanAddr,
          allocationUsdc: 25.0,
          maxSlippage: 1.0,
          isActive: 1,
        }),
      });
      if (res.ok) {
        playHypeSound();
        setManualTargetAddress("");
        await refetchCopytargets();
        if (!followedWallets.includes(cleanAddr)) {
          const updated = [...followedWallets, cleanAddr];
          setFollowedWallets(updated);
          localStorage.setItem("followed_wallets", JSON.stringify(updated));
        }
        toast({
          title: "TARGET REGISTERED",
          description: `Successfully added ${formatAddress(cleanAddr)} to your Copytrading Watchlist!`,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Fetch live ERC20 balances, LP token balances, and pool reserves from the Arc network
  const fetchLiveStats = async () => {
    if (!walletAddress || !portfolioData?.holdings) return;
    setLiveLoading(true);
    try {
      const isOld = state.status === "connected" && state.chainId.toLowerCase() === "0x4e454153";
      const nativeDecimals = isOld ? 6 : 18;
      const provider = getArcReadProvider(state.status === "connected" ? state.chainId : undefined);
      const holdingsList = [];
      const lpsList = [];

      for (const item of portfolioData.holdings) {
        if (!item.contractAddress) continue;

        // Fetch live custom token balance
        const tokenContract = getErc20Contract(item.contractAddress, provider);
        const balanceWei = await tokenContract.balanceOf(walletAddress);
        const decimals = 18;
        const balance = Number(formatUnits(balanceWei, decimals));

        // Fetch live LP balance and calculate contributions if pool exists
        let lpBalance = 0;
        let lpContributedBase = 0;
        let lpContributedQuote = 0;
        let lpContributedValue = 0;
        let lpPercent = 0;

        if (item.pairAddress && item.marketType === "amm_pool") {
          const pairContract = getErc20Contract(item.pairAddress, provider);
          const lpBalanceWei = await pairContract.balanceOf(walletAddress);
          lpBalance = Number(formatUnits(lpBalanceWei, 18));

          if (lpBalance > 0) {
            const lpTotalSupplyWei = await pairContract.totalSupply();
            const lpTotalSupply = Number(formatUnits(lpTotalSupplyWei, 18));
            lpPercent = lpTotalSupply > 0 ? (lpBalance / lpTotalSupply) * 100 : 0;

            try {
              const rawReserves = await readPairReserves(item.pairAddress, provider);
              const reserves = normalizeReserves(rawReserves, item.contractAddress, DEFAULT_ARC_AMM.wusdcAddress);
              const baseContributedWei = (reserves.baseReserve * lpBalanceWei) / lpTotalSupplyWei;
              const quoteContributedWei = (reserves.quoteReserve * lpBalanceWei) / lpTotalSupplyWei;

              lpContributedBase = Number(formatUnits(baseContributedWei, decimals));
              lpContributedQuote = Number(formatUnits(quoteContributedWei, nativeDecimals));
              lpContributedValue = lpContributedQuote * 2;
            } catch (err) {
              console.error("Failed to fetch reserves for pair", item.pairAddress, err);
            }
          }
        }

        const currentPrice = item.currentPrice;
        const totalValue = balance * currentPrice;
        const unrealizedPnl = (currentPrice - item.avgEntryPrice) * balance;

        if (balance > 0 || item.totalBought > 0) {
          holdingsList.push({
            ...item,
            balance,
            totalValue,
            unrealizedPnl,
          });
        }

        if (lpBalance > 0) {
          lpsList.push({
            tokenId: item.tokenId,
            ticker: item.ticker,
            name: item.name,
            logoColor: item.logoColor,
            pairAddress: item.pairAddress,
            lpBalance,
            lpPercent,
            contributedBase: lpContributedBase,
            contributedQuote: lpContributedQuote,
            totalValue: lpContributedValue,
          });
        }
      }

      setLiveHoldings(holdingsList);
      setLiveLps(lpsList);
    } catch (err) {
      console.error("Live balance fetch failed", err);
    } finally {
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    if (!walletAddress || !portfolioData?.holdings) return;
    fetchLiveStats();

    const interval = setInterval(fetchLiveStats, 15000);
    return () => clearInterval(interval);
  }, [walletAddress, portfolioData]);

  const handleManualRefresh = async () => {
    await Promise.all([refetchPortfolio(), fetchLiveStats()]);
    toast({
      title: "PORTFOLIO SYNCHRONIZED",
      description: "Live on-chain balances and trades re-indexed successfully.",
    });
  };

  // 3. Analytics summaries
  const usdcBalanceNumber = state.status === "connected" ? Number(state.usdcBalance) || 0 : 0;
  const holdingValueSum = liveHoldings.reduce((sum, item) => sum + item.totalValue, 0);
  const lpValueSum = liveLps.reduce((sum, item) => sum + item.totalValue, 0);
  const netWorth = usdcBalanceNumber + holdingValueSum + lpValueSum;

  const totalRealizedPnl = liveHoldings.reduce((sum, item) => sum + item.realizedPnl, 0);
  const totalUnrealizedPnl = liveHoldings.reduce((sum, item) => sum + item.unrealizedPnl, 0);

  const biggestPosition = useMemo(() => {
    if (liveHoldings.length === 0) return null;
    return [...liveHoldings].sort((a, b) => b.totalValue - a.totalValue)[0];
  }, [liveHoldings]);

  if (!walletAddress) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md w-full border-border/80 bg-card/45 backdrop-blur-md p-6 text-center font-mono space-y-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary animate-pulse">
            <WalletCards className="h-6 w-6" />
          </div>
          <CardTitle className="text-base uppercase tracking-widest text-primary font-bold">Connect Wallet</CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Please connect your wallet in the navigation header, or select a trader from the terminal to track their profile, holdings, and execution history.
          </p>
        </Card>
      </div>
    );
  }

  const isPositiveRealized = totalRealizedPnl >= 0;
  const isPositiveUnrealized = totalUnrealizedPnl >= 0;

  return (
    <div className="flex-1 p-4 md:p-6 pb-20">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div>
            <div className="mb-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] terminal-pulse" />
              Wallet Portfolio OS
            </div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2.5">
              Portfolio Overview
            </h1>
            <div className="font-mono text-[10px] text-muted-foreground/80 mt-1 break-all">
              Index: <span className="text-foreground/90 select-all font-semibold">{walletAddress}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={liveLoading}
              className="h-9 font-mono text-xs uppercase gap-2"
            >
              {liveLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Sync Registry
            </Button>
          </div>
        </div>

        {/* Analytics Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <OverviewCard
            label="Net Worth"
            value={`$${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subText={`Gas: $${usdcBalanceNumber.toLocaleString()} USDC · LP: $${lpValueSum.toLocaleString()}`}
            icon={<WalletCards className="h-4 w-4 text-primary" />}
            active
          />
          <OverviewCard
            label="Realized PnL"
            value={`${isPositiveRealized ? "+" : ""}$${totalRealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subText="Realized from closed positions"
            icon={isPositiveRealized ? <TrendingUp className="h-4 w-4 text-primary" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
            colorClass={isPositiveRealized ? "text-primary font-bold" : "text-destructive font-bold"}
          />
          <OverviewCard
            label="Unrealized PnL"
            value={`${isPositiveUnrealized ? "+" : ""}$${totalUnrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subText="Floating profit/loss on custom bags"
            icon={isPositiveUnrealized ? <TrendingUp className="h-4 w-4 text-primary" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
            colorClass={isPositiveUnrealized ? "text-primary font-bold" : "text-destructive font-bold"}
          />
          {biggestPosition ? (
            <OverviewCard
              label="Biggest Position"
              value={`$${biggestPosition.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              subText={`Asset: $${biggestPosition.ticker} (${formatBalance(biggestPosition.balance)} tokens)`}
              icon={<Award className="h-4 w-4 text-yellow-400" />}
            />
          ) : (
            <OverviewCard
              label="Biggest Position"
              value="N/A"
              subText="No custom positions loaded"
              icon={<Award className="h-4 w-4 text-muted-foreground" />}
            />
          )}
        </div>

        {/* Primary Sections Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          
          <div className="min-w-0 space-y-6">
            
            {/* Holdings Segment */}
            <Card className="border-border bg-card/45 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Assets & Holdings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {liveHoldings.length === 0 ? (
                  <div className="p-8 text-center font-mono text-xs text-muted-foreground">
                    No custom tokens traded or held in this wallet.
                  </div>
                ) : (
                  <table className="w-full min-w-[700px] border-collapse text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border/50 text-[10px] text-muted-foreground uppercase tracking-wider bg-secondary/10">
                        <th className="p-3">Asset</th>
                        <th className="p-3 text-right">Balance</th>
                        <th className="p-3 text-right">Avg Entry</th>
                        <th className="p-3 text-right">Current Price</th>
                        <th className="p-3 text-right">Market Value</th>
                        <th className="p-3 text-right">Realized PnL</th>
                        <th className="p-3 text-right">Unrealized PnL</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {liveHoldings.map((item) => {
                        const isHoldingPositiveRealized = item.realizedPnl >= 0;
                        const isHoldingPositiveUnrealized = item.unrealizedPnl >= 0;
                        return (
                          <tr key={item.tokenId} className="hover:bg-secondary/15 transition-colors">
                            <td className="p-3 font-semibold flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.logoColor || "#22c55e" }} />
                              <Link href={`/token/${item.tokenId}`} className="hover:underline text-foreground">
                                ${item.ticker}
                              </Link>
                              <span className="text-[10px] text-muted-foreground font-normal">({item.name})</span>
                            </td>
                            <td className="p-3 text-right font-bold">{formatBalance(item.balance)}</td>
                            <td className="p-3 text-right text-muted-foreground">${formatPrice(item.avgEntryPrice)}</td>
                            <td className="p-3 text-right" style={{ color: item.logoColor || "#22c55e" }}>${formatPrice(item.currentPrice)}</td>
                            <td className="p-3 text-right font-bold">${item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                            <td className={`p-3 text-right font-semibold ${isHoldingPositiveRealized ? "text-primary" : "text-destructive"}`}>
                              {isHoldingPositiveRealized ? "+" : ""}${item.realizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className={`p-3 text-right font-semibold ${isHoldingPositiveUnrealized ? "text-primary" : "text-destructive"}`}>
                              {isHoldingPositiveUnrealized ? "+" : ""}${item.unrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-center">
                              <Button asChild variant="ghost" size="icon" className="h-6 w-6 hover:bg-secondary/40 rounded-full">
                                <Link href={`/token/${item.tokenId}`}>
                                  <ArrowUpRight className="h-3.5 w-3.5" style={{ color: item.logoColor }} />
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Liquidity Positions Segment */}
            <Card className="border-border bg-card/45 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Active Liquidity Positions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {liveLps.length === 0 ? (
                  <div className="p-8 text-center font-mono text-xs text-muted-foreground">
                    No active liquidity pools backed by this wallet.
                  </div>
                ) : (
                  <table className="w-full min-w-[700px] border-collapse text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border/50 text-[10px] text-muted-foreground uppercase tracking-wider bg-secondary/10">
                        <th className="p-3">Liquidity Pair</th>
                        <th className="p-3 text-right">Contributed Shares</th>
                        <th className="p-3 text-right">Pool Ownership</th>
                        <th className="p-3 text-right">LP Tokens</th>
                        <th className="p-3 text-right">LP Value</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {liveLps.map((item) => (
                        <tr key={item.tokenId} className="hover:bg-secondary/15 transition-colors">
                          <td className="p-3 font-semibold">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.logoColor }} />
                              <span>{item.ticker}/WUSDC</span>
                            </div>
                          </td>
                          <td className="p-3 text-right text-muted-foreground leading-normal">
                            <div>{formatBalance(item.contributedBase)} {item.ticker}</div>
                            <div className="text-[10px] text-muted-foreground/60">{formatBalance(item.contributedQuote)} WUSDC</div>
                          </td>
                          <td className="p-3 text-right font-bold text-primary">{item.lpPercent.toFixed(4)}%</td>
                          <td className="p-3 text-right">{formatBalance(item.lpBalance)} LP</td>
                          <td className="p-3 text-right font-bold text-foreground">${item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-3 text-center">
                            <Button asChild variant="ghost" size="icon" className="h-6 w-6 hover:bg-secondary/40 rounded-full">
                              <Link href={`/token/${item.tokenId}`}>
                                <ArrowUpRight className="h-3.5 w-3.5" style={{ color: item.logoColor }} />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
            {/* Smart Copytrading AA Wallet HUD */}
            <Card className="border-border bg-card/45 backdrop-blur-md relative overflow-hidden">
              {isDeploying && (
                <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-4" />
                  <div className="font-mono text-xs uppercase tracking-widest text-primary animate-pulse space-y-1">
                    <div>[INF] ACCESSING DEPLOYER FACTORY...</div>
                    <div className="text-[10px] text-muted-foreground">[OK] GENERATING SMART DETERMINISTIC CONTEXT...</div>
                    <div className="text-[10px] text-primary/70">[SYNC] BROADCASTING AA WALLET BYTECODE...</div>
                  </div>
                </div>
              )}
              
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="font-mono text-xs uppercase tracking-widest text-primary flex items-center justify-between w-full">
                  <span className="flex items-center gap-2">
                    <WalletCards className="h-4 w-4 text-primary" />
                    Account Abstraction (AA) Smart Wallet Console
                  </span>
                  {smartWallet?.isDeployed ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      🟢 ACTIVE & ARMED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded">
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                      ⚠️ NOT DEPLOYED
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-border/60 rounded p-4 bg-card/25 space-y-3">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Smart Wallet Registry Address</div>
                    <div className="font-mono text-xs text-foreground bg-black/40 p-2.5 rounded border border-border/40 select-all font-semibold break-all">
                      {smartWallet?.smartWalletAddress || "Loading deterministic context..."}
                    </div>
                    {!smartWallet?.isDeployed ? (
                      <Button
                        onClick={handleDeployWallet}
                        className="w-full text-black bg-primary hover:bg-primary/80 font-extrabold text-[11px] uppercase tracking-wider h-9"
                      >
                        Deploy Smart Wallet on-chain
                      </Button>
                    ) : (
                      <div className="rounded border border-primary/20 bg-primary/5 p-2.5 font-mono text-[9px] text-primary text-center flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider">
                        <CheckCircle className="w-3.5 h-3.5 text-primary stroke-[2.5]" />
                        <span>Deterministic AA Contract Fully Deployed</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="border border-border/60 rounded p-4 bg-card/25 flex flex-col justify-between gap-3">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">USDC Gas & Trading Balance</div>
                      <div className="font-mono text-2xl font-black text-primary drop-shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                        ${smartWallet?.balanceUsdc?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"} <span className="text-xs font-normal text-muted-foreground">WUSDC</span>
                      </div>
                    </div>
                    {smartWallet?.isDeployed ? (
                      <div className="flex gap-2 items-center">
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-2 text-[10px] text-muted-foreground font-mono">$</span>
                          <input
                            type="number"
                            value={fundingAmount}
                            onChange={(e) => setFundingAmount(e.target.value)}
                            className="w-full h-8 pl-5 pr-2 rounded bg-black/40 border border-border/50 text-xs font-mono focus:border-primary/50 outline-none text-foreground"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={handleFundWallet}
                          className="h-8 text-black bg-primary hover:bg-primary/80 font-extrabold text-[10px] px-3 shrink-0"
                        >
                          Deposit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleWithdrawWallet}
                          className="h-8 border-primary/30 hover:border-primary text-primary hover:bg-primary/10 font-extrabold text-[10px] px-3 shrink-0"
                        >
                          Withdraw
                        </Button>
                      </div>
                    ) : (
                      <div className="font-mono text-[10px] text-muted-foreground/80 italic">
                        Deploy your smart wallet above to unlock trading deposit telemetry.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Smart Money Watchlist & Control HUD */}
            <Card className="border-border bg-card/45 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary animate-pulse" />
                  Smart Money Copytrading Registry
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Manual Target Addition Row */}
                <div className="border border-primary/20 rounded bg-primary/5 p-3.5 flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex-1 w-full space-y-1">
                    <label className="block font-mono text-[9px] uppercase tracking-widest text-primary">Manually Index Custom Target Address</label>
                    <input
                      type="text"
                      placeholder="Enter 0x target trader address..."
                      value={manualTargetAddress}
                      onChange={(e) => setManualTargetAddress(e.target.value)}
                      className="w-full h-8 px-2.5 rounded bg-black/50 border border-primary/30 text-xs font-mono text-foreground focus:border-primary outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <Button
                    onClick={handleAddManualTarget}
                    disabled={!manualTargetAddress}
                    className="h-8 w-full sm:w-auto text-black bg-primary hover:bg-primary/80 font-extrabold text-[10px] uppercase tracking-wider px-5 shrink-0 self-end"
                  >
                    Add Target Wallet
                  </Button>
                </div>

                {!copytargets || copytargets.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground text-xs uppercase font-semibold border border-border/60 rounded p-4 bg-card/10">
                    No bookmarked smart money wallets. Visit the <Link href="/leaderboard" className="text-primary hover:underline">Arena Leaderboard</Link> to follow high-performing traders or enter any custom target address above.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {copytargets.map((target: any) => {
                      const isEditing = editingTarget === target.targetAddress;
                      return (
                        <div
                          key={target.targetAddress}
                          className="border border-border/60 rounded p-4 bg-card/25 flex flex-col gap-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${target.isActive === 1 ? "bg-primary animate-ping" : "bg-muted"}`} />
                                <Link
                                  href={`/wallet/${target.targetAddress}`}
                                  className="font-bold hover:text-primary transition-colors truncate block text-xs"
                                >
                                  {target.targetAddress}
                                </Link>
                              </div>
                              <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 font-mono">
                                <span>Size Limit: <strong className="text-foreground">${target.allocationUsdc} USDC</strong></span>
                                <span>Max Slippage: <strong className="text-foreground">{target.maxSlippage}%</strong></span>
                                <span>Status: <strong className={target.isActive === 1 ? "text-primary" : "text-yellow-500"}>{target.isActive === 1 ? "ACTIVE & ARMED" : "DISARMED"}</strong></span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleTargetActive(target)}
                                className={`h-8 font-mono text-[10px] px-3 ${target.isActive === 1 ? "border-yellow-500/30 hover:border-yellow-500 text-yellow-500 hover:bg-yellow-500/10" : "border-primary/30 hover:border-primary text-primary hover:bg-primary/10"}`}
                              >
                                {target.isActive === 1 ? "Disarm Auto" : "Arm Auto"}
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingTarget(null);
                                  } else {
                                    setEditingTarget(target.targetAddress);
                                    setEditAllocation(String(target.allocationUsdc));
                                    setEditSlippage(String(target.maxSlippage));
                                  }
                                }}
                                className="h-8 border-border text-muted-foreground hover:text-foreground text-[10px] px-3 font-mono"
                              >
                                {isEditing ? "Cancel" : "Configure"}
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteTarget(target.targetAddress)}
                                className="h-8 border-destructive/30 hover:border-destructive hover:bg-destructive/10 text-destructive text-[10px] px-3 font-mono"
                              >
                                Delete
                              </Button>
                            </div>
                          </div>

                          {isEditing && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border/30 pt-3 font-mono text-xs">
                              <div>
                                <label className="block text-[10px] text-muted-foreground uppercase mb-1">Max Allocation size</label>
                                <div className="relative">
                                  <span className="absolute left-2 top-1.5 text-[10px] text-muted-foreground">$</span>
                                  <input
                                    type="number"
                                    value={editAllocation}
                                    onChange={(e) => setEditAllocation(e.target.value)}
                                    className="w-full h-8 pl-4 pr-2 rounded bg-black/40 border border-border/50 text-xs text-foreground focus:border-primary/50 outline-none"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] text-muted-foreground uppercase mb-1">Slippage threshold</label>
                                <div className="relative">
                                  <span className="absolute right-2 top-1.5 text-[10px] text-muted-foreground">%</span>
                                  <input
                                    type="number"
                                    value={editSlippage}
                                    step="0.1"
                                    onChange={(e) => setEditSlippage(e.target.value)}
                                    className="w-full h-8 pl-2 pr-4 rounded bg-black/40 border border-border/50 text-xs text-foreground focus:border-primary/50 outline-none"
                                  />
                                </div>
                              </div>
                              <div className="flex items-end">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveTargetSettings(target.targetAddress)}
                                  className="w-full h-8 text-black bg-primary hover:bg-primary/80 font-extrabold text-[10px] uppercase tracking-wider"
                                >
                                  Save Configuration
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scrolling Cyber Relayer Dispatch Console Logs */}
            <Card className="border-border bg-card/45 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary animate-pulse" />
                  Automated Relayer Dispatcher Audits
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-black/85 font-mono text-[10px] text-primary p-4 h-[240px] overflow-y-auto space-y-2.5 leading-relaxed border-b border-border/30 select-none hide-scrollbar">
                  {!copylogs || copylogs.length === 0 ? (
                    <div className="text-muted-foreground text-center py-12 italic">
                      [SYS] Relayer dispatcher initialized. Awaiting on-chain swap events on indexed target addresses...
                    </div>
                  ) : (
                    [...copylogs].reverse().map((log: any, idx: number) => {
                      const timeStr = new Date(log.timestamp).toLocaleTimeString();
                      return (
                        <div key={log.id || idx} className="space-y-1 border-b border-border/10 pb-2">
                          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                            <span>[{timeStr}] INT BLOCK CAPTURE</span>
                            <span className="text-primary/60">TARGET TX: {formatAddress(log.targetTxHash)}</span>
                          </div>
                          <div className="text-foreground">
                            [OK] Target <span className="text-yellow-400 font-bold">{formatAddress(log.targetAddress)}</span> executed <span className={log.side === "buy" ? "text-primary" : "text-destructive"}>{log.side.toUpperCase()}</span> swap of <strong className="text-foreground">{formatBalance(log.targetAmount)}</strong> tokens.
                          </div>
                          {log.status === "success" ? (
                            <div className="text-primary flex flex-wrap items-center gap-x-2">
                              <span>⚡ Paymaster sponsored gas. Status: [SUCCESS]</span>
                              <span>· Mirrored swap: {formatBalance(log.mirrorAmount)} tokens @ ${formatPrice(log.mirrorPrice)}</span>
                              <a
                                href={`https://testnet.arcscan.app/tx/${log.mirrorTxHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline hover:text-primary/80 font-bold ml-auto flex items-center gap-0.5"
                              >
                                [VIEW RX] <ArrowUpRight className="w-3 h-3" />
                              </a>
                            </div>
                          ) : (
                            <div className="text-destructive font-bold uppercase">
                              ⚠️ Status: [MIRROR FAILURE] - {log.error || "Unknown execution slip"}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trade History Sidebar */}
          <aside className="w-full">
            <Card className="border-border bg-card/45 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  Recent Trades
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[580px] overflow-y-auto hide-scrollbar">
                {!portfolioData?.trades || portfolioData.trades.length === 0 ? (
                  <div className="p-8 text-center font-mono text-xs text-muted-foreground">
                    No recent trades found for this address.
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {portfolioData.trades.map((trade: any) => {
                      const tok = liveHoldings.find(t => t.tokenId === trade.tokenId);
                      const color = tok?.logoColor || "#22c55e";
                      const isBuy = trade.side === "buy";
                      return (
                        <a
                          key={trade.id}
                          href={`https://testnet.arcscan.app/tx/${trade.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block p-3.5 font-mono text-xs hover:bg-secondary/15 transition-colors group"
                        >
                          <div className="flex justify-between items-center text-[10px] mb-1">
                            <span className={`px-1.5 rounded-[2px] font-bold text-[9px] uppercase tracking-wider ${isBuy ? "bg-primary/10 text-primary border border-primary/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                              {trade.side}
                            </span>
                            <span className="text-muted-foreground">{new Date(trade.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="flex justify-between gap-2 mt-1">
                            <span className="font-bold flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                              <span>{formatBalance(trade.tokenAmount)}</span>
                              <span style={{ color }}>${tok?.ticker || "TOKEN"}</span>
                            </span>
                            <span className="font-bold text-foreground/80">${formatBalance(trade.wusdcAmount)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-muted-foreground/60 mt-1.5 group-hover:text-muted-foreground transition-colors">
                            <span>Price: ${formatPrice(trade.executionPrice)}</span>
                            <span>Tx: {formatAddress(trade.txHash)}</span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>

        </div>

      </div>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  subText,
  icon,
  active = false,
  colorClass = "text-foreground"
}: {
  label: string;
  value: string;
  subText: string;
  icon?: React.ReactNode;
  active?: boolean;
  colorClass?: string;
}) {
  return (
    <Card className="border-border/80 bg-card/45 backdrop-blur-md p-4 flex flex-col justify-between hover:border-primary/20 transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className={`mt-1 font-mono text-xl font-bold tracking-tight ${active ? "text-primary drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]" : colorClass}`}>
            {value}
          </div>
        </div>
        <div className="opacity-70 group-hover:opacity-100 transition-opacity mt-0.5">
          {icon}
        </div>
      </div>
      <div className="mt-2.5 font-mono text-[9px] text-muted-foreground/70 tracking-wide border-t border-border/20 pt-2">
        {subText}
      </div>
    </Card>
  );
}
