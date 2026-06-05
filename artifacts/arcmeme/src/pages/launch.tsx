import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLaunchToken,
  getGetTokenQueryKey,
  getListTokensQueryKey,
  getGetTrendingTokensQueryKey,
  getGetPlatformStatsQueryKey,
  ListTokensSort,
  type PlatformStats,
  type Token,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/use-wallet";
import { useDeployToken, ARC_EXPLORER } from "@/hooks/use-deploy-token";
import { useCreateLiquidityPool } from "@/hooks/use-create-liquidity-pool";
import { motion } from "framer-motion";
import { Upload, X, ImageIcon, CheckCircle, Loader2, ExternalLink, Globe, Twitter, Send, Terminal, Cpu, Check, AlertCircle } from "lucide-react";

const SUPPLY_PRESETS = [
  { label: "1M", value: 1_000_000 },
  { label: "100M", value: 100_000_000 },
  { label: "1B", value: 1_000_000_000 },
  { label: "100B", value: 100_000_000_000 },
];

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  ticker: z.string().min(1, "Ticker is required").max(10).transform(v => v.toUpperCase()),
  description: z.string().min(10, "Description needs at least 10 chars"),
  totalSupply: z.coerce.number().min(1, "Supply must be at least 1").max(1_000_000_000_000_000, "Supply too large"),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  twitter: z.string().optional().or(z.literal("")),
  telegram: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  logoColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
});

function getApiErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "Unknown API error.";

  const data = (error as { data?: unknown }).data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message = record.message ?? record.error;
    if (typeof message === "string" && message.trim()) return message;
  }

  const message = (error as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) return message;

  return "Unknown API error.";
}

function compressImage(file: File, maxDimension = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(maxDimension / img.width, maxDimension / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function LaunchPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const launchToken = useLaunchToken();
  const { state: walletState } = useWallet();
  const { deployStatus, deploy, reset: resetDeploy } = useDeployToken();
  const {
    amm,
    status: liquidityStatus,
    createLiquidityPool,
    reset: resetLiquidity,
  } = useCreateLiquidityPool();
  const [success, setSuccess] = useState(false);
  const [launchedToken, setLaunchedToken] = useState<Token | null>(null);
  const [deployedContractAddress, setDeployedContractAddress] = useState<string | null>(null);
  const [liquidityTokenAmount, setLiquidityTokenAmount] = useState("");
  const [liquidityUsdcAmount, setLiquidityUsdcAmount] = useState("1");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOneClick, setIsOneClick] = useState(true);
  const [oneClickWusdcAmount, setOneClickWusdcAmount] = useState("50");

  const connectedAddress =
    walletState.status === "connected" ? walletState.address : undefined;
  const hasMetaMask = typeof window !== "undefined" && !!(window as { ethereum?: unknown }).ethereum;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      ticker: "",
      description: "",
      totalSupply: 1_000_000_000,
      website: "",
      twitter: "",
      telegram: "",
      logoColor: "#8b5cf6",
    },
  });

  const watchAll = form.watch();

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Invalid file", description: "Please upload an image file." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Max image size is 10MB." });
      return;
    }
    try {
      const compressed = await compressImage(file);
      setLogoPreview(compressed);
      setLogoBase64(compressed);
    } catch {
      toast({ variant: "destructive", title: "Upload failed", description: "Could not process the image." });
    }
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    let contractAddress: string | undefined;

    // If MetaMask is available and wallet is connected, deploy the real ERC20 contract
    if (hasMetaMask && walletState.status === "connected") {
      const addr = await deploy(values.name, values.ticker, values.totalSupply);
      if (!addr) return; // user rejected or error — deployStatus.error will show the message
      contractAddress = addr;
      setDeployedContractAddress(addr);
    }

    // Save the token to the API (with or without a contract address)
    launchToken.mutate(
      {
        data: {
          ...values,
          logoImage: logoBase64 ?? undefined,
          contractAddress,
          creatorAddress: connectedAddress,
        },
      },
      {
        onSuccess: async (token) => {
          const newestQueryKey = getListTokensQueryKey({
            sort: ListTokensSort.newest,
            limit: 50,
          });

          queryClient.setQueryData<Token[]>(newestQueryKey, (previous) => {
            const existing = previous ?? [];
            return [token, ...existing.filter((item) => item.id !== token.id)].slice(0, 50);
          });

          queryClient.setQueryData<PlatformStats>(
            getGetPlatformStatsQueryKey(),
            (previous) => ({
              totalTokens: (previous?.totalTokens ?? 0) + 1,
              totalVolume24h: previous?.totalVolume24h ?? 0,
              totalMarketCap: (previous?.totalMarketCap ?? 0) + token.marketCap,
              activeTraders: (previous?.activeTraders ?? 0) + token.holders,
              tokensLaunched24h: (previous?.tokensLaunched24h ?? 0) + 1,
            }),
          );

          queryClient.invalidateQueries({ queryKey: getListTokensQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTrendingTokensQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPlatformStatsQueryKey() });
          setLaunchedToken(token);
          
          const defaultTokenAmt = String(Math.max(Math.floor(token.totalSupply * 0.1), 1));
          setLiquidityTokenAmount(defaultTokenAmt);
          setLiquidityUsdcAmount(oneClickWusdcAmount);

          if (isOneClick && contractAddress) {
            setSuccess(true);
            toast({
              title: "Token Metadata Saved!",
              description: "ERC20 deployed and registered. Initializing automated pool creation...",
            });

            // Automatically trigger creation of ApexiSwap pool on-chain
            try {
              const updatedToken = await createLiquidityPool({
                token,
                tokenAmount: defaultTokenAmt,
                wusdcAmount: oneClickWusdcAmount,
              });

              if (updatedToken) {
                setLaunchedToken(updatedToken);
                queryClient.setQueryData<Token>(getGetTokenQueryKey(updatedToken.id), updatedToken);
                queryClient.invalidateQueries({ queryKey: getListTokensQueryKey() });
                queryClient.invalidateQueries({ queryKey: getGetTrendingTokensQueryKey() });
                toast({
                  title: "1-Click Launch Succeeded!",
                  description: `Seeded ${updatedToken.ticker}/WUSDC LP pool on ApexiSwap. Active now!`,
                });
              }
            } catch (err) {
              console.error("[1-click] Seeding failed:", err);
            }
          } else {
            resetLiquidity();
            setSuccess(true);
            toast({
              title: "Token Launched!",
              description: contractAddress
                ? "ERC20 deployed. Create a TOKEN/WUSDC pool to make it tradeable."
                : "Token saved. Connect MetaMask to deploy on-chain next time.",
            });
          }
        },
        onError: (error) => {
          console.error("[launch] Failed to save token metadata", error);
          resetDeploy();
          toast({
            variant: "destructive",
            title: "Save Failed",
            description: `Contract deployed but metadata save failed: ${getApiErrorMessage(error)}`,
          });
        },
      }
    );
  };

  const isLaunching =
    deployStatus.status === "switching-network" ||
    deployStatus.status === "confirming" ||
    deployStatus.status === "deploying" ||
    deployStatus.status === "retrying" ||
    launchToken.isPending;

  const isCreatingLiquidity =
    liquidityStatus.status === "detecting-pair" ||
    liquidityStatus.status === "creating-pair" ||
    liquidityStatus.status === "wrapping-usdc" ||
    liquidityStatus.status === "approving" ||
    liquidityStatus.status === "adding-liquidity" ||
    liquidityStatus.status === "saving-market";

  const liquidityStepLabel =
    liquidityStatus.status === "detecting-pair" ? "Detecting or creating TOKEN/WUSDC pair..." :
    liquidityStatus.status === "creating-pair" ? "Creating TOKEN/WUSDC pair..." :
    liquidityStatus.status === "wrapping-usdc" ? "Wrapping native USDC..." :
    liquidityStatus.status === "approving" ? "Approving TOKEN and WUSDC..." :
    liquidityStatus.status === "adding-liquidity" ? "Adding initial liquidity..." :
    liquidityStatus.status === "saving-market" ? "Saving market metadata..." :
    "Create Liquidity Pool";

  const handleCreateLiquidity = async () => {
    if (!launchedToken) return;

    const updatedToken = await createLiquidityPool({
      token: launchedToken,
      tokenAmount: liquidityTokenAmount,
      wusdcAmount: liquidityUsdcAmount,
    });

    if (!updatedToken) return;

    setLaunchedToken(updatedToken);
    queryClient.setQueryData<Token>(getGetTokenQueryKey(updatedToken.id), updatedToken);
    queryClient.invalidateQueries({ queryKey: getListTokensQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTrendingTokensQueryKey() });
    toast({
      title: "Liquidity Pool Created",
      description: `${updatedToken.ticker}/WUSDC is ready for market tracking.`,
    });
  };

  const getTerminalLogs = () => {
    let activeKey = "idle";
    const isRetrying = deployStatus.status === "retrying";
    
    if (deployStatus.status !== "idle" && deployStatus.status !== "success" && deployStatus.status !== "error") {
      activeKey = isRetrying ? "deploying" : deployStatus.status;
    } else if (launchToken.isPending) {
      activeKey = "saving";
    } else if (liquidityStatus.status !== "idle" && liquidityStatus.status !== "success" && liquidityStatus.status !== "error") {
      activeKey = liquidityStatus.status;
    } else if (liquidityStatus.status === "success" || (launchedToken?.marketType === "amm_pool" && launchedToken.pairAddress)) {
      activeKey = "saving-market";
    }

    const steps = [
      { key: "switching-network", prefix: "NET", text: "Initializing RPC network handshake on Arc Testnet..." },
      { key: "confirming", prefix: "WAL", text: "Transmitting ERC20 smart contract deploy signature request..." },
      { key: "deploying", prefix: "ERC", text: `Mining contract bytes for $${watchAll.ticker || "TOKEN"} ($${watchAll.name || "Token"})...` },
      { key: "saving", prefix: "SYS", text: "Registering immutable reserves and token logo metadata in core registry..." },
      { key: "detecting-pair", prefix: "LP ", text: "Soliciting ApexiSwap factory node for pair contract address..." },
      { key: "wrapping-usdc", prefix: "LP ", text: `Wrapping native USDC to WUSDC pool reserve tokens (${oneClickWusdcAmount} USDC)...` },
      { key: "approving", prefix: "WAL", text: "Requesting MetaMask spend permission allowance for router contract..." },
      { key: "adding-liquidity", prefix: "LP ", text: "Depositing pool seeds: 10% of total supply & WUSDC reserve balance..." },
      { key: "saving-market", prefix: "SYS", text: "Activating real-time volume, price indexers and telemetry relayers..." },
    ];

    const logs: { text: string; status: "done" | "active" | "pending"; timestamp: string }[] = [];
    const stepsOrder = [
      "switching-network", "confirming", "deploying", "saving",
      "detecting-pair", "wrapping-usdc", "approving", "adding-liquidity", "saving-market"
    ];
    const currentIdx = stepsOrder.indexOf(activeKey);

    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];

    steps.forEach((s, idx) => {
      let status: "done" | "active" | "pending" = "pending";
      if (idx < currentIdx) {
        status = "done";
      } else if (idx === currentIdx) {
        status = "active";
      }

      let logText = s.text;
      
      if (s.key === "deploying" && deployedContractAddress) {
        logText = `Contract mined successfully. Address: ${deployedContractAddress}`;
      } else if (s.key === "deploying" && deployStatus.status === "deploying" && (deployStatus as { txHash?: string }).txHash) {
        logText = `ERC20 contract mining commenced. Tx Hash: ${(deployStatus as { txHash: string }).txHash}`;
      }

      if (s.key === "saving" && !launchToken.isPending && idx < currentIdx) {
        logText = "Token metadata saved and cached in memory registry.";
      }

      if (s.key === "detecting-pair" && launchedToken?.pairAddress) {
        logText = `AMM swap pair created: ${launchedToken.pairAddress}`;
      }

      if (s.key === "saving-market" && (liquidityStatus.status === "success" || launchedToken?.pairAddress)) {
        logText = "ApexiSwap pool live! mutator indices fully operational.";
      }

      logs.push({
        text: `[${s.prefix}] ${logText}`,
        status,
        timestamp: timeStr
      });
    });

    return { logs, activeIndex: currentIdx };
  };

  if (success) {
    const marketReady = launchedToken?.marketType === "amm_pool" && launchedToken.pairAddress;
    const { logs, activeIndex } = getTerminalLogs();
    const progressPercent = Math.min(Math.round(((activeIndex + 1) / logs.length) * 100), 100);

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 py-12 text-center min-h-[75vh] font-mono space-y-6 max-w-4xl mx-auto w-full">
        {/* Decorative Radar Sweep node */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/30 shadow-[0_0_20px_rgba(34,197,94,0.15)] animate-pulse">
          {marketReady ? (
            <Check className="h-10 w-10 text-primary stroke-[3px]" />
          ) : isOneClick && liquidityStatus.status === "error" ? (
            <X className="h-10 w-10 text-destructive stroke-[3px]" />
          ) : isOneClick ? (
            <Terminal className="h-8 w-8 text-primary animate-pulse" />
          ) : (
            <Check className="h-10 w-10 text-primary stroke-[3px]" />
          )}
          
          <div className="absolute inset-0 rounded-full border border-dashed border-primary/45 animate-[spin_8s_linear_infinite]" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-foreground">
            {marketReady ? "LAUNCH_SEQUENCE_COMPLETE" : isOneClick && liquidityStatus.status === "error" ? "MUTATOR_SEQUENCE_FAULT" : "LAUNCH_SEQUENCE_ACTIVE"}
          </h1>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {marketReady 
              ? "All smart contracts deployed and AMM swap pair pool is fully seeded and online." 
              : "Synchronizing nodes and compiling bytecode. Verify transaction prompts in MetaMask."}
          </p>
        </div>

        {/* Scrolling Hacker Logs Console */}
        <div className="relative border border-primary/20 bg-black/80 rounded-xl overflow-hidden shadow-[0_0_25px_rgba(34,197,94,0.1)] w-full text-left max-w-2xl">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-primary/15 bg-primary/5 text-[9px] font-bold text-primary/80">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span>TERMINAL DIRECT DEPLOYER: ACTIVE</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
              <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
            </div>
          </div>

          {/* Matrix Logs */}
          <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto text-[11px] leading-relaxed bg-[linear-gradient(rgba(34,197,94,0.015)_1px,transparent_1px)] bg-[size:100%_12px]">
            {logs.map((log, idx) => {
              const isDone = log.status === "done";
              const isActive = log.status === "active";
              
              return (
                <div 
                  key={idx} 
                  className={`flex items-start gap-3 transition-opacity duration-300 ${
                    isDone ? "text-primary/95" : isActive ? "text-foreground font-bold" : "text-muted-foreground/35"
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground/60 select-none">
                    [{log.timestamp}]
                  </span>
                  
                  {isDone ? (
                    <span className="text-primary flex-shrink-0 font-bold">[OK]</span>
                  ) : isActive ? (
                    <span className="text-primary flex-shrink-0 font-bold animate-pulse">&gt;&gt;</span>
                  ) : (
                    <span className="text-muted-foreground/30 flex-shrink-0">..</span>
                  )}
                  
                  <span className={isActive ? "animate-pulse" : ""}>
                    {log.text}
                    {isActive && <span className="ml-1 animate-ping">_</span>}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress Bar HUD */}
          <div className="border-t border-primary/15 bg-black/60 px-4 py-2 flex items-center justify-between text-[9px] font-bold text-muted-foreground">
            <div className="flex-1 flex items-center gap-3 mr-4">
              <span>PROGRESS:</span>
              <div className="flex-1 h-2 bg-muted/20 rounded border border-border/40 overflow-hidden relative">
                <div 
                  className="h-full bg-primary shadow-[0_0_8px_var(--color-primary)] transition-all duration-500" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <div className="text-primary">{progressPercent}%</div>
          </div>
        </div>

        {/* Telemetry Address Badges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl text-left">
          {deployedContractAddress && (
            <div className="p-4 bg-black/45 border border-primary/20 rounded-xl space-y-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-primary/5 to-transparent pointer-events-none" />
              <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-primary" />
                ERC20 TOKEN CONTRACT
              </div>
              <div className="font-mono text-primary text-xs break-all selection:bg-primary/20">
                {deployedContractAddress}
              </div>
              <a
                href={`${ARC_EXPLORER}/address/${deployedContractAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-primary/75 hover:text-primary transition-colors hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Inspect on Arc Explorer
              </a>
            </div>
          )}

          {launchedToken?.pairAddress && (
            <div className="p-4 bg-black/45 border border-primary/20 rounded-xl space-y-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-primary/5 to-transparent pointer-events-none" />
              <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-primary" />
                APEXISWAP AMM PAIR
              </div>
              <div className="font-mono text-primary text-xs break-all selection:bg-primary/20">
                {launchedToken.pairAddress}
              </div>
              <a
                href={`${ARC_EXPLORER}/address/${launchedToken.pairAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-primary/75 hover:text-primary transition-colors hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Inspect on Arc Explorer
              </a>
            </div>
          )}
        </div>

        {/* Manual Liquidity Seeding (when isOneClick = false) */}
        {deployedContractAddress && launchedToken && !marketReady && !isOneClick && (
          <div className="mt-4 p-5 bg-card/45 border border-border/80 rounded-xl max-w-md w-full text-left space-y-4">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-extrabold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                MANUAL_LIQUIDITY_SEED_GATE
              </div>
              <p className="text-[11px] text-muted-foreground/80 mt-1">
                A pool must be initialized for this token to unlock order routes and transaction indexes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <label className="space-y-1">
                <span className="text-[10.5px] uppercase tracking-wider text-[#acc0b4] font-bold">
                  {launchedToken.ticker} AMOUNT
                </span>
                <Input
                  type="number"
                  min="0"
                  value={liquidityTokenAmount}
                  onChange={(event) => setLiquidityTokenAmount(event.target.value)}
                  className="font-mono text-xs bg-black/40 border-border focus:border-primary/80 focus-visible:ring-primary/20 placeholder:text-[#acc0b4]/35"
                  disabled={isCreatingLiquidity}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10.5px] uppercase tracking-wider text-[#acc0b4] font-bold">WUSDC AMOUNT</span>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={liquidityUsdcAmount}
                  onChange={(event) => setLiquidityUsdcAmount(event.target.value)}
                  className="font-mono text-xs bg-black/40 border-border focus:border-primary/80 focus-visible:ring-primary/20 placeholder:text-[#acc0b4]/35"
                  disabled={isCreatingLiquidity}
                />
              </label>
            </div>

            {liquidityStatus.status === "error" && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-[10px] text-destructive font-mono leading-relaxed">
                {liquidityStatus.message}
              </div>
            )}

            <Button
              type="button"
              className="w-full h-10 font-bold uppercase text-xs tracking-wider text-black bg-primary hover:bg-primary/95 transition-all shadow-[0_0_12px_rgba(34,197,94,0.15)] cursor-pointer"
              disabled={isCreatingLiquidity || !liquidityTokenAmount || !liquidityUsdcAmount}
              onClick={handleCreateLiquidity}
            >
              {isCreatingLiquidity ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {liquidityStepLabel.toUpperCase()}
                </span>
              ) : (
                "SEDUCE LIQUIDITY RESERVES"
              )}
            </Button>
          </div>
        )}

        {/* Action controls */}
        <div className="flex gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            className="h-10 text-xs uppercase tracking-wider px-6 font-mono border-border hover:border-primary/50"
            onClick={() => launchedToken && setLocation(`/token/${launchedToken.id}`)}
            disabled={!launchedToken}
          >
            Open Token Terminal
          </Button>
          
          {liquidityStatus.status === "error" && (
            <Button
              type="button"
              className="h-10 text-xs uppercase tracking-wider px-6 font-mono text-black"
              onClick={() => {
                resetLiquidity();
                resetDeploy();
                setSuccess(false);
              }}
            >
              Abort & Restart
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full p-4 py-8 space-y-8 font-mono">
      {/* Premium Cyber Terminal Header Panel */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-card/35 backdrop-blur-md p-6 shadow-[0_0_20px_rgba(34,197,94,0.05)]">
        {/* Decorative corner lines */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/45" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/45" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/45" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/45" />
        
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              <span className="text-[10px] text-primary uppercase font-bold tracking-widest animate-pulse">System Operational // Terminal Alpha v1.0.8</span>
            </div>
            <h1 className="text-3xl font-extrabold uppercase tracking-tight font-sans bg-gradient-to-r from-white via-primary to-primary bg-clip-text text-transparent">
              ARC MUTATOR // LAUNCHPAD
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl font-sans">
              Deploy custom cryptographic meme tokens on Arc Testnet. Auto-configure reserves, pair configurations, and deploy initial locked liquidity seeds.
            </p>
          </div>
          
          {/* Telemetry Stats Widgets */}
          <div className="flex flex-wrap items-center gap-4 bg-black/40 border border-border/60 p-3 rounded-lg text-[10px] uppercase font-bold tracking-wider">
            <div className="space-y-0.5 pr-3 border-r border-border/50">
              <div className="text-muted-foreground text-[8px]">Network Node</div>
              <div className="text-primary">ARC_TESTNET_v1</div>
            </div>
            <div className="space-y-0.5 pr-3 border-r border-border/50">
              <div className="text-muted-foreground text-[8px]">Protocol Fee</div>
              <div className="text-foreground">0.02 USDC</div>
            </div>
            <div className="space-y-0.5 pr-3 border-r border-border/50">
              <div className="text-muted-foreground text-[8px]">Router Path</div>
              <div className="text-accent">APEXISWAP_AMM</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-muted-foreground text-[8px]">Liquidity Lock</div>
              <div className="text-emerald-500">100% IMMUTABLE</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main split viewport layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left: Form */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border/40">
            <Cpu className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">MUTATION_FORM_INTEGRITY</h2>
          </div>

          {/* Wallet badge */}
          {connectedAddress ? (
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-primary/30 bg-primary/5 text-xs font-mono relative overflow-hidden shadow-inner">
              <div className="absolute top-0 right-0 w-16 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[#acc0b4] text-[12.5px] font-bold tracking-wider font-mono">CREATOR_ADDRESS:</span>
              </div>
              <span className="text-primary font-bold truncate max-w-[200px]">{connectedAddress}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-yellow-500/80 text-[12.5px] font-bold tracking-wider font-mono">NO_WALLET_BOUND:</span>
              </div>
              <span className="text-muted-foreground/80 italic">Auto-generates deterministic address</span>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

              {/* Logo Upload */}
              <div className="space-y-3.5">
                <label className="text-[12.5px] font-bold uppercase tracking-wider text-[#acc0b4] font-mono flex items-center gap-2 w-full">
                  <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse" />
                  <span>SYMBOL_LOGO_MATRIX</span>
                  <div className="h-[1px] bg-gradient-to-r from-border/50 to-transparent flex-1" />
                  <span className="text-[7px] text-primary/60 font-mono">MEDIA_STORE</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFile(file);
                  }}
                />
                
                {logoPreview ? (
                  <div className="relative w-32 h-32 mx-auto md:mx-0 group">
                    <div className="absolute inset-0 rounded-full border border-dashed border-primary/45 animate-[spin_20s_linear_infinite]" />
                    <div className="absolute inset-2 rounded-full bg-primary/5 border border-primary/30 animate-pulse" />
                    
                    <div className="absolute inset-3 rounded-full overflow-hidden border-2 border-primary shadow-[0_0_15px_rgba(34,197,94,0.35)] bg-black">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => { setLogoPreview(null); setLogoBase64(null); }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/80 border border-destructive hover:bg-destructive text-destructive hover:text-white flex items-center justify-center transition-all z-20 shadow-md"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/90 border border-primary/30 text-[9px] font-bold text-primary px-2 py-0.5 rounded uppercase tracking-widest whitespace-nowrap">
                      SECURE_LINK
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                    className={`relative flex flex-col items-center justify-center gap-3 h-32 rounded-xl border-2 border-dashed cursor-pointer overflow-hidden transition-all group ${
                      isDragging 
                        ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(34,197,94,0.1)]" 
                        : "border-border/60 bg-card/20 hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[bounce_2.5s_infinite_alternate] pointer-events-none" />
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.02)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none" />
                    
                    <div className="p-2 rounded-lg bg-black/40 border border-border/40 group-hover:border-primary/45 transition-colors">
                      <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors animate-pulse" />
                    </div>
                    
                    <div className="text-center z-10 px-4 font-mono">
                      <div className="text-xs font-bold uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">
                        LOAD SYMBOL LOGO MATRIX
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        DRAG & DROP IMAGE FILE OR CLICK TO SCAN
                      </div>
                    </div>
                    
                    <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 border-t border-l border-muted-foreground/35 group-hover:border-primary/50" />
                    <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-muted-foreground/35 group-hover:border-primary/50" />
                    <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 border-b border-l border-muted-foreground/35 group-hover:border-primary/50" />
                    <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 border-b border-r border-muted-foreground/35 group-hover:border-primary/50" />
                  </div>
                )}
              </div>

              {/* Name + Ticker */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="uppercase text-[12.5px] font-bold tracking-wider text-[#acc0b4] font-mono flex items-center gap-2 w-full">
                        <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse" />
                        <span>TOKEN_NAME</span>
                        <div className="h-[1px] bg-gradient-to-r from-border/50 to-transparent flex-1" />
                        <span className="text-[7px] text-primary/60 font-mono">REQ_FIELD</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. Arc Mutator" 
                          className="font-mono text-sm bg-black/50 border-border/45 hover:border-primary/30 hover:shadow-[0_0_8px_rgba(0,255,136,0.08)] focus:border-primary/80 focus-visible:ring-primary/20 h-11 py-3 px-4 transition-all rounded-md placeholder:text-[#acc0b4]/35 text-foreground" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] text-destructive/90 font-mono" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ticker"
                  render={({ field }) => (                    <FormItem className="space-y-3">
                      <FormLabel className="uppercase text-[12.5px] font-bold tracking-wider text-[#acc0b4] font-mono flex items-center gap-2 w-full">
                        <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse" />
                        <span>TICKER_SYMBOL</span>
                        <div className="h-[1px] bg-gradient-to-r from-border/50 to-transparent flex-1" />
                        <span className="text-[7px] text-primary/60 font-mono">REQ_FIELD</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. ARCM"
                          className="font-mono uppercase text-sm bg-black/50 border-border/45 hover:border-primary/30 hover:shadow-[0_0_8px_rgba(0,255,136,0.08)] focus:border-primary/80 focus-visible:ring-primary/20 h-11 py-3 px-4 transition-all rounded-md placeholder:text-[#acc0b4]/35 text-foreground"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] text-destructive/90 font-mono" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (                  <FormItem className="space-y-3">
                    <FormLabel className="uppercase text-[12.5px] font-bold tracking-wider text-[#acc0b4] font-mono flex items-center gap-2 w-full">
                      <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse" />
                      <span>INDEX_DESCRIPTION</span>
                      <div className="h-[1px] bg-gradient-to-r from-border/50 to-transparent flex-1" />
                      <span className="text-[7px] text-primary/60 font-mono">REQ_FIELD</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Input token roadmap, utility algorithms, or degen parameters..."
                        className="resize-none h-28 py-3 px-4 font-mono text-sm bg-black/50 border-border/45 hover:border-primary/30 hover:shadow-[0_0_8px_rgba(0,255,136,0.08)] focus:border-primary/80 focus-visible:ring-primary/20 transition-all rounded-md placeholder:text-[#acc0b4]/35 text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-[10px] text-destructive/90 font-mono" />
                  </FormItem>
                )}
              />

              {/* Total Supply */}
              <FormField
                control={form.control}
                name="totalSupply"
                render={({ field }) => (
                  <FormItem className="space-y-3.5">
                    <FormLabel className="uppercase text-[12.5px] font-bold tracking-wider text-[#acc0b4] font-mono flex items-center gap-2 w-full">
                      <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse" />
                      <span>TOTAL_SUPPLY_LIMIT</span>
                      <div className="h-[1px] bg-gradient-to-r from-border/50 to-transparent flex-1" />
                      <span className="text-[7px] text-primary/60 font-mono">SYS_PARAM</span>
                    </FormLabel>
                    
                    <div className="grid grid-cols-4 gap-2.5">
                      {SUPPLY_PRESETS.map((p) => {
                        const isActive = field.value === p.value;
                        return (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => field.onChange(p.value)}
                            className={`relative py-2 text-xs font-mono font-bold rounded-lg border overflow-hidden transition-all duration-300 ${
                              isActive
                                ? "border-primary bg-primary/10 text-primary shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                                : "border-border/60 bg-black/20 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {isActive && (
                              <>
                                <span className="absolute top-1 left-1.5 text-[8px] leading-none opacity-80">[</span>
                                <span className="absolute top-1 right-1.5 text-[8px] leading-none opacity-80">]</span>
                              </>
                            )}
                            <span className={isActive ? "text-primary tracking-wide scale-105 duration-200" : ""}>
                              {p.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="0.00"
                          className="font-mono text-sm bg-black/50 border-border/45 hover:border-primary/30 hover:shadow-[0_0_8px_rgba(0,255,136,0.08)] focus:border-primary/80 focus-visible:ring-primary/20 h-11 py-3 px-4 transition-all rounded-md placeholder:text-[#acc0b4]/35 text-foreground animate-none"
                          {...field}
                        />
                        <div className="absolute right-3 top-3 text-[9px] font-bold text-muted-foreground tracking-widest pointer-events-none">
                          UNITS
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage className="text-[10px] text-destructive/90 font-mono" />
                  </FormItem>
                )}
              />

              {/* Brand Color (fallback for tokens without logo) */}
              <FormField
                control={form.control}
                name="logoColor"
                render={({ field }) => (
                  <FormItem className="space-y-3.5">
                    <FormLabel className="uppercase text-[14px] font-bold tracking-wider text-[#acc0b4] font-mono flex items-center gap-2 w-full">
                      <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse" />
                      <span>BRAND_HEX_COLOR_PALETTE</span>
                      <div className="h-[1px] bg-gradient-to-r from-border/50 to-transparent flex-1" />
                      <span className="text-[7px] text-primary/60 font-mono">FALLBACK_PALETTE</span>
                    </FormLabel>
                    <FormControl>
                      <div className="flex gap-4 items-center bg-black/20 p-3 rounded-lg border border-border/40">
                        <div className="relative w-12 h-10 rounded overflow-hidden border border-border/80 hover:border-primary/50 cursor-pointer">
                          <Input 
                            type="color" 
                            className="absolute inset-0 w-full h-full p-0 cursor-pointer border-none scale-125 bg-transparent" 
                            {...field} 
                          />
                        </div>
                        
                        <div className="flex gap-2 flex-wrap">
                          {["#22c55e","#a855f7","#ec4899","#eab308","#3b82f6","#ef4444","#06b6d4","#f97316"].map(c => {
                            const isSelected = field.value === c;
                            return (
                              <button
                                key={c}
                                type="button"
                                className={`w-7 h-7 rounded-full border-2 relative transition-all duration-300 ${
                                  isSelected 
                                    ? "border-primary scale-110 shadow-[0_0_10px_var(--color-primary)]" 
                                    : "border-black/50 hover:scale-105"
                                }`}
                                style={{ backgroundColor: c }}
                                onClick={() => field.onChange(c)}
                              >
                                {isSelected && (
                                  <span className="absolute inset-1.5 bg-black rounded-full border border-primary/50" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Socials */}
              <div className="space-y-5 pt-4 border-t border-border/40">
                <h3 className="text-[14px] font-bold uppercase tracking-wider text-[#acc0b4] font-mono flex items-center gap-2 w-full">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-pulse" />
                  <span>METADATA_SOCIAL_RELAYS</span>
                  <div className="h-[1px] bg-gradient-to-r from-border/50 to-transparent flex-1" />
                  <span className="text-[7px] text-primary/60 font-mono">INDEX_NET</span>
                </h3>
                
                <div className="space-y-3.5">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative flex items-center">
                            <div className="absolute left-3 pl-0.5 border-r border-border/40 pr-2.5">
                              <Globe className="h-3.5 w-3.5 text-muted-foreground/70" />
                            </div>
                            <Input 
                              placeholder="https://your-token-site.ai" 
                              className="bg-black/50 border-border/45 hover:border-primary/30 hover:shadow-[0_0_8px_rgba(0,255,136,0.08)] focus:border-primary/80 focus-visible:ring-primary/20 h-11 py-3 pl-12 pr-4 font-mono text-sm rounded-md placeholder:text-[#acc0b4]/35 text-foreground" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-[10px] text-destructive/90 font-mono" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="twitter"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative flex items-center">
                            <div className="absolute left-3 pl-0.5 border-r border-border/40 pr-2.5">
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current text-muted-foreground/70"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                            </div>
                            <Input 
                              placeholder="X/Twitter handle" 
                              className="bg-black/50 border-border/45 hover:border-primary/30 hover:shadow-[0_0_8px_rgba(0,255,136,0.08)] focus:border-primary/80 focus-visible:ring-primary/20 h-11 py-3 pl-12 pr-4 font-mono text-sm rounded-md placeholder:text-[#acc0b4]/35 text-foreground" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-[10px] text-destructive/90 font-mono" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="telegram"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative flex items-center">
                            <div className="absolute left-3 pl-0.5 border-r border-border/40 pr-2.5">
                              <Send className="h-3.5 w-3.5 text-muted-foreground/70" />
                            </div>
                            <Input 
                              placeholder="https://t.me/your-group" 
                              className="bg-black/50 border-border/45 hover:border-primary/30 hover:shadow-[0_0_8px_rgba(0,255,136,0.08)] focus:border-primary/80 focus-visible:ring-primary/20 h-11 py-3 pl-12 pr-4 font-mono text-sm rounded-md placeholder:text-[#acc0b4]/35 text-foreground" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-[10px] text-destructive/90 font-mono" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Inline progress status board inside the form (before success redirect) */}
              {(isLaunching || isCreatingLiquidity) && (
                <div className="rounded-xl border border-primary/25 bg-black/60 p-4 space-y-3 font-mono shadow-inner">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-primary/10 text-[9px] font-bold text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                    MUTATOR STATE ENGINE LOGGING:
                  </div>
                  
                  {[
                    { key: "switching-network", label: "SWITCHING PROTOCOL NETWORK" },
                    { key: "confirming", label: "SOLICITING METAMASK HANDSHAKE" },
                    { key: "deploying", label: "MINING ERC20 BYTECODE CONTRACT" },
                    { key: "saving", label: "REGISTERING REGISTRY METADATA" },
                    ...(isOneClick ? [
                      { key: "detecting-pair", label: "GENERATING APEXISWAP LP PAIR" },
                      { key: "wrapping-usdc", label: "WRAPPING USDC LIQUIDITY DEPOSIT" },
                      { key: "approving", label: "AUTHORIZING SPEND ALLOWANCES" },
                      { key: "adding-liquidity", label: "SEEDING INITIAL SWAP RESERVES" },
                      { key: "saving-market", label: "ACTIVATING INDEXER CHANNELS" },
                    ] : [])
                  ].map((step) => {
                    let activeStatus = "idle";
                    const isRetrying = deployStatus.status === "retrying";
                    
                    if (deployStatus.status !== "idle" && deployStatus.status !== "success" && deployStatus.status !== "error") {
                      activeStatus = isRetrying ? "deploying" : deployStatus.status;
                    } else if (launchToken.isPending) {
                      activeStatus = "saving";
                    } else if (liquidityStatus.status !== "idle" && liquidityStatus.status !== "success" && liquidityStatus.status !== "error") {
                      activeStatus = liquidityStatus.status;
                    } else if (liquidityStatus.status === "success") {
                      activeStatus = "saving-market";
                    }

                    const stepsOrder = [
                      "switching-network", "confirming", "deploying", "saving",
                      "detecting-pair", "wrapping-usdc", "approving", "adding-liquidity", "saving-market"
                    ];
                    const currentOrder = stepsOrder.indexOf(activeStatus);
                    const stepOrder = stepsOrder.indexOf(step.key);
                    const isDone = stepOrder < currentOrder;
                    const isCurrent = stepOrder === currentOrder;
                    const isRetryingThisStep = isRetrying && isCurrent;

                    return (
                      <div key={step.key} className={`flex items-center gap-3 text-[10px] transition-all duration-300 ${isDone || isCurrent ? "opacity-100" : "opacity-25"}`}>
                        {isDone ? (
                          <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        ) : isCurrent ? (
                          <Loader2 className={`w-3.5 h-3.5 flex-shrink-0 animate-spin ${isRetryingThisStep ? "text-yellow-400" : "text-primary"}`} />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-border/80 flex-shrink-0" />
                        )}
                        <span className={isCurrent ? "text-foreground font-bold" : isDone ? "text-muted-foreground line-through" : "text-muted-foreground"}>
                          {step.label}
                          {isRetryingThisStep && (
                            <span className="ml-2 text-yellow-400 text-[8px] font-bold">
                              RETRY { (deployStatus as { attempt: number }).attempt }/{ (deployStatus as { maxAttempts: number }).maxAttempts }
                            </span>
                          )}
                        </span>
                        
                        {step.key === "deploying" && (deployStatus.status === "deploying" || (isRetrying && isCurrent)) && (
                          (() => {
                            const txHash = deployStatus.status === "deploying"
                              ? (deployStatus as { txHash: string }).txHash
                              : null;
                            return txHash ? (
                              <a
                                href={`${ARC_EXPLORER}/tx/${txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary/60 hover:text-primary ml-auto flex items-center gap-1 text-[8px] border border-primary/20 px-1 rounded hover:bg-primary/5 transition-colors"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                VIEW_TX
                              </a>
                            ) : null;
                          })()
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Deploy error alert box */}
              {deployStatus.status === "error" && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3 font-mono shadow-[0_0_12px_rgba(239,68,68,0.05)]">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="text-destructive w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive leading-relaxed font-semibold">
                      {deployStatus.message}
                    </p>
                  </div>
                  {deployStatus.isRpcError && (
                    <div className="text-[10px] text-muted-foreground bg-black/40 border border-border/40 rounded-lg p-3 space-y-1.5">
                      <div className="font-extrabold text-foreground/80">RPC SYNCHRONIZATION FAULT RESOLUTION:</div>
                      <div>1. Open MetaMask &rarr; Settings &rarr; Networks &rarr; Arc Testnet</div>
                      <div>2. Verify and replace the RPC URL endpoint with a live provider</div>
                      <div>3. Or expand retry loops inside the deployment hook</div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => resetDeploy()}
                    className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest underline decoration-dotted"
                  >
                    // Reset Sequencer and Re-try
                  </button>
                </div>
              )}

              {/* Warning if no wallet for deploy */}
              {!hasMetaMask && (
                <div className="text-[10px] text-muted-foreground bg-black/45 border border-border/60 rounded-lg px-3 py-2.5 font-mono leading-relaxed">
                  MetaMask client not detected. The mutator node will register the metadata in local caching registries without real-time contract minting.
                </div>
              )}
              {hasMetaMask && walletState.status !== "connected" && (
                <div className="text-[10px] text-yellow-500/80 bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2.5 font-mono leading-relaxed">
                  MetaMask client is inactive. Establish connection using the navigation widget above to seed real-time ERC20 contract hashes.
                </div>
              )}

              {/* 1-Click LP Seeding Toggle */}
              {hasMetaMask && walletState.status === "connected" && (
                <div className="relative overflow-hidden rounded-xl border border-primary/35 bg-primary/5 p-4 shadow-[0_0_15px_rgba(34,197,94,0.04)] transition-all duration-300">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent pointer-events-none" />
                  
                  <div className="flex items-center justify-between z-10 relative">
                    <div className="space-y-0.5">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        1-CLICK LP BOOTSTRAPPER
                      </div>
                      <div className="text-[10px] text-muted-foreground font-sans">
                        Automatically registers and seeds ApexiSwap TOKEN/WUSDC liquidity pool.
                      </div>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isOneClick}
                        onChange={(e) => setIsOneClick(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-black/60 rounded-full border border-border/80 peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-muted-foreground peer-checked:after:bg-primary after:border-border after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-primary/20 peer-checked:border-primary/50" />
                    </label>
                  </div>
                  
                  {isOneClick && (
                    <div className="grid grid-cols-2 gap-4 pt-3.5 mt-3 border-t border-primary/20 z-10 relative">
                      <label className="space-y-1.5">
                        <span className="text-[10.5px] uppercase tracking-wider text-[#acc0b4] font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse" />
                          WUSDC_SEED_FUND
                        </span>
                        <div className="relative">
                          <Input
                            type="number"
                            min="1"
                            max="1000"
                            value={oneClickWusdcAmount}
                            onChange={(e) => setOneClickWusdcAmount(e.target.value)}
                            className="h-9 font-mono bg-black/60 border-primary/30 text-xs focus:border-primary text-primary pl-3 pr-12 rounded-md"
                            disabled={isLaunching || isCreatingLiquidity}
                          />
                          <span className="absolute right-3 top-2.5 text-[8px] font-bold text-primary/70 tracking-widest pointer-events-none">
                            WUSDC
                          </span>
                        </div>
                      </label>
                      <div className="flex flex-col justify-center text-[9px] text-muted-foreground/80 leading-relaxed font-sans pl-1">
                        <div className="flex items-center gap-1.5 text-foreground/90 font-bold">
                          <Check className="w-2.5 h-2.5 text-primary flex-shrink-0" />
                          Seeds 10% of total supply
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Check className="w-2.5 h-2.5 text-primary flex-shrink-0" />
                          Configures locked AMM LP pair
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Check className="w-2.5 h-2.5 text-primary flex-shrink-0" />
                          100% automated metadata index
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="relative w-full h-12 text-sm font-bold uppercase tracking-widest text-black bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_22px_rgba(34,197,94,0.45)] transition-all overflow-hidden cursor-pointer group rounded-md"
                disabled={isLaunching || isCreatingLiquidity}
              >
                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-25deg] translate-x-[-150%] group-hover:translate-x-[250%] transition-transform duration-1000 ease-out" />
                
                {isLaunching || isCreatingLiquidity ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {deployStatus.status === "switching-network" && "SWITCHING PROTOCOL NETWORK..."}
                    {deployStatus.status === "confirming" && "SIGNING METAMASK TRANSACTION..."}
                    {deployStatus.status === "deploying" && "MINING SMART CONTRACT BLOCK..."}
                    {deployStatus.status === "retrying" && `RETRYING ${(deployStatus as { step: string }).step.toUpperCase()}...`}
                    {isCreatingLiquidity && "SEEDING AMM SWAP LIQUIDITY..."}
                    {(deployStatus.status === "idle" || deployStatus.status === "success") && !isCreatingLiquidity && launchToken.isPending && "INDEXING TOKEN METADATA..."}
                  </span>
                ) : hasMetaMask && walletState.status === "connected" ? (
                  isOneClick ? (
                    <span className="flex items-center justify-center gap-2">
                      <Send className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      TRANSMIT 1-CLICK DEPLOY & SEED AMM
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Cpu className="w-4 h-4 animate-pulse" />
                      DEPLOY ERC20 CONTRACT
                    </span>
                  )
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Terminal className="w-4 h-4" />
                    SAVE METADATA RESERVES
                  </span>
                )}
              </Button>
            </form>
          </Form>
        </div>

        {/* Right: Live Holographic Preview */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-8">
          <div className="flex items-center justify-between">
            <h3 className="text-[11.5px] font-bold uppercase tracking-widest text-[#acc0b4] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse" />
              LIVE_TOKEN_TELEMETRY_RADAR
            </h3>
            <span className="text-[8px] font-mono text-primary/70 bg-primary/5 px-2 py-0.5 border border-primary/20 rounded uppercase tracking-wider">
              Holographic HUD Ready
            </span>
          </div>
          
          <div className="relative overflow-hidden p-6 bg-card/35 border border-border/80 rounded-xl shadow-2xl backdrop-blur-md space-y-6">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.015)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.45))] pointer-events-none" />
            
            <div className="absolute top-2 left-2 text-[7px] font-mono text-muted-foreground/35 select-none font-light">SYS_COORD_A // [42.8]</div>
            <div className="absolute top-2 right-2 text-[7px] font-mono text-muted-foreground/35 select-none font-light">INDEX_DEPTH // [99.2]</div>
            <div className="absolute bottom-2 left-2 text-[7px] font-mono text-muted-foreground/35 select-none font-light">NODE_REF // [0x8f]</div>
            <div className="absolute bottom-2 right-2 text-[7px] font-mono text-muted-foreground/35 select-none font-light">GRID_SYS // [ACTIVE]</div>

            {/* Token header */}
            <div className="flex items-start gap-4 relative z-10">
              {logoPreview ? (
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-primary/50 shadow-lg flex-shrink-0 bg-black">
                  <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl text-white shadow-inner transition-all duration-500 flex-shrink-0 border-2 border-white/10"
                  style={{ 
                    backgroundColor: watchAll.logoColor || "#8b5cf6",
                    textShadow: "0 0 8px rgba(255,255,255,0.4)"
                  }}
                >
                  {(watchAll.ticker || "?").slice(0, 3).toUpperCase()}
                </div>
              )}
              
              <div className="flex-1 min-w-0 space-y-0.5 text-left">
                <div className="font-extrabold uppercase text-xl tracking-tight truncate text-foreground flex items-center gap-1.5">
                  <span className="text-primary">$</span>
                  {watchAll.ticker || "TICKER"}
                </div>
                <div className="text-muted-foreground text-xs truncate font-sans">
                  {watchAll.name || "Token Name Identifier"}
                </div>
                <div className="flex items-center gap-1.5 text-[8px] font-mono text-primary/70 mt-1 truncate bg-primary/5 border border-primary/10 rounded px-1.5 py-0.5 w-max">
                  <span className="w-1 h-1 bg-primary rounded-full animate-ping" />
                  ADDR: {connectedAddress ? `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}` : "DETERMINISTIC_CREATOR_KEY"}
                </div>
              </div>
              
              {/* Real-time Math Pricing Telemetry */}
              {(() => {
                const usdcSeed = Number(isOneClick ? oneClickWusdcAmount : "50") || 50;
                const supplyVal = Number(watchAll.totalSupply) || 1_000_000_000;
                const seedTokens = supplyVal * 0.1;
                const initialPrice = usdcSeed / seedTokens;
                
                const formatPriceDecimals = (price: number) => {
                  if (price === 0) return "$0.00";
                  if (price >= 0.01) return `$${price.toFixed(4)}`;
                  
                  const str = price.toFixed(12);
                  const match = str.match(/\$?(0\.0+)/);
                  if (match) {
                    const zeroCount = match[1].length - 2;
                    const remaining = str.slice(match[1].length + 2, match[1].length + 6);
                    return (
                      <span className="inline-flex items-center font-mono">
                        $0.0
                        <sub className="text-[9px] font-bold text-primary mx-0.5 -bottom-0.5">{zeroCount}</sub>
                        {remaining}
                      </span>
                    );
                  }
                  return `$${price.toFixed(8)}`;
                };
                
                return (
                  <div className="text-right flex-shrink-0 space-y-0.5">
                    <div className="font-mono font-bold text-sm text-primary">
                      {formatPriceDecimals(initialPrice)}
                    </div>
                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest font-bold">EST_SEED_PRICE</div>
                  </div>
                );
              })()}
            </div>

            {/* Description Terminal Box */}
            <div className="relative p-3.5 bg-black/40 border border-border/60 rounded-lg min-h-[75px] text-left text-xs leading-relaxed text-muted-foreground break-words font-mono">
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.15)_50%,rgba(255,255,255,0.03)_50%)] bg-[size:100%_4px] pointer-events-none" />
              <div className="absolute top-1 right-2 text-[7px] text-primary/40 tracking-wider">SECURE_LOG</div>
              
              <p className="font-sans text-xs">
                {watchAll.description || "Synthesizing custom token description... Provide a detailed roadmap outline to satisfy system diagnostic validation."}
              </p>
            </div>

            {/* Stats Telemetry Matrix */}
            <div className="grid grid-cols-3 gap-3 text-center border-t border-border/40 pt-4 relative z-10">
              <div className="space-y-0.5">
                <div className="text-[8px] text-muted-foreground uppercase tracking-widest font-bold">SUPPLY_METRIC</div>
                <div className="font-mono text-xs font-bold text-foreground">
                  {watchAll.totalSupply
                    ? Number(watchAll.totalSupply).toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 })
                    : "1.0B"}
                </div>
              </div>
              
              {(() => {
                const usdcSeed = Number(isOneClick ? oneClickWusdcAmount : "50") || 50;
                const initialMcap = usdcSeed * 10;
                return (
                  <div className="space-y-0.5">
                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest font-bold">EST_INIT_MCAP</div>
                    <div className="font-mono text-xs font-bold text-primary">
                      ${initialMcap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                );
              })()}
              
              <div className="space-y-0.5">
                <div className="text-[8px] text-muted-foreground uppercase tracking-widest font-bold">CHAIN_NODE</div>
                <div className="font-mono text-xs font-bold text-foreground">ARC_CHAIN</div>
              </div>
            </div>

            {/* Live System Diagnostics / Ratios */}
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1.5 text-[10.5px] font-mono text-left">
              <div className="flex justify-between items-center text-[#acc0b4]">
                <span>ESTIMATED RESERVES RATIO</span>
                <span className="text-foreground font-bold">10.00% (SEED LOCK)</span>
              </div>
              <div className="flex justify-between items-center text-[#acc0b4]">
                <span>AMM ROUTER FACTOR</span>
                <span className="text-foreground font-bold">ApexiSwap V1</span>
              </div>
              <div className="flex justify-between items-center text-[#acc0b4]">
                <span>SLIPPAGE SAFE INDEX</span>
                <span className="text-emerald-500 font-bold flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                  OPTIMAL
                </span>
              </div>
            </div>

            {/* Socials Relayer Ribbon */}
            {(watchAll.website || watchAll.twitter || watchAll.telegram) ? (
              <div className="flex gap-2 flex-wrap border-t border-border/40 pt-4 relative z-10">
                {watchAll.website && (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary">
                    NET: ONLINE
                  </span>
                )}
                {watchAll.twitter && (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary truncate max-w-[140px]">
                    X: @{watchAll.twitter}
                  </span>
                )}
                {watchAll.telegram && (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary">
                    TG: LINKED
                  </span>
                )}
              </div>
            ) : (
              <div className="text-[8px] font-mono text-muted-foreground/60 text-center pt-2 italic">
                -- NO SOCIAL LINKS INDEXED IN METADATA RELAY --
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

