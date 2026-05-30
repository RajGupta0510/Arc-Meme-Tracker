import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Send, 
  Loader2, 
  Activity, 
  ChevronRight, 
  Flame, 
  Bot, 
  X, 
  ShieldCheck,
  TrendingUp,
  Volume2,
  Users,
  Compass,
  Sparkles
} from "lucide-react";
import { useAudioTelemetry } from "@/hooks/use-audio-telemetry";
import { useToast } from "@/hooks/use-toast";

type Message = {
  id: string;
  sender: "user" | "copilot";
  text: string;
  timestamp: Date;
  action?: {
    type: "prepare_trade";
    side: "buy" | "sell";
    amount: string;
    tokenId: string;
    ticker: string;
    expectedOutput: string;
    slippage: string;
    priceImpact: string;
  };
};

export function GlobalAiCopilot() {
  const [path, setLocation] = useLocation();
  const audio = useAudioTelemetry();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeToken, setActiveToken] = useState<{ id: string; ticker: string } | null>(null);

  // Resizing states
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") return 380;
    try {
      const raw = localStorage.getItem("arcmeme.globalAiWidth");
      return raw ? parseInt(raw, 10) : 380;
    } catch {
      return 380;
    }
  });

  const isResizingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. DYNAMIC TOKEN CONTEXT DETECTION FROM URL LOCATION
  useEffect(() => {
    // Check if URL is /token/:id
    const match = path.match(/\/token\/([^/]+)/);
    const idFromUrl = match ? match[1] : null;

    const fetchTokenTicker = async (tokenId: string) => {
      try {
        const res = await fetch(`/api/tokens/${encodeURIComponent(tokenId)}`);
        if (res.ok) {
          const data = await res.json() as { ticker: string; id: string };
          setActiveToken({ id: data.id, ticker: data.ticker });
        }
      } catch {
        setActiveToken({ id: tokenId, ticker: "TT" });
      }
    };

    if (idFromUrl) {
      fetchTokenTicker(idFromUrl);
    } else {
      // Clear specific token context when on other pages (Global Context!)
      setActiveToken(null);
    }
  }, [path]);

  // Greeting refresh on token context changes
  useEffect(() => {
    if (activeToken) {
      const ticker = activeToken.ticker;
      setMessages([
        {
          id: "greet-" + Date.now(),
          sender: "copilot",
          text: `🤖 **GLOBAL ARC AI COPILOT SYNCED**\n\nI am online and tracking active market telemetry across the terminal.\n\n* **Active Context:** \`$${ticker}\`\n* I can calculate buy/sell quotes. Try: **"Buy 20 USDC of ${ticker}"**\n* All trading actions will automatically mount into the terminal console.\n\nSelect a quick diagnostic scout below or enter a custom prompt:`,
          timestamp: new Date()
        }
      ]);
    } else {
      setMessages([
        {
          id: "greet-" + Date.now(),
          sender: "copilot",
          text: `🤖 **GLOBAL ARC AI COPILOT SYNCED**\n\nI am online and tracking active market telemetry across all terminal pools.\n\n* **Active Context:** \`Global Market\`\n* You can ask about any token (e.g., **"Analyze MG"** or **"Buy 10 USDC of TT"**).\n* All trading actions will automatically mount into the terminal console.\n\nSelect a quick diagnostic scout below or enter a custom prompt:`,
          timestamp: new Date()
        }
      ]);
    }
  }, [activeToken]);

  // Scroll anchor
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isOpen]);

  // Resize handler
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const width = window.innerWidth - e.clientX;
      const cleanWidth = Math.max(300, Math.min(650, width));
      setPanelWidth(cleanWidth);
      localStorage.setItem("arcmeme.globalAiWidth", cleanWidth.toString());
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = "default";
        document.body.style.userSelect = "auto";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;
    
    audio.playTickerClick();
    const userMessage: Message = {
      id: "usr-" + Date.now(),
      sender: "user",
      text: textToSend,
      timestamp: new Date()
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const targetTokenId = activeToken?.id || "all";

    try {
      const res = await fetch(`/api/tokens/${encodeURIComponent(targetTokenId)}/ai-chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: textToSend })
      });

      if (!res.ok) throw new Error("AI failed");
      const data = await res.json() as { reply: string; action?: Message["action"] };
      
      audio.playHypeSound();
      setMessages((prev) => [
        ...prev,
        {
          id: "cop-" + Date.now(),
          sender: "copilot",
          text: data.reply,
          timestamp: new Date(),
          action: data.action
        }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          sender: "copilot",
          text: `⚠️ **[SYS] Copilot scanner offline.** Failed to communicate with core intelligence node. Please verify API server status.`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const executePrepareTrade = (action: Exclude<Message["action"], undefined>) => {
    audio.playHypeSound();
    
    const triggerPrepareEvent = () => {
      window.dispatchEvent(new CustomEvent("prepare-trade", {
        detail: { side: action.side, amount: action.amount }
      }));
    };

    // If already on the token page, dispatch instantly. Otherwise, route first!
    if (path === `/token/${action.tokenId}`) {
      triggerPrepareEvent();
      setIsOpen(false); // Close AI panel to reveal trading form
      toast({
        title: "⚡ SWAP PARAMETERS POPULATED",
        description: `Terminal trading console populated with ${action.amount} size route!`,
      });
    } else {
      setLocation(`/token/${action.tokenId}`);
      setIsOpen(false);
      setTimeout(() => {
        triggerPrepareEvent();
        toast({
          title: "⚡ ROUTED & STAGED",
          description: `Brought to $${action.ticker} terminal and populated order console!`,
        });
      }, 600);
    }
  };

  const togglePanel = () => {
    audio.playTickerClick();
    setIsOpen(!isOpen);
  };

  const quickActions = [
    { label: "Analyze Token", prompt: "Analyze Token", icon: TrendingUp },
    { label: "Whale Scout", prompt: "Whale Activity", icon: Flame },
    { label: "Risk Audit", prompt: "Risk Check", icon: ShieldCheck },
    { label: "Holder Profile", prompt: "Holder Analysis", icon: Users },
    { label: "DEX Liquidity", prompt: "Liquidity Health", icon: Compass },
    { label: "Recent Swaps", prompt: "Recent Trades", icon: Activity },
    { label: "Volume Scans", prompt: "Volume Analysis", icon: Volume2 },
  ];

  const currentTicker = activeToken ? `$${activeToken.ticker}` : "Global Market";

  return (
    <>
      {/* ─── FLOATING CIRCLE AVATAR BUBBLE ─── */}
      {!isOpen && (
        <div 
          className="fixed bottom-6 right-6 z-[999] select-none group"
        >
          <button
            onClick={togglePanel}
            className="h-15 w-15 md:h-16 md:w-16 rounded-full flex items-center justify-center bg-black border-2 border-primary/45 text-primary hover:border-primary transition-all duration-300 relative shadow-[0_0_24px_rgba(34,197,94,0.3)] hover:shadow-[0_0_36px_rgba(34,197,94,0.65)] hover:scale-105 active:scale-95 animate-[pulse_4s_infinite]"
          >
            <Bot className="h-7 w-7 text-primary drop-shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary border-2 border-black flex items-center justify-center animate-bounce">
              <Sparkles className="h-2 w-2 text-black fill-black" />
            </span>

            {/* Glowing Outer border effect */}
            <div className="absolute inset-0.5 rounded-full border border-dashed border-primary opacity-40 animate-[spin_20s_linear_infinite]" />
          </button>

          {/* Floating Tooltip */}
          <div className="absolute right-20 top-4 opacity-0 group-hover:opacity-100 bg-black/90 text-primary border border-primary/30 font-mono text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-md pointer-events-none transition-opacity duration-300 shadow-md whitespace-nowrap">
            Arc AI Copilot Telemetry Live
          </div>
        </div>
      )}

      {/* ─── SLIDING CHAT SIDEBAR OVERLAY ─── */}
      {isOpen && (
        <div 
          className="fixed top-0 bottom-0 right-0 z-[998] border-l border-border/80 bg-card/95 backdrop-blur-xl flex flex-col font-mono text-xs shadow-[0_0_50px_rgba(0,0,0,0.7)] animate-in slide-in-from-right duration-350"
          style={{ width: `${panelWidth}px` }}
        >
          {/* Draggable Divider Handle */}
          <div 
            onMouseDown={startResize}
            className="absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize hover:bg-primary/25 active:bg-primary/50 transition-colors flex items-center justify-center group z-30"
          >
            <div className="h-12 w-[2.5px] bg-border group-hover:bg-primary rounded transition-colors" />
          </div>

          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 bg-secondary/15">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))] animate-pulse shrink-0" />
              <span className="text-xs uppercase font-extrabold tracking-wider text-primary flex items-center gap-1.5 select-none">
                <Bot className="h-4.5 w-4.5 text-primary" />
                Arc AI Copilot
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[8px] uppercase tracking-widest text-muted-foreground animate-pulse leading-none select-none">
                Context: {currentTicker}
              </span>
              <Button
                onClick={togglePanel}
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded border border-border/30 hover:bg-secondary/40 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Message Thread Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-h-[calc(100vh-140px)] min-h-[100px] hide-scrollbar select-text"
          >
            {messages.map((msg) => {
              const isCopilot = msg.sender === "copilot";
              return (
                <div 
                  key={msg.id} 
                  className={`flex gap-3 max-w-[92%] ${isCopilot ? "self-start mr-auto" : "self-end ml-auto flex-row-reverse"}`}
                >
                  <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center border text-[10px] ${
                    isCopilot 
                      ? "bg-primary/10 border-primary/25 text-primary" 
                      : "bg-secondary/20 border-border/60 text-muted-foreground"
                  }`}>
                    {isCopilot ? "AI" : "YOU"}
                  </div>
                  <div className="space-y-3 min-w-0">
                    <div className={`p-3.5 rounded-lg border text-[11px] leading-relaxed relative ${
                      isCopilot 
                        ? "bg-card/45 border-border/70 text-foreground/90 shadow-sm" 
                        : "bg-secondary/35 border-border/50 text-foreground"
                    }`}>
                      <div className="space-y-2 whitespace-pre-wrap select-text">
                        {msg.text.split("\n").map((line, idx) => {
                          let parsedLine = line;
                          if (parsedLine.startsWith("🤖 ") || parsedLine.startsWith("⚡ ") || parsedLine.startsWith("📊 ") || parsedLine.startsWith("🐋 ") || parsedLine.startsWith("👥 ") || parsedLine.startsWith("💧 ") || parsedLine.startsWith("📝 ") || parsedLine.startsWith("🟢 ") || parsedLine.startsWith("🔴 ") || parsedLine.startsWith("⚠️ ")) {
                            return <div key={idx} className="font-extrabold text-primary tracking-wide text-xs mt-2 uppercase border-b border-primary/10 pb-1 flex items-center gap-1">{parsedLine}</div>;
                          }
                          
                          const parts = [];
                          let tempLine = parsedLine;
                          let boldMatch;
                          while ((boldMatch = tempLine.match(/\*\*(.*?)\*\*/))) {
                            const startIdx = boldMatch.index!;
                            const boldText = boldMatch[1];
                            parts.push(tempLine.slice(0, startIdx));
                            parts.push(<strong key={startIdx} className="font-bold text-foreground text-primary/95">{boldText}</strong>);
                            tempLine = tempLine.slice(startIdx + boldMatch[0].length);
                          }
                          parts.push(tempLine);

                          let finalContent: React.ReactNode[] = [];
                          parts.forEach((part) => {
                            if (typeof part === "string") {
                              let tempPart = part;
                              let monoMatch;
                              while ((monoMatch = tempPart.match(/`(.*?)`/))) {
                                const startIdx = monoMatch.index!;
                                const monoText = monoMatch[1];
                                finalContent.push(tempPart.slice(0, startIdx));
                                finalContent.push(<code key={startIdx} className="font-mono bg-black/60 border border-border/30 px-1 py-0.5 rounded text-[10px] text-foreground font-semibold">{monoText}</code>);
                                tempPart = tempPart.slice(startIdx + monoMatch[0].length);
                              }
                              finalContent.push(tempPart);
                            } else {
                              finalContent.push(part);
                            }
                          });

                          return (
                            <div 
                              key={idx} 
                              className={`min-h-[16px] ${
                                line.startsWith("* ") 
                                  ? "pl-3.5 relative before:absolute before:left-1 before:top-2 before:w-1.5 before:h-1.5 before:bg-primary/70 before:rounded-full" 
                                  : ""
                              }`}
                            >
                              {line.startsWith("* ") ? finalContent.slice(1) : finalContent}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Render Interactive Prepare Swap Relayer Card */}
                    {isCopilot && msg.action && msg.action.type === "prepare_trade" && (
                      <div className="glass-panel border-primary/20 bg-black/70 p-3.5 rounded-xl space-y-3 shadow-[0_0_12px_rgba(34,197,94,0.06)]">
                        <div className="flex justify-between items-center text-[10px] text-primary uppercase font-extrabold tracking-widest border-b border-primary/10 pb-1.5">
                          <span>⚡ Trade preparation console</span>
                          <span>APE XISWAP</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-[10px] leading-relaxed">
                          <div className="bg-secondary/15 rounded p-2 border border-border/20">
                            <span className="text-muted-foreground uppercase">Expected Output:</span>
                            <div className="font-bold text-foreground mt-0.5">{msg.action.expectedOutput} {msg.action.side === "buy" ? msg.action.ticker : "USDC"}</div>
                          </div>
                          <div className="bg-secondary/15 rounded p-2 border border-border/20">
                            <span className="text-muted-foreground uppercase">Price Impact:</span>
                            <div className="font-bold text-destructive mt-0.5">{msg.action.priceImpact}</div>
                          </div>
                        </div>

                        <Button
                          onClick={() => executePrepareTrade(msg.action!)}
                          className="w-full h-9 bg-primary hover:bg-primary/90 text-black font-extrabold uppercase text-[10px] tracking-wider shrink-0"
                        >
                          Prepare {msg.action.side === "buy" ? "Buy" : "Sell"} Swap Route
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="flex gap-3 max-w-[85%] self-start mr-auto">
                <div className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center border bg-primary/10 border-primary/25 text-primary">
                  AI
                </div>
                <div className="p-3 rounded-lg border bg-card/45 border-border/70 text-foreground/90 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest animate-pulse">Running checks...</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Action buttons */}
          <div className="border-t border-border/20 bg-background/25 px-3 py-2 shrink-0 select-none">
            <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full hide-scrollbar">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    disabled={isLoading}
                    onClick={() => handleSend(action.prompt)}
                    className="px-2.5 py-1 text-[9px] font-bold border border-border/70 rounded hover:border-primary/55 text-muted-foreground hover:text-primary transition-all uppercase shrink-0 flex items-center gap-1.5 bg-background/40 hover:bg-background/80"
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat input form */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="border-t border-border/40 p-3 bg-secondary/15 flex gap-2 shrink-0 items-center"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder={`Buy 20 USDC of ${currentTicker}...`}
              className="flex-1 h-10 font-mono text-[11px] bg-background/50 border-border/60 text-foreground pr-8 placeholder:text-muted-foreground/45 focus-visible:ring-primary/45"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-10 w-10 p-0 bg-primary hover:bg-primary/90 text-black rounded-lg border border-primary/20 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
