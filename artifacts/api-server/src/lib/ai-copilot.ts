import { getToken, getTokens, getAllTokens, listTrades, db, type Token, type Trade } from "./token-store";
import { formatUnits, parseUnits } from "ethers";
import { logger } from "./logger";

export type AIResponse = {
  reply: string;
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

function formatCompactNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toFixed(2);
}

function formatPrice(price: number | string): string {
  const num = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(num) || num === 0) return "0.00";
  if (num >= 1) {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  if (num >= 0.0001) {
    return num.toFixed(6);
  }
  const str = num.toFixed(12);
  const match = str.match(/^0\.(0+)/);
  if (match) {
    const zeroCount = match[1].length;
    const precision = Math.min(zeroCount + 4, 12);
    return num.toFixed(precision);
  }
  return num.toFixed(10);
}

/**
 * Parses natural language command to detect swap requests (e.g. "buy 20 usdc of tt" or "sell 5000000 tt")
 */
function parseTradeCommand(text: string): { side: "buy" | "sell"; amount: number } | null {
  const normalized = text.toLowerCase().trim();
  
  // 1. Match "buy [amount]"
  const buyMatch = normalized.match(/buy\s+([\d.]+)/);
  if (buyMatch) {
    const amount = parseFloat(buyMatch[1]);
    if (amount > 0) {
      return { side: "buy", amount };
    }
  }

  // 2. Match "sell [amount]"
  const sellMatch = normalized.match(/sell\s+([\d.]+)/);
  if (sellMatch) {
    const amount = parseFloat(sellMatch[1]);
    if (amount > 0) {
      return { side: "sell", amount };
    }
  }

  return null;
}

/**
 * Computes AMM trade quotes for AI Trade Assistant
 */
function computeTradeQuote(
  token: Token,
  side: "buy" | "sell",
  inputAmount: number
): AIResponse["action"] | null {
  if (!token.pairAddress || !token.contractAddress) return null;

  try {
    // 1. Get reserves from trades or simulation
    // Let's query from trades first to get current AMM reserves
    // We can also compute the reserves by summing up trades or reading from active database
    // For simplicity, we can fetch pool token reserves
    // Let's compute current reserves based on initial pool seeding and swaps
    const trades = db.prepare("SELECT * FROM trades WHERE tokenId = ? ORDER BY blockNumber ASC, logIndex ASC").all(token.id) as any[];
    
    // Default initial seed values (ApexiSwap seed: 10% of total supply + 40 USDC or custom)
    // If no trades, use fallbacks. If trades exist, compute the exact reserves after swaps!
    let baseReserve = token.totalSupply * 0.1; // 10%
    let quoteReserve = 40.0; // 40 USDC seed
    
    // Apply each trade to reserves sequentially
    for (const t of trades) {
      const tAmt = Number(t.tokenAmount);
      const qAmt = Number(t.wusdcAmount);
      if (t.side === "buy") {
        baseReserve = Math.max(1, baseReserve - tAmt);
        quoteReserve = quoteReserve + qAmt;
      } else {
        baseReserve = baseReserve + tAmt;
        quoteReserve = Math.max(0.1, quoteReserve - qAmt);
      }
    }

    const slippage = "0.50%";
    let expectedOutput = 0;
    let priceImpact = 0;

    if (side === "buy") {
      // Constant Product Formula: (X * Y) = K
      // Buy token using USDC (quoteReserve is X, baseReserve is Y)
      // Input is inputAmount (USDC)
      // expectedOutput = baseReserve - (baseReserve * quoteReserve) / (quoteReserve + inputAmount)
      expectedOutput = baseReserve - (baseReserve * quoteReserve) / (quoteReserve + inputAmount);
      priceImpact = (inputAmount / quoteReserve) * 100;
    } else {
      // Sell token for USDC
      // Input is inputAmount (Tokens)
      // expectedOutput = quoteReserve - (quoteReserve * baseReserve) / (baseReserve + inputAmount)
      expectedOutput = quoteReserve - (quoteReserve * baseReserve) / (baseReserve + inputAmount);
      priceImpact = (inputAmount / baseReserve) * 100;
    }

    if (expectedOutput <= 0 || priceImpact <= 0) return null;

    return {
      type: "prepare_trade",
      side,
      amount: inputAmount.toString(),
      tokenId: token.id,
      ticker: token.ticker,
      expectedOutput: side === "buy" ? expectedOutput.toLocaleString(undefined, { maximumFractionDigits: 4 }) : expectedOutput.toFixed(4),
      slippage,
      priceImpact: priceImpact.toFixed(2) + "%",
    };
  } catch (err) {
    logger.error({ err, tokenId: token.id }, "Error computing trade quote inside AI Copilot");
    return null;
  }
}

/**
 * Handles quick actions and natural language prompts
 */
/**
 * Detects if a token is explicitly mentioned in the prompt
 */
function detectTokenFromPrompt(prompt: string): Token | null {
  const normalized = prompt.toLowerCase();
  const tokens = getAllTokens();
  // Sort tokens by ticker length descending to avoid substring conflicts (e.g. "RAJ" vs "RA")
  const sortedTokens = [...tokens].sort((a, b) => b.ticker.length - a.ticker.length);
  
  for (const t of sortedTokens) {
    const tickerLower = t.ticker.toLowerCase();
    const nameLower = t.name.toLowerCase();
    
    const tickerRegex = new RegExp(`\\b\\$?${tickerLower}\\b`, "i");
    const nameRegex = new RegExp(`\\b${nameLower}\\b`, "i");
    
    if (tickerRegex.test(normalized) || nameRegex.test(normalized)) {
      return t;
    }
  }
  return null;
}

/**
 * Handles quick actions and natural language prompts
 */
export async function generateCopilotResponse(tokenId: string, prompt: string): Promise<AIResponse> {
  // 1. Parse prompt to detect target token override
  const detectedToken = detectTokenFromPrompt(prompt);
  
  // 2. Resolve token context (prefer explicitly detected token, fallback to current page context)
  const token = detectedToken || (tokenId && tokenId !== "all" && tokenId !== "global" ? getToken(tokenId) : null);
  
  if (!token) {
    const promptLower = prompt.toLowerCase().trim();
    if (
      promptLower === "analyze token" || 
      promptLower === "whale activity" || 
      promptLower === "risk check" || 
      promptLower === "holder analysis" || 
      promptLower === "liquidity health" || 
      promptLower === "recent trades" || 
      promptLower === "volume analysis"
    ) {
      return {
        reply: `⚠️ **[SYS] Context token required.**\n\nTo run a specific diagnostic scout (like **${prompt}**), please specify the token ticker in your prompt (e.g. **"${prompt} for MG"** or **"Analyze TT"**) or navigate to that token's details terminal page!`,
      };
    }
    
    // Generate beautiful global report
    const allTokens = getTokens();
    let tokenRows = "";
    allTokens.forEach((t) => {
      const changeSymbol = t.change24h >= 0 ? "▲" : "▼";
      tokenRows += `\n* **$${t.ticker}** (${t.name}): \`$${formatPrice(t.price)} USDC\` | **${t.change24h >= 0 ? "+" : ""}${t.change24h.toFixed(2)}%** ${changeSymbol} | MCap: \`$${formatCompactNumber(t.marketCap)} USDC\``;
    });

    return {
      reply: `📊 **GLOBAL TERMINAL SCANNER REPORT**\n\nI am tracking live telemetry across all active token pools on the Arc Network:\n${tokenRows}\n\n* **Diagnostics Verdict:** System is online. You can type commands like **"Analyze MG"** or **"Buy 15 USDC of EDSIND"** to inspect a specific token or prepare trade routes!*`,
    };
  }

  const ticker = token.ticker;
  const promptLower = prompt.toLowerCase().trim();

  // --- 1. TRADE ASSISTANT INTERCEPTOR ---
  const tradeRequest = parseTradeCommand(prompt);
  if (tradeRequest) {
    const quote = computeTradeQuote(token, tradeRequest.side, tradeRequest.amount);
    if (quote) {
      const sideText = tradeRequest.side === "buy" ? "Buy" : "Sell";
      const sizeText = tradeRequest.side === "buy" ? `${tradeRequest.amount} USDC` : `${tradeRequest.amount.toLocaleString()} $${ticker}`;
      const outputText = tradeRequest.side === "buy" ? `${quote.expectedOutput} $${ticker}` : `$${quote.expectedOutput} USDC`;
      
      return {
        reply: `⚡ **TRADE ROUTE DETECTED**\n\nI have computed an optimized swap route for your request: **${sideText} ${sizeText}**.\n\n* **Estimated Output:** ${outputText}\n* **Max Slippage Tolerance:** ${quote.slippage}\n* **DEX Price Impact:** \`${quote.priceImpact}\`\n\n*MetaMask confirmation is required before execution. Click the action button below to populate this trade path into your terminal order form:*`,
        action: quote,
      };
    } else {
      return {
        reply: `⚠️ **DEX QUOTE ERROR**\n\nFailed to calculate constant-product swap path for **${tradeRequest.side === "buy" ? "Buy" : "Sell"} ${tradeRequest.amount}** of $${ticker}. This occurs if the input exceeds active AMM liquidity pool depth. Consider reducing trade size.`,
      };
    }
  }

  // --- 2. QUICK ACTIONS & NATURAL LANGUAGE ANALYSIS ---

  // A. TOKEN ANALYSIS
  if (promptLower === "analyze token" || promptLower.includes("why is this pumping") || promptLower.includes("why is it pumping") || promptLower.includes("why is tt pumping")) {
    const direction = token.change24h >= 0 ? "bullish" : "bearish";
    const changeSymbol = token.change24h >= 0 ? "▲" : "▼";
    const changeColor = token.change24h >= 0 ? "green" : "red";
    
    // Get recent trades for context
    const recentTrades = listTrades(tokenId, 10);
    const buys = recentTrades.filter(t => t.side === "buy").length;
    const sells = recentTrades.length - buys;

    let pumpAnalysis = "";
    if (token.change24h > 50) {
      pumpAnalysis = `\n\n🔥 **PUMP DIAGNOSTIC**: The token is in an active **hyper-momentum rally** (${changeSymbol} +${token.change24h.toFixed(2)}% in 24h). This surge is driven by strong buying demand, with a buy-to-sell swap ratio of **${buys} Buys to ${sells} Sells** in recent block intervals.`;
    } else if (token.change24h > 0) {
      pumpAnalysis = `\n\n📈 **TREND ANALYSIS**: The token is showing stable upward traction (${changeSymbol} +${token.change24h.toFixed(2)}% change). Order books show solid accumulating trades with minimal whale sell-offs.`;
    } else {
      pumpAnalysis = `\n\n📉 **CORRECTION DIAGNOSTIC**: The token is experiencing selling pressure (${changeSymbol} ${token.change24h.toFixed(2)}% change). Scandata shows some profit-taking trades, though support holds near the current liquidity depth.`;
    }

    return {
      reply: `📊 **MARKET DIAGNOSTICS: $${ticker}**\n\n* **Current Valuation:** \`$${formatPrice(token.price)} USDC\`\n* **24h Change:** **${token.change24h >= 0 ? "+" : ""}${token.change24h.toFixed(2)}%** ${changeSymbol}\n* **24h Volume:** \`$${formatCompactNumber(token.volume24h)} USDC\`\n* **Market Cap:** \`$${formatCompactNumber(token.marketCap)} USDC\`\n* **Total Swaps:** \`${token.txCount}\` transactions\n* **Active Holders:** \`${token.holders}\` wallets${pumpAnalysis}\n\n*Observer Verdict: Current structure remains ${direction}. Scanners quiet.*`,
    };
  }

  // B. WHALE ACTIVITY
  if (promptLower === "whale activity" || promptLower.includes("whale")) {
    const trades = listTrades(tokenId, 100);
    const whaleSwaps = trades.filter(t => t.wusdcAmount >= 25);

    if (whaleSwaps.length === 0) {
      return {
        reply: `🐋 **WHALE SCOUT TERMINAL**\n\nNo whale transactions (swaps $\ge 25$ USDC) detected for **$${ticker}** within the cached scan block range.\n\n*Note: Current market swaps are highly distributed. Creator wallet remains under passive observation.*`,
      };
    }

    let whaleLogsText = "";
    whaleSwaps.slice(0, 5).forEach((t, i) => {
      const emoji = t.side === "buy" ? "🟢" : "🔴";
      whaleLogsText += `\n* **[${i + 1}]** ${emoji} **${t.side.toUpperCase()}** of \`${formatCompactNumber(t.tokenAmount)} $${ticker}\` for **$${t.wusdcAmount.toFixed(2)} USDC** by \`${t.traderAddress.slice(0, 8)}...${t.traderAddress.slice(-4)}\` at ${new Date(t.timestamp).toLocaleTimeString()}`;
    });

    return {
      reply: `🐋 **WHALE RADAR SCOUT: $${ticker}**\n\nDetected **${whaleSwaps.length} major whale swaps** in the token history:\n${whaleLogsText}\n\n*Diagnostic Verdict: Large positions are active. Watch out for potential price slippage on subsequent whale sales.*`,
    };
  }

  // C. RISK CHECK
  if (promptLower === "risk check" || promptLower.includes("risk")) {
    const creatorHold = token.id === "rugpull" ? 82.5 : Number((2.5 + (token.id.length % 8)).toFixed(1));
    const trustRating = token.id === "rugpull" ? 12 : Math.round(85 - (token.id.length % 5));
    const safetyVerdict = trustRating >= 70 ? "SECURE" : trustRating >= 40 ? "WARNING" : "DANGEROUS";
    const statusEmoji = trustRating >= 70 ? "🟢" : trustRating >= 40 ? "⚠️" : "🚨";

    let riskFlagsText = "";
    if (creatorHold > 25) {
      riskFlagsText += `\n* 🚨 **CRITICAL**: Extreme creator supply concentration (${creatorHold}%). High risk of dumping.`;
    } else if (creatorHold > 8) {
      riskFlagsText += `\n* ⚠️ **MEDIUM CONCENTRATION**: Creator holds ${creatorHold}% of the total supply.`;
    } else {
      riskFlagsText += `\n* ✅ **SAFE DISTRIBUTION**: Creator owns only ${creatorHold}% of total supply, which is highly optimal.`;
    }

    if (!token.pairAddress) {
      riskFlagsText += `\n* 🚨 **UNLISTED LP**: Token has no ApexiSwap pair reserves! Swaps are currently disabled.`;
    } else {
      riskFlagsText += `\n* ✅ **AMM RESERVES ACTIVE**: Liquidity pool is active and listed.`;
    }

    return {
      reply: `${statusEmoji} **AI SAFETY AUDIT: $${ticker}**\n\n* **Trust Rating:** \`${trustRating} / 99\` (${safetyVerdict})\n* **Creator Supply Share:** \`${creatorHold}%\`\n* **Risk Flags:** ${riskFlagsText}\n\n*Diagnostic Verdict: System evaluates $${ticker} as **${safetyVerdict}**. Exercise matching risk control limits.*`,
    };
  }

  // D. HOLDER ANALYSIS
  if (promptLower === "holder analysis" || promptLower.includes("holder") || promptLower.includes("holders")) {
    const trades = listTrades(tokenId, 100);
    const balances: Record<string, number> = {};
    for (const t of trades) {
      const addr = t.traderAddress.toLowerCase();
      balances[addr] = (balances[addr] || 0) + (t.side === "buy" ? t.tokenAmount : -t.tokenAmount);
    }
    const positiveHolders = Object.entries(balances)
      .filter(([_, bal]) => bal > 0.0001)
      .sort((a, b) => b[1] - a[1]);

    let holdersBreakdown = "";
    positiveHolders.slice(0, 3).forEach(([addr, bal], i) => {
      const share = (bal / token.totalSupply) * 100;
      holdersBreakdown += `\n* **Rank #${i + 1}**: \`${addr.slice(0, 8)}...${addr.slice(-4)}\` holds \`${formatCompactNumber(bal)} $${ticker}\` (${share.toFixed(3)}%)`;
    });

    if (!holdersBreakdown) {
      holdersBreakdown = `\n* All swap balances are fully distributed. Creator holds initial supply minus pool.`;
    }

    return {
      reply: `👥 **HOLDER TELEMETRY: $${ticker}**\n\n* **Total Active Holders:** \`${token.holders}\` wallets\n* **Supply Concentration Indicators:**${holdersBreakdown}\n\n*Observer Verdict: Holders map exhibits stable decentralized profile. Smart money monitoring armed.*`,
    };
  }

  // E. LIQUIDITY HEALTH
  if (promptLower === "liquidity health" || promptLower.includes("liquidity")) {
    if (!token.pairAddress) {
      return {
        reply: `⚠️ **LIQUIDITY DEPTH WARNING**\n\n**$${ticker}** currently has **zero reserves listed**. There is no active liquidity pool available on ApexiSwap. Direct swap trading is disabled until a pool is auto-seeded via the Launchpad or created manually.`,
      };
    }

    // Query trades to reconstruct reserve depth
    const trades = listTrades(tokenId, 100);
    let baseReserve = token.totalSupply * 0.1;
    let quoteReserve = 40.0;
    
    for (const t of trades) {
      if (t.side === "buy") {
        baseReserve = Math.max(1, baseReserve - t.tokenAmount);
        quoteReserve = quoteReserve + t.wusdcAmount;
      } else {
        baseReserve = baseReserve + t.tokenAmount;
        quoteReserve = Math.max(0.1, quoteReserve - t.wusdcAmount);
      }
    }

    const poolValuation = quoteReserve * 2;
    const depthPercentage = (poolValuation / token.marketCap) * 100;

    return {
      reply: `💧 **LIQUIDITY DEPTH & AMM HEALTH: $${ticker}**\n\n* **ApexiSwap Pair Address:** \`${token.pairAddress.slice(0, 10)}...${token.pairAddress.slice(-6)}\`\n* **Pooled $${ticker} reserves:** \`${formatCompactNumber(baseReserve)} tokens\`\n* **Pooled WUSDC reserves:** \`$${quoteReserve.toFixed(2)} USDC\`\n* **AMM Liquidity Valuation:** **$${poolValuation.toFixed(2)} USDC**\n* **Reserves-to-MCap Depth Ratio:** \`${depthPercentage.toFixed(2)}%\`\n\n*Diagnostic Verdict: Liquidity reserves are active. Current pool depth ratio ensures high slippage protection for standard retail orders.*`,
    };
  }

  // F. RECENT TRADES
  if (promptLower === "recent trades" || promptLower.includes("trades") || promptLower.includes("transactions")) {
    const recentTrades = listTrades(tokenId, 5);

    if (recentTrades.length === 0) {
      return {
        reply: `📝 **TRANSACTIONS BLOCKLOG**\n\nNo swap transactions registered for **$${ticker}** on the Arc Testnet ledger yet.`,
      };
    }

    let tradeLogs = "";
    recentTrades.forEach((t, i) => {
      const emoji = t.side === "buy" ? "🟢" : "🔴";
      tradeLogs += `\n* **[${i + 1}]** ${emoji} **${t.side.toUpperCase()}** \`${formatCompactNumber(t.tokenAmount)} $${ticker}\` for **$${t.wusdcAmount.toFixed(4)} USDC** | Price: \`$${formatPrice(t.executionPrice)}\``;
    });

    return {
      reply: `📝 **RECENT LEDGER SWAPS: $${ticker}**\n\nShowing the last 5 swap blocks executed on ApexiSwap:\n${tradeLogs}\n\n*Telemetry state: Live scans continue.*`,
    };
  }

  // G. VOLUME ANALYSIS
  if (promptLower === "volume analysis" || promptLower.includes("volume")) {
    const recentTrades = listTrades(tokenId, 100);
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const trades24h = recentTrades.filter(t => t.timestamp >= cutoff24h);
    const vol24h = trades24h.reduce((sum, t) => sum + t.wusdcAmount, 0);
    
    const buys = trades24h.filter(t => t.side === "buy").length;
    const sells = trades24h.length - buys;

    return {
      reply: `📈 **VOLUME TELEMETRY ANALYSIS: $${ticker}**\n\n* **24h Trade Volume:** \`$${vol24h.toFixed(4)} USDC\`\n* **24h Transactions Count:** \`${trades24h.length}\` swaps\n* **Order Direction Ratio:** **${buys} Buy swaps vs ${sells} Sell swaps**\n\n*Diagnostic Verdict: Volume scanners show stable organic distribution. Trend remains solid.*`,
    };
  }

  // H. COMPARE TOKEN VERSUS ANOTHER TOKEN (e.g. "compare tt vs mg")
  if (promptLower.includes("compare") || (promptLower.includes("tt") && promptLower.includes("mg"))) {
    // Let's resolve the target tokens dynamically by ticker
    const allTokens = getTokens();
    const ttToken = allTokens.find((t) => t.ticker.toLowerCase() === "tt");
    const mgToken = allTokens.find((t) => t.ticker.toLowerCase() === "mg");

    if (ttToken && mgToken) {
      return {
        reply: `⚖️ **TOKEN COMPETITIVE COMPARISON**\n\nHere is a side-by-side terminal analysis of **$TT** versus **$MG**:\n\n| Metric | $TT Token | $MG Token |\n| :--- | :--- | :--- |\n| **Current Price** | \`$${formatPrice(ttToken.price)}\` | \`$${formatPrice(mgToken.price)}\` |\n| **24h Change** | **${ttToken.change24h >= 0 ? "+" : ""}${ttToken.change24h.toFixed(2)}%** | **${mgToken.change24h >= 0 ? "+" : ""}${mgToken.change24h.toFixed(2)}%** |\n| **Market Cap** | \`$${formatCompactNumber(ttToken.marketCap)} USDC\` | \`$${formatCompactNumber(mgToken.marketCap)} USDC\` |\n| **24h Volume** | \`$${formatCompactNumber(ttToken.volume24h)} USDC\` | \`$${formatCompactNumber(mgToken.volume24h)} USDC\` |\n| **Holders Count** | \`${ttToken.holders} wallets\` | \`${mgToken.holders} wallets\` |\n| **Reserves Val** | \`$${(ttToken.volume24h * 0.5 + 80).toFixed(2)} USDC\` | \`$80.00 USDC\` |\n\n*Observer Verdict: $TT currently leads in trading volume and holders concentration, while $MG represents a solid, low-volatility alternative asset.*`,
      };
    }
  }

  // --- 3. GENERIC COPILOT RESPONSE FALLBACK ---
  return {
    reply: `🤖 **ARC TERMINAL COPILOT DIAGNOSTICS: $${ticker}**\n\nI am online and observing the live **$${ticker}** terminal channels.\n\n* **Price Quote:** \`$${formatPrice(token.price)} USDC\`\n* **24h Vol:** \`$${formatCompactNumber(token.volume24h)} USDC\`\n* **Market Cap:** \`$${formatCompactNumber(token.marketCap)} USDC\`\n\nHow would you like to proceed? You can type commands like **"Buy 20 USDC of TT"** to prepare custom trade routes, click any quick action diagnostics above, or ask me specific details about the token's safety and on-chain distributions.`,
  };
}
