import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { customFetch } from "@workspace/api-client-react";
import { MessageSquare, Flame, Rocket, Smile, ArrowUpRight, TrendingUp, TrendingDown, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatAddress } from "@/lib/utils";

type Comment = {
  id: string;
  tokenId: string;
  authorAddress: string;
  content: string;
  timestamp: string;
  parentId: string | null;
};

type Reaction = {
  id: string;
  tokenId: string;
  commentId: string | null;
  userAddress: string;
  emoji: string;
  timestamp: string;
};

type CommentsSectionProps = {
  tokenId: string;
  connectedWalletAddress: string | undefined;
};

const AVAILABLE_EMOJIS = ["🔥", "🚀", "💩", "🐂", "🐻"];

function getAddressGradient(address: string) {
  if (!address) return "linear-gradient(135deg, #22c55e 0%, #15803d 100%)";
  const clean = address.replace("0x", "");
  const h1 = parseInt(clean.slice(0, 4), 16) % 360;
  const h2 = parseInt(clean.slice(4, 8), 16) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 85%, 60%) 0%, hsl(${h2}, 85%, 45%) 100%)`;
}

export function CommentsSection({ tokenId, connectedWalletAddress }: CommentsSectionProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [commentText, setCommentText] = useState("");
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);

  const fetchComments = async () => {
    try {
      const data = await customFetch<{ comments: Comment[]; reactions: Reaction[] }>(
        `/api/tokens/${tokenId}/comments`
      );
      setComments(data.comments || []);
      setReactions(data.reactions || []);
    } catch {
      // Ignore fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 10000);
    return () => clearInterval(interval);
  }, [tokenId]);

  // Nested comments (Threaded replies)
  const threadedComments = useMemo(() => {
    const rootComments = comments.filter((c) => !c.parentId);
    const repliesMap = new Map<string, Comment[]>();
    comments.forEach((c) => {
      if (c.parentId) {
        const arr = repliesMap.get(c.parentId) || [];
        arr.push(c);
        repliesMap.set(c.parentId, arr);
      }
    });

    return rootComments.map((root) => ({
      ...root,
      replies: (repliesMap.get(root.id) || []).sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [comments]);

  // Aggregate emoji reactions
  const aggregatedReactions = useMemo(() => {
    const tokenWide: Record<string, { count: number; active: boolean }> = {};
    const commentWide: Record<string, Record<string, { count: number; active: boolean }>> = {};

    AVAILABLE_EMOJIS.forEach((emoji) => {
      tokenWide[emoji] = { count: 0, active: false };
    });

    reactions.forEach((r) => {
      const isActive = connectedWalletAddress
        ? r.userAddress.toLowerCase() === connectedWalletAddress.toLowerCase()
        : false;

      if (!r.commentId) {
        if (!tokenWide[r.emoji]) {
          tokenWide[r.emoji] = { count: 0, active: false };
        }
        tokenWide[r.emoji].count += 1;
        if (isActive) tokenWide[r.emoji].active = true;
      } else {
        if (!commentWide[r.commentId]) {
          commentWide[r.commentId] = {};
        }
        if (!commentWide[r.commentId][r.emoji]) {
          commentWide[r.commentId][r.emoji] = { count: 0, active: false };
        }
        commentWide[r.commentId][r.emoji].count += 1;
        if (isActive) commentWide[r.commentId][r.emoji].active = true;
      }
    });

    return { tokenWide, commentWide };
  }, [reactions, connectedWalletAddress]);

  const handlePostComment = async (parentId: string | null = null) => {
    const text = parentId ? replyText[parentId] : commentText;
    if (!text || !text.trim()) return;

    if (!connectedWalletAddress) {
      toast({
        variant: "destructive",
        title: "Session Locked",
        description: "Please connect your wallet session to join the meme discussion.",
      });
      return;
    }

    try {
      const response = await customFetch<Comment>(`/api/tokens/${tokenId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          authorAddress: connectedWalletAddress,
          content: text.trim(),
          parentId,
        }),
      });

      setComments((prev) => [response, ...prev]);
      if (parentId) {
        setReplyText((prev) => ({ ...prev, [parentId]: "" }));
        setActiveReplyId(null);
      } else {
        setCommentText("");
      }
      toast({ title: "Comment Posted", description: "Your message is live on the feed!" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to broadcast comment." });
    }
  };

  const handleToggleReaction = async (emoji: string, commentId: string | null = null) => {
    if (!connectedWalletAddress) {
      toast({
        variant: "destructive",
        title: "Session Locked",
        description: "Please connect your wallet session to react.",
      });
      return;
    }

    try {
      const result = await customFetch<{ added: boolean }>(`/api/tokens/${tokenId}/reactions`, {
        method: "POST",
        body: JSON.stringify({
          commentId,
          userAddress: connectedWalletAddress,
          emoji,
        }),
      });

      // Optimistic state updates
      setReactions((prev) => {
        if (result.added) {
          return [
            ...prev,
            {
              id: "temp",
              tokenId,
              commentId,
              userAddress: connectedWalletAddress,
              emoji,
              timestamp: new Date().toISOString(),
            },
          ];
        } else {
          return prev.filter(
            (r) =>
              !(
                r.commentId === commentId &&
                r.userAddress.toLowerCase() === connectedWalletAddress.toLowerCase() &&
                r.emoji === emoji
              )
          );
        }
      });
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center text-xs font-mono text-muted-foreground">
        <Loader2 className="w-4 h-4 text-primary animate-spin mr-2" />
        Syncing chat logs...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* ─── TOKEN WIDE EMOJI REACTION WALL ─── */}
      <div className="bg-background/25 border border-border/40 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs uppercase font-mono tracking-wider font-extrabold text-foreground/80 flex items-center gap-1.5">
            <Rocket className="h-3.5 w-3.5 text-primary" /> Token Moodboard
          </h4>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase">Cast your current sentiment on the charts</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {AVAILABLE_EMOJIS.map((emoji) => {
            const state = aggregatedReactions.tokenWide[emoji] || { count: 0, active: false };
            return (
              <button
                key={emoji}
                onClick={() => handleToggleReaction(emoji, null)}
                className={`px-3.5 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                  state.active
                    ? "bg-primary/20 border-primary text-primary shadow-[0_0_8px_rgba(34,197,94,0.15)]"
                    : "bg-card/30 border-border/40 hover:border-primary/50 text-foreground/80"
                }`}
              >
                <span>{emoji}</span>
                <span className="text-[10px] opacity-75">{state.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── WRITE COMMENT COMPONENT ─── */}
      <div className="bg-card/30 border border-border/60 rounded-xl p-4 space-y-3.5">
        <h4 className="text-xs uppercase font-mono tracking-widest font-bold text-primary flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" /> Broadcast Meme Sentiment
        </h4>
        
        <Textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={
            connectedWalletAddress
              ? "Share technical analysis, meme sentiment, or pump predictions..."
              : "Please connect Metamask wallet to unlock broad casting..."
          }
          disabled={!connectedWalletAddress}
          className="resize-none min-h-[80px] bg-background/30 border-border/50 text-xs font-mono"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {connectedWalletAddress ? (
              <div className="flex items-center gap-1.5">
                <div
                  className="h-4.5 w-4.5 rounded-full border border-border/40 shrink-0"
                  style={{ background: getAddressGradient(connectedWalletAddress) }}
                />
                <span className="text-[10px] font-mono font-bold text-primary">
                  {formatAddress(connectedWalletAddress)}
                </span>
              </div>
            ) : (
              <span className="text-[9px] uppercase font-mono text-muted-foreground">Locked Session</span>
            )}
          </div>
          
          <Button
            size="sm"
            onClick={() => handlePostComment(null)}
            disabled={!connectedWalletAddress || !commentText.trim()}
            className="font-mono text-xs uppercase font-bold text-black shrink-0 px-5"
          >
            Broadcast
          </Button>
        </div>
      </div>

      {/* ─── LIVE CHAT FEED ─── */}
      <div className="space-y-4">
        <h4 className="text-xs font-mono uppercase tracking-widest font-extrabold text-foreground/75 px-1">
          Market Terminal Stream ({comments.length})
        </h4>

        {threadedComments.length === 0 ? (
          <div className="rounded-xl border border-border/30 bg-card/10 p-8 text-center text-xs font-mono text-muted-foreground">
            No broadcast logs available. Be the first to start the trend!
          </div>
        ) : (
          <div className="space-y-4.5">
            {threadedComments.map((comment) => {
              const gradient = getAddressGradient(comment.authorAddress);
              const isCreator = comment.authorAddress.toLowerCase() === comment.authorAddress.toLowerCase(); // simplified
              const timestampStr = new Date(comment.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div key={comment.id} className="border-l-2 border-border/60 pl-4 py-0.5 space-y-2.5">
                  
                  {/* Comment header */}
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-5 w-5 rounded-full border border-border/30"
                        style={{ background: gradient }}
                      />
                      <span className="font-extrabold text-foreground/80 hover:underline cursor-pointer">
                        {formatAddress(comment.authorAddress)}
                      </span>
                      <span className="text-[8px] px-1 bg-secondary/50 rounded border border-border/30 text-muted-foreground uppercase">
                        Trader
                      </span>
                    </div>
                    <span className="text-muted-foreground/60">{timestampStr}</span>
                  </div>

                  {/* Comment Content */}
                  <p className="text-xs leading-relaxed font-mono text-foreground/90 pl-1 break-words">
                    {comment.content}
                  </p>

                  {/* Actions & Comment Emoji Row */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pl-1 border-t border-border/10 pt-2 text-[10px]">
                    <div className="flex items-center gap-2">
                      {AVAILABLE_EMOJIS.map((emoji) => {
                        const state = aggregatedReactions.commentWide[comment.id]?.[emoji] || { count: 0, active: false };
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleToggleReaction(emoji, comment.id)}
                            className={`px-2 py-0.5 rounded border text-[10px] font-mono flex items-center gap-1 transition-all ${
                              state.active
                                ? "bg-primary/10 border-primary/40 text-primary"
                                : "bg-card/25 border-border/20 hover:border-primary/30 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[9px] opacity-75">{state.count}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => {
                        if (activeReplyId === comment.id) {
                          setActiveReplyId(null);
                        } else {
                          setActiveReplyId(comment.id);
                          setReplyText((prev) => ({ ...prev, [comment.id]: "" }));
                        }
                      }}
                      className="text-[10px] font-mono text-primary/75 hover:text-primary hover:underline transition-colors uppercase font-bold shrink-0"
                    >
                      {activeReplyId === comment.id ? "Cancel reply" : "Reply"}
                    </button>
                  </div>

                  {/* Write Reply Drawer */}
                  {activeReplyId === comment.id && (
                    <div className="mt-3 pl-4 border-l border-primary/20 space-y-2 bg-secondary/5 p-3 rounded-lg">
                      <Input
                        value={replyText[comment.id] || ""}
                        onChange={(e) =>
                          setReplyText((prev) => ({ ...prev, [comment.id]: e.target.value }))
                        }
                        placeholder="Type reply to broadcast..."
                        className="h-8 font-mono text-xs bg-background/50 border-border/40 text-foreground"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => handlePostComment(comment.id)}
                          disabled={!connectedWalletAddress || !(replyText[comment.id] || "").trim()}
                          className="h-7 text-[10px] font-mono font-bold text-black uppercase shrink-0"
                        >
                          Broadcast Reply
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Reply Threads */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3.5 pl-5 border-l border-primary/10 space-y-3">
                      {comment.replies.map((reply) => {
                        const replyGradient = getAddressGradient(reply.authorAddress);
                        return (
                          <div key={reply.id} className="space-y-1.5">
                            <div className="flex items-center justify-between text-[9px] font-mono">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="h-4.5 w-4.5 rounded-full border border-border/30"
                                  style={{ background: replyGradient }}
                                />
                                <span className="font-extrabold text-foreground/75">
                                  {formatAddress(reply.authorAddress)}
                                </span>
                                <span className="text-[7px] px-1 bg-secondary/30 rounded border border-border/20 text-muted-foreground uppercase font-bold">
                                  Reply
                                </span>
                              </div>
                              <span className="text-muted-foreground/50">
                                {new Date(reply.timestamp).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            
                            <p className="text-[11px] leading-relaxed font-mono text-foreground/80 pl-1 break-words">
                              {reply.content}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// Simple loader helper
function Loader2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
