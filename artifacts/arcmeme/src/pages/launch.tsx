import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLaunchToken,
  getListTokensQueryKey,
  getGetTrendingTokensQueryKey,
  getGetPlatformStatsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/use-wallet";
import { useDeployToken, ARC_EXPLORER } from "@/hooks/use-deploy-token";
import { motion } from "framer-motion";
import { Upload, X, ImageIcon, CheckCircle, Loader2, ExternalLink } from "lucide-react";

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
  const [success, setSuccess] = useState(false);
  const [deployedContractAddress, setDeployedContractAddress] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        onSuccess: (token) => {
          queryClient.invalidateQueries({ queryKey: getListTokensQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTrendingTokensQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPlatformStatsQueryKey() });
          setSuccess(true);
          toast({
            title: "Token Launched!",
            description: contractAddress
              ? "ERC20 deployed and live on Arc Network Testnet."
              : "Token saved. Connect MetaMask to deploy on-chain next time.",
          });
          setTimeout(() => setLocation(`/token/${token.id}`), 2500);
        },
        onError: () => {
          resetDeploy();
          toast({
            variant: "destructive",
            title: "Save Failed",
            description: "Contract deployed but failed to save metadata. Try again.",
          });
        },
      }
    );
  };

  const isLaunching =
    deployStatus.status === "switching-network" ||
    deployStatus.status === "confirming" ||
    deployStatus.status === "deploying" ||
    launchToken.isPending;

  if (success) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-6xl mb-6"
        >
          🚀
        </motion.div>
        <h1 className="text-4xl font-bold uppercase tracking-tight text-primary mb-2">It's Live.</h1>
        {deployedContractAddress ? (
          <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-xl max-w-md w-full text-left space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">ERC20 Contract Deployed</div>
            <div className="font-mono text-primary text-sm break-all">{deployedContractAddress}</div>
            <a
              href={`${ARC_EXPLORER}/address/${deployedContractAddress}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View on Arc Explorer
            </a>
          </div>
        ) : (
          <p className="text-muted-foreground font-mono text-sm">Token saved without on-chain deployment.</p>
        )}
        <p className="text-muted-foreground font-mono mt-4 text-xs">Redirecting to token page...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full p-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-12">

      {/* Left: Form */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter">Deploy a Token</h1>
          <p className="text-muted-foreground">0.02 USDC to deploy. Liquidity locked automatically.</p>
        </div>

        {/* Wallet badge */}
        {connectedAddress ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-primary/30 bg-primary/5 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-muted-foreground">Creator:</span>
            <span className="text-primary truncate">{connectedAddress}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border/50 bg-secondary/20 text-xs font-mono text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
            No wallet connected — creator address will be auto-generated
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* Logo Upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider">Token Logo</label>
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
                <div className="relative w-24 h-24">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-24 h-24 rounded-full object-cover border-2 border-primary/50 shadow-lg"
                  />
                  <button
                    type="button"
                    onClick={() => { setLogoPreview(null); setLogoBase64(null); }}
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive flex items-center justify-center hover:bg-destructive/80 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={`flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed cursor-pointer transition-all ${isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-secondary/30"}`}
                >
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center">
                    <div className="text-sm font-medium">Drop image or click to upload</div>
                    <div className="text-xs text-muted-foreground">PNG, JPG, GIF — max 10MB</div>
                  </div>
                  <Upload className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Name + Ticker */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-wider">Token Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Moon Dog" className="font-mono bg-card/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ticker"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-wider">Ticker</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="MDOG"
                        className="font-mono uppercase bg-card/50"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-wider">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What is this token about? Tell the degens."
                      className="resize-none h-24 bg-card/50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Total Supply */}
            <FormField
              control={form.control}
              name="totalSupply"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-wider">Total Supply</FormLabel>
                  <div className="flex gap-2 mb-2">
                    {SUPPLY_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => field.onChange(p.value)}
                        className={`flex-1 py-1.5 text-xs font-mono font-bold rounded border transition-all ${
                          field.value === p.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      className="font-mono bg-card/50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Brand Color (fallback for tokens without logo) */}
            <FormField
              control={form.control}
              name="logoColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-wider">Brand Color <span className="text-muted-foreground normal-case font-normal">(used if no logo)</span></FormLabel>
                  <FormControl>
                    <div className="flex gap-3 items-center">
                      <Input type="color" className="w-12 h-10 p-1 cursor-pointer bg-card/50" {...field} />
                      <div className="flex gap-2 flex-wrap">
                        {["#22c55e","#a855f7","#ec4899","#eab308","#3b82f6","#ef4444","#06b6d4","#f97316"].map(c => (
                          <button
                            key={c}
                            type="button"
                            className={`w-7 h-7 rounded-full border-2 transition-all ${field.value === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                            style={{ backgroundColor: c }}
                            onClick={() => field.onChange(c)}
                          />
                        ))}
                      </div>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Socials */}
            <div className="space-y-3 pt-4 border-t border-border/50">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Socials (Optional)</h3>
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">🌐</span>
                        <Input placeholder="https://yourtoken.fun" className="bg-card/50 font-mono text-sm pl-8" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="twitter"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">𝕏</span>
                        <Input placeholder="Handle without @" className="bg-card/50 font-mono text-sm pl-8" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telegram"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">✈</span>
                        <Input placeholder="https://t.me/yourgroup" className="bg-card/50 font-mono text-sm pl-8" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Deploy step progress (shown during launch) */}
            {isLaunching && (
              <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
                {[
                  { key: "switching-network", label: "Switching to Arc Testnet" },
                  { key: "confirming", label: "Confirm in MetaMask" },
                  { key: "deploying", label: "Mining transaction" },
                  { key: "saving", label: "Saving token metadata" },
                ].map((step) => {
                  const statusOrder = ["switching-network", "confirming", "deploying", "saving"];
                  const currentOrder = launchToken.isPending
                    ? statusOrder.indexOf("saving")
                    : statusOrder.indexOf(deployStatus.status);
                  const stepOrder = statusOrder.indexOf(step.key);
                  const isDone = stepOrder < currentOrder;
                  const isCurrent = stepOrder === currentOrder;
                  return (
                    <div key={step.key} className={`flex items-center gap-3 text-sm font-mono transition-opacity ${isDone || isCurrent ? "opacity-100" : "opacity-30"}`}>
                      {isDone ? (
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-border flex-shrink-0" />
                      )}
                      <span className={isCurrent ? "text-foreground" : isDone ? "text-muted-foreground line-through" : "text-muted-foreground"}>
                        {step.label}
                      </span>
                      {step.key === "deploying" && deployStatus.status === "deploying" && (
                        <a
                          href={`${ARC_EXPLORER}/tx/${(deployStatus as { txHash: string }).txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary/60 hover:text-primary ml-auto flex items-center gap-1 text-[10px]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          tx
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Deploy error */}
            {deployStatus.status === "error" && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive font-mono">
                {deployStatus.message}
              </div>
            )}

            {/* Warning if no wallet for deploy */}
            {!hasMetaMask && (
              <div className="text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 py-2 font-mono">
                MetaMask not detected — token will be saved without on-chain deployment.
              </div>
            )}
            {hasMetaMask && walletState.status !== "connected" && (
              <div className="text-xs text-yellow-500/80 bg-yellow-500/5 border border-yellow-500/20 rounded-md px-3 py-2 font-mono">
                Connect MetaMask above to deploy a real ERC20 contract on Arc Testnet.
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-lg font-bold uppercase tracking-widest text-black"
              disabled={isLaunching}
            >
              {isLaunching ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {deployStatus.status === "switching-network" && "Switching Network..."}
                  {deployStatus.status === "confirming" && "Waiting for MetaMask..."}
                  {deployStatus.status === "deploying" && "Mining..."}
                  {(deployStatus.status === "idle" || deployStatus.status === "success") && launchToken.isPending && "Saving..."}
                </span>
              ) : hasMetaMask && walletState.status === "connected" ? "🚀 Deploy ERC20 + Launch" : "💾 Save Token"}
            </Button>
          </form>
        </Form>
      </div>

      {/* Right: Live Preview */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Live Preview</h3>
        <div className="p-6 bg-card border border-border rounded-xl shadow-2xl sticky top-24 space-y-6">

          {/* Token header */}
          <div className="flex items-start gap-4">
            {logoPreview ? (
              <img src={logoPreview} alt="logo" className="w-16 h-16 rounded-full object-cover shadow-lg flex-shrink-0" />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl text-white shadow-inner transition-colors duration-300 flex-shrink-0"
                style={{ backgroundColor: watchAll.logoColor || "#8b5cf6" }}
              >
                {(watchAll.ticker || "?").slice(0, 3)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold uppercase text-2xl tracking-tight truncate">
                ${watchAll.ticker || "TICKER"}
              </div>
              <div className="text-muted-foreground text-sm truncate">
                {watchAll.name || "Token Name"}
              </div>
              {connectedAddress && (
                <div className="text-[10px] font-mono text-primary/70 truncate mt-1">{connectedAddress}</div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-mono font-bold text-lg text-primary">$0.000001</div>
              <div className="font-mono text-xs text-muted-foreground">Launch price</div>
            </div>
          </div>

          {/* Description */}
          <div className="text-sm leading-relaxed text-muted-foreground min-h-[60px] break-words border-t border-border/50 pt-4">
            {watchAll.description || "Token description will appear here..."}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 text-center border-t border-border/30 pt-4">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Supply</div>
              <div className="font-mono text-xs font-bold">
                {watchAll.totalSupply
                  ? Number(watchAll.totalSupply).toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 })
                  : "1B"}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Market Cap</div>
              <div className="font-mono text-xs font-bold text-primary">$1,000</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Network</div>
              <div className="font-mono text-xs font-bold">Arc</div>
            </div>
          </div>

          {/* Socials */}
          {(watchAll.website || watchAll.twitter || watchAll.telegram) && (
            <div className="flex gap-2 flex-wrap border-t border-border/30 pt-4">
              {watchAll.website && (
                <span className="text-xs font-mono px-2 py-1 rounded bg-secondary text-muted-foreground">🌐 Website</span>
              )}
              {watchAll.twitter && (
                <span className="text-xs font-mono px-2 py-1 rounded bg-secondary text-muted-foreground">𝕏 @{watchAll.twitter}</span>
              )}
              {watchAll.telegram && (
                <span className="text-xs font-mono px-2 py-1 rounded bg-secondary text-muted-foreground">✈ Telegram</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
