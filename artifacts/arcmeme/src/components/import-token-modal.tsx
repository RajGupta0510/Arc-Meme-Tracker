import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";

type ImportTokenModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportTokenModal({ open, onOpenChange }: ImportTokenModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleImport = async () => {
    setError("");
    const cleanAddress = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
      setError("Please paste a valid 42-character EVM contract address.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/tokens/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractAddress: cleanAddress }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Failed to import token.");
      }

      const token = await response.json();
      
      toast({
        title: `TOKEN IMPORTED: $${token.ticker}`,
        description: `${token.name} has been added to the registry successfully.`,
      });

      onOpenChange(false);
      setAddress("");
      // Navigate to the newly imported token details page
      setLocation(`/token/${token.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Verify the address.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/80 bg-card/95 backdrop-blur-xl max-w-md p-6 sm:rounded-lg">
        <DialogHeader className="space-y-2">
          <DialogTitle className="font-mono text-sm uppercase tracking-widest text-primary flex items-center gap-2">
            <Sparkles className="h-4 w-4 animate-pulse text-primary" />
            Import Custom Token
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Track and trade any compatible ERC20 contract deployed on the Arc Network by pasting its address below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-3 font-mono">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">
              Token Contract Address
            </label>
            <Input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setError("");
              }}
              placeholder="0x..."
              className="font-mono text-xs bg-background/50 h-10 border-border/60 focus-visible:ring-primary/45"
              disabled={loading}
            />
          </div>

          <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-[10px] text-yellow-400 leading-relaxed flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>Network Warning:</strong> The contract MUST be deployed on the <strong>Arc Network Testnet</strong>. Ethereum Mainnet (DexScreener), Solana, or BSC addresses will not resolve.
            </span>
          </div>

          {error && (
            <div className="rounded border border-destructive/25 bg-destructive/10 p-3 text-[11px] text-destructive leading-relaxed flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded border border-primary/20 bg-primary/4 p-3.5 text-[10px] text-muted-foreground leading-relaxed space-y-2">
            <div className="font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              Automated Market Discovery
            </div>
            <p>
              The intelligence engine will query the contract directly, index its decimals, scan ApexiSwap factories for WUSDC pairs, and retrieve existing reserves.
            </p>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-end gap-2 border-t border-border/30 pt-4 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-9 text-xs font-bold uppercase tracking-wider font-mono"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={loading || !address}
            className="h-9 text-xs font-bold uppercase tracking-wider font-mono text-black"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Indexing...
              </span>
            ) : (
              "Import & Track"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
