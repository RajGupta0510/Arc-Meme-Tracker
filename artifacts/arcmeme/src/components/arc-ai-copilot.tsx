import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Send, 
  Loader2, 
  Activity, 
  ChevronRight, 
  ChevronLeft, 
  Flame, 
  Bot, 
  X, 
  Menu,
  ShieldCheck,
  TrendingUp,
  Volume2,
  Users,
  Compass
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

type ArcAiCopilotProps = {
  tokenId: string;
  tokenTicker: string;
  onPrepareTrade: (side: "buy" | "sell", amount: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
};

export function ArcAiCopilot({
  tokenId,
  tokenTicker,
  onPrepareTrade,
  isCollapsed,
  onToggleCollapse
}: ArcAiCopilotProps) {
  const audio = useAudioTelemetry();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Resizing states
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") return 360;
    try {
      const raw = localStorage.getItem("arcmeme.aiPanelWidth");
      return raw ? parseInt(raw, 10) : 360;
    } catch {
      return 360;
    }
  });
  
  const isResizingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize with greeting
  useEffect(() => {
    setMessages([
      {
        id: "greet-" + Date.now(),
        sender: "copilot",
        text: `🤖 **ARC TERMINAL COPILOT RECRUITED**\n\nI am online and synced with the **$${tokenTicker}** blockchain log scanners.\n\n* Real-time swap analytics, whale tracking, and liquidity audits are active.\n* I can prepare direct trades instantly. Type **"Buy 20 USDC of ${tokenTicker}"** to route trade quotes.\n\nSelect a quick diagnostic action below or send a custom command:`,
        timestamp: new Date()
      }
    ]);
  }, [tokenId, tokenTicker]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

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
      // Calculate from right side of screen since panel sits on the right
      const width = window.innerWidth - e.clientX;
      const cleanWidth = Math.max(280, Math.min(640, width));
      setPanelWidth(cleanWidth);
      localStorage.setItem("arcmeme.aiPanelWidth", cleanWidth.toString());
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

    try {
      const res = await fetch(`/api/tokens/${encodeURIComponent(tokenId)}/ai-chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: textToSend })
      });

      if (!res.ok) throw new Error("AI engine failed");
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
    onPrepareTrade(action.side, action.amount);
    toast({
      title: "⚡ SWAP PARAMETERS STAGED",
      description: `Terminal trading console populated with ${action.amount} size route!`,
    });
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

  if (isCollapsed) {
    return (
      <div className="flex h-full w-[44px] flex-col items-center border-l border-border/80 bg-card/25 py-3 shrink-0">
        <Button
          onClick={onToggleCollapse}
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg border border-border/40 hover:bg-secondary/40 text-primary animate-pulse"
          title="Open AI Copilot"
        >
          <Bot className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="hidden lg:flex h-full border-l border-border/80 bg-card/15 backdrop-blur-md flex-row relative select-none shrink-0"
      style={{ width: `${panelWidth}px` }}
    >
      {/* Draggable Divider Handle */}
      <div 
        onMouseDown={startResize}
        className="absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize hover:bg-primary/25 active:bg-primary/50 transition-colors flex items-center justify-center group z-30"
      >
        <div className="h-10 w-[2px] bg-border group-hover:bg-primary rounded transition-colors" />
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0 font-mono text-xs select-text">
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-3 bg-secondary/10">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] animate-pulse shrink-0" />
            <span className="text-xs uppercase font-extrabold tracking-wider text-primary flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-primary" />
              Arc AI Copilot
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[8px] uppercase tracking-widest text-muted-foreground animate-pulse leading-none">Context: ${tokenTicker}</span>
            <Button
              onClick={onToggleCollapse}
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
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-h-[calc(100vh-280px)] min-h-[100px] hide-scrollbar"
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
                    {/* Custom Simple Markdown Parser */}
                    <div className="space-y-2 whitespace-pre-wrap select-text">
                      {msg.text.split("\n").map((line, idx) => {
                        let parsedLine = line;
                        // Replace headers **text**
                        if (parsedLine.startsWith("🤖 ") || parsedLine.startsWith("⚡ ") || parsedLine.startsWith("📊 ") || parsedLine.startsWith("🐋 ") || parsedLine.startsWith("👥 ") || parsedLine.startsWith("💧 ") || parsedLine.startsWith("📝 ") || parsedLine.startsWith("🟢 ") || parsedLine.startsWith("🔴 ") || parsedLine.startsWith("⚠️ ")) {
                          return <div key={idx} className="font-extrabold text-primary tracking-wide text-xs mt-2 uppercase border-b border-primary/10 pb-1 flex items-center gap-1">{parsedLine}</div>;
                        }
                        
                        // Parse bold indicators
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

                        // Parse monospace indicators
                        let finalContent: React.ReactNode[] = [];
                        parts.forEach((part, partIdx) => {
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

                  {/* Render the Interactive Prepare Swap Relayer Card */}
                  {isCopilot && msg.action && msg.action.type === "prepare_trade" && (
                    <div className="glass-panel border-primary/20 bg-black/70 p-3.5 rounded-xl space-y-3.5 shadow-[0_0_12px_rgba(34,197,94,0.06)]">
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
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest animate-pulse">Running telemetry diagnostics...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Action Diagnostic buttons */}
        <div className="border-t border-border/20 bg-background/25 px-3 py-2 shrink-0">
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
            placeholder={`Ask Copilot... (e.g. "Buy 20 USDC of ${tokenTicker}")`}
            className="flex-1 h-10 font-mono text-[11px] bg-background/50 border-border/60 text-foreground pr-8 placeholder:text-muted-foreground/40 focus-visible:ring-primary/45"
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
    </div>
  );
}

/**
 * Bottom Sheet Drawer Component for responsive Mobile viewports
 */
export function MobileArcAiCopilot({
  tokenId,
  tokenTicker,
  onPrepareTrade,
  open,
  onOpenChange
}: {
  tokenId: string;
  tokenTicker: string;
  onPrepareTrade: (side: "buy" | "sell", amount: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const audio = useAudioTelemetry();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(380); // in px
  const dragStartYRef = useRef<number | null>(null);
  const heightRef = useRef(380);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize greeting
  useEffect(() => {
    setMessages([
      {
        id: "greet-m-" + Date.now(),
        sender: "copilot",
        text: `🤖 **MOBILE TERMINAL COPILOT SYNCED**\n\nI am running real-time diagnostics on **$${tokenTicker}**.\n\n* Quick actions are loaded below.\n* You can prepare swap paths direct from chat!`,
        timestamp: new Date()
      }
    ]);
  }, [tokenId, tokenTicker]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, open]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;
    
    audio.playTickerClick();
    const userMessage: Message = {
      id: "usr-m-" + Date.now(),
      sender: "user",
      text: textToSend,
      timestamp: new Date()
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/tokens/${encodeURIComponent(tokenId)}/ai-chat`, {
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
          id: "cop-m-" + Date.now(),
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
          id: "err-m-" + Date.now(),
          sender: "copilot",
          text: `⚠️ **[SYS] Copilot offline.** API connection failed.`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const executePrepareTrade = (action: Exclude<Message["action"], undefined>) => {
    audio.playHypeSound();
    onPrepareTrade(action.side, action.amount);
    onOpenChange(false); // Close mobile drawer to reveal populated trade terminal!
    toast({
      title: "⚡ SWAP PARAMETERS POPULATED",
      description: `Terminal trading console populated with ${action.amount} size route!`,
    });
  };

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartYRef.current = clientY;
    heightRef.current = drawerHeight;
    document.body.style.userSelect = "none";
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (dragStartYRef.current === null) return;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const deltaY = dragStartYRef.current - clientY;
    const nextHeight = Math.max(160, Math.min(window.innerHeight - 100, heightRef.current + deltaY));
    setDrawerHeight(nextHeight);
  };

  const handleDragEnd = () => {
    dragStartYRef.current = null;
    document.body.style.userSelect = "auto";
    if (drawerHeight < 200) {
      onOpenChange(false); // Auto-collapse if dragged too low
      setDrawerHeight(380);
    }
  };

  const quickActions = [
    { label: "Analyze", prompt: "Analyze Token", icon: TrendingUp },
    { label: "Whales", prompt: "Whale Activity", icon: Flame },
    { label: "Risk", prompt: "Risk Check", icon: ShieldCheck },
    { label: "Holders", prompt: "Holder Analysis", icon: Users },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/45 backdrop-blur-[1px]">
      {/* Tap outside to close overlay */}
      <div className="absolute inset-0 z-10" onClick={() => onOpenChange(false)} />

      {/* Slide up Drawer Sheet */}
      <div 
        className="relative z-20 w-full bg-card/95 border-t border-border/80 rounded-t-2xl flex flex-col font-mono text-[11px] select-text shadow-[0_-8px_30px_rgba(0,0,0,0.5)]"
        style={{ height: `${drawerHeight}px` }}
      >
        {/* Resize Handle Drag Header */}
        <div 
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          className="w-full py-2.5 flex flex-col items-center cursor-row-resize bg-secondary/15 hover:bg-secondary/30 transition-colors shrink-0"
        >
          <div className="w-12 h-1 rounded-full bg-muted-foreground/40 mb-1" />
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-extrabold flex items-center gap-1 leading-none select-none">
            <Bot className="h-3.5 w-3.5 text-primary animate-pulse" />
            Arc AI Copilot Drawer (Drag to Resize)
          </div>
        </div>

        {/* Scroll message thread */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 hide-scrollbar min-h-[80px]"
        >
          {messages.map((msg) => {
            const isCopilot = msg.sender === "copilot";
            return (
              <div 
                key={msg.id} 
                className={`flex gap-2.5 max-w-[90%] ${isCopilot ? "self-start mr-auto" : "self-end ml-auto flex-row-reverse"}`}
              >
                <div className={`h-6.5 w-6.5 rounded-full shrink-0 flex items-center justify-center border text-[9px] font-bold ${
                  isCopilot 
                    ? "bg-primary/10 border-primary/25 text-primary" 
                    : "bg-secondary/20 border-border/60 text-muted-foreground"
                }`}>
                  {isCopilot ? "AI" : "YOU"}
                </div>
                <div className="space-y-2.5 min-w-0">
                  <div className={`p-3 rounded-lg border text-[10px] leading-relaxed relative ${
                    isCopilot 
                      ? "bg-card/45 border-border/70 text-foreground/90 shadow-sm" 
                      : "bg-secondary/35 border-border/50 text-foreground"
                  }`}>
                    {/* Custom Simple Markdown Parser */}
                    <div className="space-y-1.5 whitespace-pre-wrap select-text">
                      {msg.text.split("\n").map((line, idx) => {
                        let parsedLine = line;
                        if (parsedLine.startsWith("🤖 ") || parsedLine.startsWith("⚡ ") || parsedLine.startsWith("📊 ") || parsedLine.startsWith("🐋 ") || parsedLine.startsWith("👥 ") || parsedLine.startsWith("💧 ") || parsedLine.startsWith("📝 ") || parsedLine.startsWith("🟢 ") || parsedLine.startsWith("🔴 ") || parsedLine.startsWith("⚠️ ")) {
                          return <div key={idx} className="font-extrabold text-primary tracking-wide text-[10px] mt-1.5 uppercase border-b border-primary/10 pb-0.5">{parsedLine}</div>;
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
                              finalContent.push(<code key={startIdx} className="font-mono bg-black/60 border border-border/30 px-1 py-0.5 rounded text-[9px] text-foreground font-semibold">{monoText}</code>);
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
                            className={`min-h-[14px] ${
                              line.startsWith("* ") 
                                ? "pl-3 relative before:absolute before:left-0.5 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-primary/70 before:rounded-full" 
                                : ""
                            }`}
                          >
                            {line.startsWith("* ") ? finalContent.slice(1) : finalContent}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mobile Prepare Swap Relayer Card */}
                  {isCopilot && msg.action && msg.action.type === "prepare_trade" && (
                    <div className="border border-primary/20 bg-black/70 p-3 rounded-lg space-y-3.5">
                      <div className="flex justify-between items-center text-[9px] text-primary uppercase font-extrabold tracking-widest border-b border-primary/10 pb-1">
                        <span>⚡ Trade preparation</span>
                        <span>APE XISWAP</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-[9px] leading-relaxed">
                        <div className="bg-secondary/15 rounded p-1.5 border border-border/20">
                          <span className="text-muted-foreground uppercase text-[8px]">Expected Output:</span>
                          <div className="font-bold text-foreground mt-0.5">{msg.action.expectedOutput} {msg.action.side === "buy" ? msg.action.ticker : "USDC"}</div>
                        </div>
                        <div className="bg-secondary/15 rounded p-1.5 border border-border/20">
                          <span className="text-muted-foreground uppercase text-[8px]">Price Impact:</span>
                          <div className="font-bold text-destructive mt-0.5">{msg.action.priceImpact}</div>
                        </div>
                      </div>

                      <Button
                        onClick={() => executePrepareTrade(msg.action!)}
                        className="w-full h-8.5 bg-primary hover:bg-primary/90 text-black font-extrabold uppercase text-[9px] tracking-wider shrink-0"
                      >
                        Prepare Swap Route
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex gap-2.5 max-w-[85%] self-start mr-auto">
              <div className="h-6.5 w-6.5 rounded-full shrink-0 flex items-center justify-center border bg-primary/10 border-primary/25 text-primary">
                AI
              </div>
              <div className="p-2.5 rounded-lg border bg-card/45 border-border/70 text-foreground/90 flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest animate-pulse">Running checks...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick action diagnostics */}
        <div className="border-t border-border/20 bg-background/25 px-3 py-1.5 shrink-0 select-none">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 max-w-full hide-scrollbar">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  disabled={isLoading}
                  onClick={() => handleSend(action.prompt)}
                  className="px-2 py-1 text-[9px] font-bold border border-border/70 rounded hover:border-primary/55 text-muted-foreground hover:text-primary transition-all uppercase shrink-0 flex items-center gap-1.5 bg-background/40 hover:bg-background/80"
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Input form */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="border-t border-border/40 p-2 bg-secondary/15 flex gap-2 shrink-0 items-center pb-4"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder={`Buy 20 USDC of ${tokenTicker}...`}
            className="flex-1 h-9.5 font-mono text-[10px] bg-background/50 border-border/60 text-foreground pr-8 placeholder:text-muted-foreground/40 focus-visible:ring-primary/45"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="h-9.5 w-9.5 p-0 bg-primary hover:bg-primary/90 text-black rounded-lg border border-primary/20 shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
