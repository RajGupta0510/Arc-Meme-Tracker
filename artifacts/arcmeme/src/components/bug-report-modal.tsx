import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bug, Mail, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";

interface BugReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type BugCategory = "ui_ux" | "smart_wallet" | "liquidity" | "token_launch" | "general";
type SeverityLevel = "critical" | "high" | "medium" | "low";

export function BugReportModal({ open, onOpenChange }: BugReportModalProps) {
  const [category, setCategory] = useState<BugCategory>("ui_ux");
  const [severity, setSeverity] = useState<SeverityLevel>("medium");
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories: { value: BugCategory; label: string }[] = [
    { value: "ui_ux", label: "UI / UX Layout" },
    { value: "smart_wallet", label: "Smart Wallet" },
    { value: "liquidity", label: "LP / Swap" },
    { value: "token_launch", label: "Token Launch" },
    { value: "general", label: "General System" },
  ];

  const severities: { value: SeverityLevel; label: string; color: string }[] = [
    { value: "critical", label: "Critical", color: "text-[var(--accent-destructive)] border-[var(--accent-destructive)] bg-[var(--accent-destructive-glow-muted)]" },
    { value: "high", label: "High", color: "text-amber-500 border-amber-500/50 bg-amber-500/10" },
    { value: "medium", label: "Medium", color: "text-yellow-400 border-yellow-400/50 bg-yellow-400/10" },
    { value: "low", label: "Low", color: "text-[var(--accent-neon)] border-[var(--accent-neon)]/50 bg-[var(--accent-neon-muted)]" },
  ];

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !steps) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("https://formsubmit.co/ajax/rajaryangupta5@gmail.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          _subject: `[ArcMeme Bug] [${category.replace("_", " ").toUpperCase()}] [${severity.toUpperCase()}] ${title}`,
          Category: category.replace("_", " ").toUpperCase(),
          Severity: severity.toUpperCase(),
          Title: title,
          "Steps to Reproduce": steps,
          "Expected Behavior": expected || "N/A",
          "Actual Behavior": actual || "N/A",
        }),
      });

      if (!response.ok) {
        throw new Error("API relay failed");
      }

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onOpenChange(false);
        // Reset form fields
        setTitle("");
        setSteps("");
        setExpected("");
        setActual("");
      }, 3000);
    } catch (err) {
      console.error("Direct API submit failed, falling back to mailto client prompt", err);
      
      // Fallback: trigger system mailto link
      const subject = encodeURIComponent(`[ArcMeme Bug] [${category.toUpperCase()}] ${title}`);
      const body = encodeURIComponent(
        `• CATEGORY: ${category.replace("_", " ").toUpperCase()}\n` +
        `• SEVERITY: ${severity.toUpperCase()}\n\n` +
        `• BUG TITLE / SUMMARY:\n  ${title}\n\n` +
        `• STEPS TO REPRODUCE:\n${steps}\n\n` +
        `• EXPECTED BEHAVIOR:\n  ${expected || "N/A"}\n\n` +
        `• ACTUAL BEHAVIOR:\n  ${actual || "N/A"}`
      );
      
      window.location.href = `mailto:rajaryangupta5@gmail.com?subject=${subject}&body=${body}`;
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onOpenChange(false);
        setTitle("");
        setSteps("");
        setExpected("");
        setActual("");
      }, 3000);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] max-h-[90vh] overflow-y-auto thin-scrollbar border-border bg-card/95 backdrop-blur-xl p-6 font-mono text-xs text-foreground z-[200]">
        <DialogHeader className="mb-4">
          <DialogTitle className="font-mono text-sm uppercase tracking-widest text-primary flex items-center gap-2">
            <Bug className="h-4.5 w-4.5 text-primary animate-pulse" />
            Report Issue / Bug
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px] text-muted-foreground mt-1 leading-normal">
            Submit bugs directly to the developer team. Submissions are routed automatically to <strong className="text-foreground">rajaryangupta5@gmail.com</strong>.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
            <CheckCircle2 className="h-12 w-12 text-[var(--accent-neon)] animate-bounce" />
            <div className="text-[var(--accent-neon)] font-bold uppercase">Bug Report Submitted!</div>
            <p className="text-[10px] text-muted-foreground max-w-xs leading-relaxed">
              Thank you for reporting. Your diagnostics have been successfully queued and sent directly to the development inbox.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitReport} className="space-y-4">
            {/* Category Select */}
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase text-muted-foreground tracking-wider">Bug Category</label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`px-2.5 py-1.5 rounded-[4px] border text-[10px] uppercase transition-all duration-200 cursor-pointer ${
                      category === c.value
                        ? "border-[var(--accent-neon)] bg-[var(--accent-neon-muted)] text-[var(--accent-neon)] font-bold shadow-[0_0_8px_var(--accent-neon-glow-card)]"
                        : "border-border/50 text-muted-foreground hover:border-border hover:bg-white/5"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity Level */}
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase text-muted-foreground tracking-wider">Severity</label>
              <div className="grid grid-cols-4 gap-1.5">
                {severities.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSeverity(s.value)}
                    className={`px-2.5 py-1.5 rounded-[4px] border text-[10px] uppercase transition-all duration-200 text-center cursor-pointer ${
                      severity === s.value
                        ? s.color + " font-extrabold shadow-sm"
                        : "border-border/50 text-muted-foreground hover:border-border hover:bg-white/5"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bug Title / Summary */}
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase text-muted-foreground tracking-wider">Bug Summary</label>
              <Input
                required
                placeholder="Brief summary of the issue (e.g. Wallet balance fails to sync)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-background/40 border-border/60 text-foreground placeholder:text-muted-foreground/40 font-mono text-[11px] cyber-search-focus transition-all h-9"
              />
            </div>

            {/* Steps to Reproduce */}
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase text-muted-foreground tracking-wider">Steps to Reproduce</label>
              <Textarea
                required
                placeholder="1. Connect MetaMask\n2. Open smart wallet console\n3. Click deposit..."
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                className="bg-background/40 border-border/60 text-foreground placeholder:text-muted-foreground/40 font-mono text-[11px] cyber-search-focus transition-all min-h-[70px] resize-none"
              />
            </div>

            {/* Expected & Actual */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase text-muted-foreground tracking-wider">Expected Behavior</label>
                <Textarea
                  placeholder="Should show pending Tx..."
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                  className="bg-background/40 border-border/60 text-foreground placeholder:text-muted-foreground/40 font-mono text-[11px] cyber-search-focus transition-all min-h-[50px] resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase text-muted-foreground tracking-wider">Actual Behavior</label>
                <Textarea
                  placeholder="Console prints error code 500..."
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  className="bg-background/40 border-border/60 text-foreground placeholder:text-muted-foreground/40 font-mono text-[11px] cyber-search-focus transition-all min-h-[50px] resize-none"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex pt-2 border-t border-border/40">
              <Button
                type="submit"
                disabled={isSending || !title || !steps}
                className="w-full text-black bg-primary hover:bg-primary/80 font-bold uppercase text-[10px] h-9 gap-1.5 cursor-pointer shadow-[0_0_12px_var(--accent-neon-glow-card)]"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Transmitting Diagnostics...
                  </>
                ) : (
                  <>
                    <Mail className="h-3.5 w-3.5" />
                    Submit Bug Report
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
