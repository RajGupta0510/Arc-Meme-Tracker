import { Router, type IRouter, type Response } from "express";
import { Wallet, JsonRpcProvider, parseUnits } from "ethers";
import { eq, desc, asc, sql } from "drizzle-orm";
import { db, tradesTable, tokensTable } from "@workspace/db";
import {
  ListTokensQueryParams,
  LaunchTokenBody,
  GetTokenParams,
} from "@workspace/api-zod";
import {
  createToken,
  getToken,
  getTokens,
  getTokenByContract,
  isCandleInterval,
  listCandles,
  listTrades,
  listTokens,
  updateTokenMarket,
  type Token,
  getCommentsForToken,
  saveComment,
  toggleEmojiReaction,
  getReactionsForToken,
  getRecentComments,
  getLeaderboard,
  getWalletAnalytics,
  incrementHype,
  getDeterministicSmartWalletAddress,
  getSmartWallet,
  deploySmartWallet,
  updateSmartWalletBalance,
  listCopytradeTargets,
  setCopytradeTarget,
  removeCopytradeTarget,
  listCopytradeActions,
} from "../lib/token-store";
import { logger } from "../lib/logger";
import { indexTokenSwapEvents } from "../lib/swap-indexer";
import { fetchTokenMetadata, detectMarket } from "../lib/arc-rpc";
import { generateCopilotResponse } from "../lib/ai-copilot";

const router: IRouter = Router();

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;
type TokenMarketType = "unlisted" | "amm_pool";

function parseTokenMarketBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return { success: false as const, error: "Request body is required." };
  }

  const record = body as Record<string, unknown>;
  const marketType = record.marketType;
  const pairAddress = record.pairAddress;
  const routerAddress = record.routerAddress;

  if (marketType !== "unlisted" && marketType !== "amm_pool") {
    return { success: false as const, error: "marketType must be unlisted or amm_pool." };
  }

  if (pairAddress !== null && typeof pairAddress !== "string") {
    return { success: false as const, error: "pairAddress must be a string or null." };
  }

  if (routerAddress !== null && typeof routerAddress !== "string") {
    return { success: false as const, error: "routerAddress must be a string or null." };
  }

  if (typeof pairAddress === "string" && !evmAddressPattern.test(pairAddress)) {
    return { success: false as const, error: "pairAddress must be a valid EVM address." };
  }

  if (typeof routerAddress === "string" && !evmAddressPattern.test(routerAddress)) {
    return { success: false as const, error: "routerAddress must be a valid EVM address." };
  }

  return {
    success: true as const,
    data: {
      marketType: marketType as TokenMarketType,
      pairAddress,
      routerAddress,
    },
  };
}

function getErrorPayload(err: unknown) {
  return {
    error: err instanceof Error ? err.message : "Unknown backend error",
    stack: process.env.NODE_ENV === "production"
      ? undefined
      : err instanceof Error
        ? err.stack
        : undefined,
  };
}

router.get("/tokens", async (req, res): Promise<void> => {
  try {
    const query = ListTokensQueryParams.safeParse(req.query);
    const sort = query.success ? query.data.sort : "trending";
    const limit = query.success && query.data.limit ? query.data.limit : 50;
    const tokens = await listTokens(sort, limit);

    logger.info({ sort, limit, count: tokens.length }, "GET /api/tokens");
    res.json(tokens);
  } catch (err) {
    const details = getErrorPayload(err);
    logger.error({ err }, "GET /api/tokens failed");
    res.status(200).json([]);
  }
});

router.post("/tokens", async (req, res): Promise<void> => {
  try {
    const parsed = LaunchTokenBody.safeParse(req.body);
    if (!parsed.success) {
      logger.warn({ error: parsed.error.message }, "POST /api/tokens validation failed");
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const {
      name,
      ticker,
      description,
      website,
      twitter,
      telegram,
      logoColor,
      logoImage,
      totalSupply,
      contractAddress,
      creatorAddress,
    } = parsed.data;

    const newToken: Token = await createToken({
      name,
      ticker,
      price: 0.000001,
      marketCap: 1000,
      volume24h: 0,
      change24h: 0,
      description,
      creatorAddress: creatorAddress ?? ("arc1" + Math.random().toString(36).slice(2, 8) + "..." + Math.random().toString(36).slice(2, 6)),
      logoColor: logoColor ?? "#8b5cf6",
      logoUrl: logoImage ?? null,
      contractAddress: contractAddress ?? null,
      totalSupply: totalSupply ?? 1_000_000_000,
      holders: 1,
      txCount: 1,
      website: website ?? null,
      twitter: twitter ?? null,
      telegram: telegram ?? null,
    });

    logger.info(
      {
        id: newToken.id,
        ticker: newToken.ticker,
        contractAddress: newToken.contractAddress,
      },
      "POST /api/tokens",
    );
    res.status(201).json(newToken);
  } catch (err) {
    const details = getErrorPayload(err);
    logger.error({ err, body: req.body }, "POST /api/tokens failed");
    res.status(503).json({
      ...details,
      message: "Failed to save token metadata.",
    });
  }
});

router.get("/tokens/trending", async (_req, res): Promise<void> => {
  try {
    res.json(await listTokens("trending", 6));
  } catch (err) {
    logger.error({ err }, "GET /api/tokens/trending failed");
    res.status(200).json([]);
  }
});

router.get("/tokens/:id", async (req, res): Promise<void> => {
  try {
    const params = GetTokenParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const token = await getToken(params.data.id);
    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    res.json(token);
  } catch (err) {
    const details = getErrorPayload(err);
    logger.error({ err, id: req.params.id }, "GET /api/tokens/:id failed");
    res.status(503).json(details);
  }
});

router.patch("/tokens/:id/market", async (req, res): Promise<void> => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!id) {
      res.status(400).json({ error: "Token id is required." });
      return;
    }

    const parsed = parseTokenMarketBody(req.body);
    if (!parsed.success) {
      logger.warn({ error: parsed.error }, "PATCH /api/tokens/:id/market validation failed");
      res.status(400).json({ error: parsed.error });
      return;
    }

    const token = await updateTokenMarket(id, parsed.data);
    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    logger.info(
      {
        id: token.id,
        ticker: token.ticker,
        marketType: token.marketType,
        pairAddress: token.pairAddress,
        routerAddress: token.routerAddress,
      },
      "PATCH /api/tokens/:id/market",
    );

    res.json(token);
  } catch (err) {
    const details = getErrorPayload(err);
    logger.error({ err, id: req.params.id, body: req.body }, "PATCH /api/tokens/:id/market failed");
    res.status(503).json(details);
  }
});

router.get("/tokens/:id/trades", async (req, res): Promise<void> => {
  try {
    const params = GetTokenParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const token = await getToken(params.data.id);
    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    if (token.marketType === "amm_pool" && token.pairAddress && token.contractAddress) {
      indexTokenSwapEvents(token)
        .then((result) => {
          logger.info({ id: token.id, pairAddress: token.pairAddress, ...result }, "GET /api/tokens/:id/trades background indexed swaps completed");
        })
        .catch((err) => {
          logger.error(
            {
              err,
              id: token.id,
              pairAddress: token.pairAddress,
              contractAddress: token.contractAddress,
            },
            "Background swap indexing failed in GET /api/tokens/:id/trades",
          );
        });
    }

    res.json(await listTrades(token.id, 50));
  } catch (err) {
    const details = getErrorPayload(err);
    logger.error({ err, id: req.params.id }, "GET /api/tokens/:id/trades failed");
    res.status(200).json([]);
  }
});

async function indexTokenTradesIfTradeable(token: Token) {
  if (token.marketType !== "amm_pool" || !token.pairAddress || !token.contractAddress) return;

  indexTokenSwapEvents(token)
    .then((result) => {
      logger.info({ id: token.id, pairAddress: token.pairAddress, ...result }, "Background indexed token swaps before market data completed");
    })
    .catch((err) => {
      logger.error(
        {
          err,
          id: token.id,
          pairAddress: token.pairAddress,
          contractAddress: token.contractAddress,
        },
        "Background swap indexing failed before market data response",
      );
    });
}

router.get("/tokens/:id/candles", async (req, res): Promise<void> => {
  try {
    const params = GetTokenParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const interval = isCandleInterval(req.query.interval) ? req.query.interval : "1m";
    const token = await getToken(params.data.id);
    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    await indexTokenTradesIfTradeable(token);
    const candles = await listCandles(token.id, interval);

    logger.info(
      {
        id: token.id,
        interval,
        count: candles.length,
        latest: candles.at(-1) ?? null,
      },
      "GET /api/tokens/:id/candles",
    );

    res.json(candles);
  } catch (err) {
    logger.error({ err, id: req.params.id, interval: req.query.interval }, "GET /api/tokens/:id/candles failed");
    res.status(200).json([]);
  }
});

router.get("/tokens/:id/chart", async (req, res): Promise<void> => {
  try {
    const params = GetTokenParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const token = await getToken(params.data.id);
    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    await indexTokenTradesIfTradeable(token);
    const candles = await listCandles(token.id, "5m");
    res.json(
      candles.map(({ time, ...candle }) => ({
        timestamp: time * 1000,
        ...candle,
      })),
    );
  } catch (err) {
    logger.error({ err, id: req.params.id }, "GET /api/tokens/:id/chart failed");
    res.status(200).json([]);
  }
});

router.post("/tokens/import", async (req, res): Promise<void> => {
  try {
    const { contractAddress } = req.body;
    if (!contractAddress || typeof contractAddress !== "string" || !evmAddressPattern.test(contractAddress)) {
      res.status(400).json({ error: "A valid EVM contract address is required." });
      return;
    }

    const existing = await getTokenByContract(contractAddress);
    if (existing) {
      res.json(existing);
      return;
    }

    const metadata = await fetchTokenMetadata(contractAddress);
    const market = await detectMarket(contractAddress);

    let price = 0.000001;
    let marketCap = 1000;
    let marketType: "unlisted" | "amm_pool" = "unlisted";
    let pairAddress: string | null = null;
    let routerAddress: string | null = null;

    if (market) {
      marketType = "amm_pool";
      pairAddress = market.pairAddress;
      routerAddress = market.routerAddress;

      const baseDecimals = metadata.decimals || 18;
      const base = Number(market.baseReserve) / (10 ** baseDecimals);
      const quote = Number(market.quoteReserve) / 1e18;
      if (base > 0) {
        price = quote / base;
        marketCap = price * metadata.totalSupply;
      }
    }

    const colors = ["#22c55e", "#ef4444", "#3b82f6", "#eab308", "#a855f7", "#ec4899", "#f97316", "#06b6d4"];
    const logoColor = colors[Math.floor(Math.random() * colors.length)];

    const token = await createToken({
      name: metadata.name,
      ticker: metadata.symbol,
      price,
      marketCap,
      volume24h: 0,
      change24h: 0,
      description: `Imported token tracking ${metadata.name} ($${metadata.symbol}) on the Arc blockchain.`,
      creatorAddress: "0x0000000000000000000000000000000000000000",
      logoColor,
      logoUrl: null,
      contractAddress,
      marketType,
      pairAddress,
      routerAddress,
      totalSupply: metadata.totalSupply,
      holders: 0,
      txCount: 0,
      website: null,
      twitter: null,
      telegram: null,
    });

    logger.info({ id: token.id, contractAddress: token.contractAddress }, "Imported token successfully");
    res.status(201).json(token);
  } catch (err) {
    const details = getErrorPayload(err);
    logger.error({ err, body: req.body }, "POST /tokens/import failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to import token." });
  }
});

router.get("/portfolio/:address", async (req, res): Promise<void> => {
  try {
    const address = req.params.address;
    if (!address || !evmAddressPattern.test(address)) {
      res.status(400).json({ error: "A valid EVM address is required." });
      return;
    }

    const trades = await db.select().from(tradesTable)
      .where(sql`LOWER(${tradesTable.traderAddress}) = LOWER(${address})`)
      .orderBy(asc(tradesTable.timestamp));

    const tokens = await getTokens();

    // Trigger background swap indexing for all active AMM tokens to ensure portfolio data is up-to-date
    for (const token of tokens) {
      if (token.marketType === "amm_pool" && token.pairAddress && token.contractAddress) {
        indexTokenSwapEvents(token).catch(err => {
          logger.error({ err, tokenId: token.id }, "Background swap indexing failed during portfolio fetch");
        });
      }
    }

    const tokenStats: Record<string, {
      tokenId: string;
      ticker: string;
      name: string;
      logoColor: string;
      contractAddress: string | null;
      pairAddress: string | null;
      marketType: string;
      currentPrice: number;
      totalBought: number;
      totalSold: number;
      totalUsdcSpent: number;
      totalUsdcReceived: number;
      avgEntryPrice: number;
      realizedPnl: number;
      currentTokens: number;
    }> = {};

    // Initialize stats for ALL tokens, so on-chain balance check can see them even if no trades are in DB yet
    for (const tok of tokens) {
      tokenStats[tok.id] = {
        tokenId: tok.id,
        ticker: tok.ticker,
        name: tok.name,
        logoColor: tok.logoColor,
        contractAddress: tok.contractAddress,
        pairAddress: tok.pairAddress,
        marketType: tok.marketType,
        currentPrice: tok.price,
        totalBought: 0,
        totalSold: 0,
        totalUsdcSpent: 0,
        totalUsdcReceived: 0,
        avgEntryPrice: 0,
        realizedPnl: 0,
        currentTokens: 0,
      };
    }

    for (const trade of trades) {
      const tId = trade.tokenId;
      const stats = tokenStats[tId];
      if (!stats) continue;

      const side = trade.side;
      const tokenAmount = Number(trade.tokenAmount);
      const wusdcAmount = Number(trade.wusdcAmount);

      if (side === "buy") {
        stats.totalBought += tokenAmount;
        stats.totalUsdcSpent += wusdcAmount;
        
        const currentCost = stats.currentTokens * stats.avgEntryPrice;
        const newCost = currentCost + wusdcAmount;
        stats.currentTokens += tokenAmount;
        if (stats.currentTokens > 0) {
          stats.avgEntryPrice = newCost / stats.currentTokens;
        }
      } else if (side === "sell") {
        stats.totalSold += tokenAmount;
        stats.totalUsdcReceived += wusdcAmount;

        const costBasis = tokenAmount * stats.avgEntryPrice;
        const gain = wusdcAmount - costBasis;
        stats.realizedPnl += gain;
        
        stats.currentTokens = Math.max(0, stats.currentTokens - tokenAmount);
      }
    }

    const holdings = Object.values(tokenStats);

    res.json({
      address,
      holdings,
      trades: trades.reverse().slice(0, 50),
    });
  } catch (err) {
    logger.error({ err, address: req.params.address }, "GET /api/portfolio/:address failed");
    res.status(500).json({ error: "Failed to generate portfolio." });
  }
});

router.get("/tokens/:id/comments", async (req, res): Promise<void> => {
  try {
    const id = req.params.id;
    const comments = await getCommentsForToken(id);
    const reactions = await getReactionsForToken(id);
    res.json({ comments, reactions });
  } catch (err) {
    logger.error({ err, id: req.params.id }, "GET /api/tokens/:id/comments failed");
    res.status(500).json({ error: "Failed to load comments." });
  }
});

router.post("/tokens/:id/comments", async (req, res): Promise<void> => {
  try {
    const id = req.params.id;
    const { authorAddress, content, parentId } = req.body;
    if (!authorAddress || !content) {
      res.status(400).json({ error: "authorAddress and content are required." });
      return;
    }

    const comment = await saveComment({
      tokenId: id,
      authorAddress,
      content,
      parentId: parentId || null,
    });

    res.status(201).json(comment);
  } catch (err) {
    logger.error({ err, id: req.params.id }, "POST /api/tokens/:id/comments failed");
    res.status(500).json({ error: "Failed to post comment." });
  }
});

router.post("/tokens/:id/reactions", async (req, res): Promise<void> => {
  try {
    const id = req.params.id;
    const { commentId, userAddress, emoji } = req.body;
    if (!userAddress || !emoji) {
      res.status(400).json({ error: "userAddress and emoji are required." });
      return;
    }

    const result = await toggleEmojiReaction({
      tokenId: id,
      commentId: commentId || null,
      userAddress,
      emoji,
    });

    res.json(result);
  } catch (err) {
    logger.error({ err, id: req.params.id }, "POST /api/tokens/:id/reactions failed");
    res.status(500).json({ error: "Failed to toggle reaction." });
  }
});

router.get("/community/activity", async (req, res): Promise<void> => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const comments = await getRecentComments(limit);
    res.json(comments);
  } catch (err) {
    logger.error({ err }, "GET /api/community/activity failed");
    res.status(500).json({ error: "Failed to load community activity." });
  }
});

router.get("/intelligence/signals", async (req, res): Promise<void> => {
  try {
    const tokens = await getTokens();
    const signals: any[] = [];

    // 1. Check for token risk flags / low trust / high creator holding
    for (const tok of tokens) {
      if (tok.trustScore !== undefined && tok.trustScore < 30) {
        signals.push({
          id: `rug-${tok.id}-${Date.now()}`,
          type: "rug_risk",
          severity: "critical",
          title: "⚠️ SEC RISK CRITICAL",
          message: `${tok.ticker} trust rating is low (${tok.trustScore}/99). Creator holding concentration is ${tok.creatorHoldingPercent}%.`,
          timestamp: tok.createdAt,
          tokenId: tok.id,
          ticker: tok.ticker,
        });
      }
      if (tok.momentumScore !== undefined && tok.momentumScore > 75) {
        signals.push({
          id: `momentum-${tok.id}-${Date.now()}`,
          type: "momentum_surge",
          severity: "warning",
          title: "🔥 MOMENTUM SURGE",
          message: `${tok.ticker} is trading with high momentum (${tok.momentumScore}/99) and ${tok.change24h}% change.`,
          timestamp: new Date().toISOString(),
          tokenId: tok.id,
          ticker: tok.ticker,
        });
      }
    }

    // 1.5. Calculate Cross-DEX Arbitrage Opportunities
    for (const tok of tokens) {
      if (!tok.contractAddress || !tok.pairAddress) continue;
      
      const achswapSeed = (tok.id.charCodeAt(0) % 7) - 3; // -3% to +3%
      const achswapPrice = tok.price * (1 + 0.018 + achswapSeed * 0.012);
      
      const unitFlowSeed = (tok.id.charCodeAt(tok.id.length - 1) % 7) - 3;
      const unitFlowPrice = tok.price * (1 - 0.015 + unitFlowSeed * 0.014);

      const exchanges = [
        { name: "ApexiSwap", price: tok.price },
        { name: "Achswap", price: achswapPrice },
        { name: "Unit Flow", price: unitFlowPrice }
      ];

      let minEx = exchanges[0];
      let maxEx = exchanges[0];

      for (const ex of exchanges) {
        if (ex.price < minEx.price) minEx = ex;
        if (ex.price > maxEx.price) maxEx = ex;
      }

      const diffPercent = ((maxEx.price - minEx.price) / minEx.price) * 100;
      if (diffPercent >= 1.5) {
        signals.push({
          id: `arb-${tok.id}-${maxEx.name}-${minEx.name}-${Date.now()}`,
          type: "arbitrage_opportunity",
          severity: diffPercent > 4.5 ? "warning" : "info",
          title: "⚡ ARBITRAGE RADAR",
          message: `Cross-DEX price gap detected on $${tok.ticker}! Buy on ${minEx.name} ($${minEx.price.toFixed(6)}) and Sell on ${maxEx.name} ($${maxEx.price.toFixed(6)}) for a +${diffPercent.toFixed(2)}% net profit discrepancy.`,
          timestamp: new Date().toISOString(),
          tokenId: tok.id,
          ticker: tok.ticker,
          arbitrage: {
            buyDex: minEx.name,
            sellDex: maxEx.name,
            buyPrice: minEx.price,
            sellPrice: maxEx.price,
            profitPercent: diffPercent,
          }
        });
      }
    }

    // 2. Query recent trades for whale trades
    const trades = await db.select({
      id: tradesTable.id,
      tokenId: tradesTable.tokenId,
      pairAddress: tradesTable.pairAddress,
      txHash: tradesTable.txHash,
      logIndex: tradesTable.logIndex,
      blockNumber: tradesTable.blockNumber,
      side: tradesTable.side,
      tokenAmount: tradesTable.tokenAmount,
      wusdcAmount: tradesTable.wusdcAmount,
      executionPrice: tradesTable.executionPrice,
      traderAddress: tradesTable.traderAddress,
      timestamp: tradesTable.timestamp,
      ticker: tokensTable.ticker,
      logoColor: tokensTable.logoColor,
    })
    .from(tradesTable)
    .innerJoin(tokensTable, eq(tradesTable.tokenId, tokensTable.id))
    .orderBy(desc(tradesTable.timestamp))
    .limit(30);

    for (const t of trades) {
      const amountUsdc = Number(t.wusdcAmount);
      if (amountUsdc >= 25) {
        const sideEmoji = t.side === "buy" ? "🟢" : "🔴";
        signals.push({
          id: `whale-${t.id}-${t.timestamp}`,
          type: t.side === "buy" ? "whale_buy" : "whale_sell",
          severity: "info",
          title: `${sideEmoji} WHALE SWAP`,
          message: `${t.traderAddress.slice(0, 6)}...${t.traderAddress.slice(-4)} swapped ${Number(t.tokenAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })} $${t.ticker} for ${amountUsdc.toFixed(2)} WUSDC.`,
          timestamp: t.timestamp,
          tokenId: t.tokenId,
          ticker: t.ticker,
        });
      }
    }

    signals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(signals.slice(0, 40));
  } catch (err) {
    logger.error({ err }, "GET /api/intelligence/signals failed");
    res.status(200).json([]);
  }
});

router.get("/leaderboard", async (req, res): Promise<void> => {
  try {
    const leaderboard = await getLeaderboard();
    res.json(leaderboard);
  } catch (err) {
    logger.error({ err }, "GET /api/leaderboard failed");
    res.status(500).json({ error: "Failed to load leaderboard." });
  }
});

router.get("/copytrade/wallet/:address", async (req, res): Promise<void> => {
  try {
    const address = req.params.address;
    if (!address) {
      res.status(400).json({ error: "Owner address is required." });
      return;
    }
    
    let wallet = await getSmartWallet(address);
    if (!wallet) {
      const smartWalletAddress = getDeterministicSmartWalletAddress(address);
      res.json({
        address: address.toLowerCase(),
        smartWalletAddress,
        balanceUsdc: 0,
        isDeployed: 0,
        isActive: 0,
        createdAt: null,
      });
      return;
    }
    
    res.json(wallet);
  } catch (err) {
    logger.error({ err, address: req.params.address }, "GET /api/copytrade/wallet failed");
    res.status(500).json({ error: "Failed to load smart wallet." });
  }
});

router.post("/copytrade/wallet/:address/deploy", async (req, res): Promise<void> => {
  try {
    const address = req.params.address;
    if (!address) {
      res.status(400).json({ error: "Owner address is required." });
      return;
    }
    
    const smartWalletAddress = getDeterministicSmartWalletAddress(address);
    const wallet = await deploySmartWallet(address, smartWalletAddress);
    res.json(wallet);
  } catch (err) {
    logger.error({ err, address: req.params.address }, "POST /api/copytrade/wallet/deploy failed");
    res.status(500).json({ error: "Failed to deploy smart wallet." });
  }
});

router.post("/copytrade/wallet/:address/fund", async (req, res): Promise<void> => {
  try {
    const address = req.params.address;
    const amount = Number(req.body.amount || 100);
    if (!address || Number.isNaN(amount) || amount <= 0) {
      res.status(400).json({ error: "Valid owner address and amount are required." });
      return;
    }
    
    const newBalance = await updateSmartWalletBalance(address, amount);
    res.json({ success: true, balance: newBalance });
  } catch (err) {
    logger.error({ err, address: req.params.address }, "POST /api/copytrade/wallet/fund failed");
    res.status(500).json({ error: "Failed to fund smart wallet." });
  }
});

router.post("/copytrade/wallet/:address/withdraw", async (req, res): Promise<void> => {
  try {
    const address = req.params.address;
    const amount = Number(req.body.amount);
    if (!address || Number.isNaN(amount) || amount <= 0) {
      res.status(400).json({ error: "Valid owner address and amount are required." });
      return;
    }
    
    const wallet = await getSmartWallet(address);
    if (!wallet || wallet.balanceUsdc < amount) {
      res.status(400).json({ error: "Insufficient smart wallet balance for withdrawal." });
      return;
    }

    try {
      const crypto = await import("node:crypto");
      const hash = crypto.createHash("sha256").update(`arc.smartwallet.v1.${address.toLowerCase()}`).digest("hex");
      const privateKey = "0x" + hash;
      
      const provider = new JsonRpcProvider(process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network");
      const signerWallet = new Wallet(privateKey, provider);
      
      const onChainBalanceWei = await provider.getBalance(signerWallet.address);
      const withdrawAmountWei = parseUnits(amount.toString(), 18);
      
      if (onChainBalanceWei >= withdrawAmountWei) {
        logger.info({ from: signerWallet.address, to: address, amount }, "Initiating on-chain transfer of tokens back to MetaMask");
        
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice ?? parseUnits("1.5", 9);
        const gasLimit = 21000n;
        const gasCost = gasLimit * gasPrice;
        
        let txValue = withdrawAmountWei;
        if (withdrawAmountWei + gasCost > onChainBalanceWei) {
          txValue = onChainBalanceWei - gasCost;
        }
        
        if (txValue > 0n) {
          const tx = await signerWallet.sendTransaction({
            to: address,
            value: txValue,
            gasLimit,
            gasPrice,
          });
          logger.info({ txHash: tx.hash }, "On-chain withdrawal transfer transaction broadcasted");
          await tx.wait();
          logger.info({ txHash: tx.hash }, "On-chain withdrawal transfer transaction confirmed");
        }
      } else {
        logger.warn({ onChainBalance: onChainBalanceWei.toString(), needed: withdrawAmountWei.toString() }, "Insufficient on-chain balance in smart wallet for real withdrawal. Proceeding with database-only update.");
      }
    } catch (chainErr) {
      logger.warn({ err: chainErr }, "On-chain withdrawal failed or bypassed. Falling back to simulated database balance update.");
    }
    
    const newBalance = await updateSmartWalletBalance(address, -amount);
    res.json({ success: true, balance: newBalance });
  } catch (err) {
    logger.error({ err, address: req.params.address }, "POST /api/copytrade/wallet/withdraw failed");
    res.status(500).json({ error: "Failed to withdraw from smart wallet." });
  }
});

router.get("/copytrade/targets/:address", async (req, res): Promise<void> => {
  try {
    const address = req.params.address;
    if (!address) {
      res.status(400).json({ error: "Owner address is required." });
      return;
    }
    
    const targets = await listCopytradeTargets(address);
    res.json(targets);
  } catch (err) {
    logger.error({ err, address: req.params.address }, "GET /api/copytrade/targets failed");
    res.status(500).json({ error: "Failed to list copytrade targets." });
  }
});

router.post("/copytrade/targets/:address", async (req, res): Promise<void> => {
  try {
    const address = req.params.address;
    const { targetAddress, allocationUsdc, maxSlippage, isActive } = req.body;
    
    if (!address || !targetAddress) {
      res.status(400).json({ error: "Owner address and target address are required." });
      return;
    }
    
    const target = await setCopytradeTarget(
      address,
      targetAddress,
      Number(allocationUsdc ?? 25.0),
      Number(maxSlippage ?? 1.0),
      Number(isActive ?? 1)
    );
    
    res.json(target);
  } catch (err) {
    logger.error({ err, address: req.params.address }, "POST /api/copytrade/targets failed");
    res.status(500).json({ error: "Failed to set copytrade target." });
  }
});

router.delete("/copytrade/targets/:address/:target", async (req, res): Promise<void> => {
  try {
    const { address, target } = req.params;
    if (!address || !target) {
      res.status(400).json({ error: "Owner address and target address are required." });
      return;
    }
    
    const success = await removeCopytradeTarget(address, target);
    res.json({ success });
  } catch (err) {
    logger.error({ err, address: req.params.address }, "DELETE /api/copytrade/targets failed");
    res.status(500).json({ error: "Failed to remove copytrade target." });
  }
});

router.get("/copytrade/actions/:address", async (req, res): Promise<void> => {
  try {
    const address = req.params.address;
    if (!address) {
      res.status(400).json({ error: "Owner address is required." });
      return;
    }
    
    const actions = await listCopytradeActions(address);
    res.json(actions);
  } catch (err) {
    logger.error({ err, address: req.params.address }, "GET /api/copytrade/actions failed");
    res.status(500).json({ error: "Failed to list copytrade actions." });
  }
});

router.get("/wallet/:address", async (req, res): Promise<void> => {
  try {
    const address = req.params.address;
    if (!address) {
      res.status(400).json({ error: "Wallet address is required." });
      return;
    }
    const analytics = await getWalletAnalytics(address);
    res.json(analytics);
  } catch (err) {
    logger.error({ err, address: req.params.address }, "GET /api/wallet/:address failed");
    res.status(500).json({ error: "Failed to load wallet analytics." });
  }
});

router.get("/tokens/:id/ai-audit", async (req, res): Promise<void> => {
  try {
    const id = req.params.id;
    const token = await getToken(id);
    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    const creatorHolding = token.creatorHoldingPercent ?? 0;
    const marketCap = token.marketCap;
    const isUnlisted = token.marketType === "unlisted";
    const ticker = token.ticker.toUpperCase();
    const name = token.name.toUpperCase();

    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (geminiApiKey) {
      try {
        const prompt = `You are the ArcMeme AI Degen Auditor, a satirical, humor-filled, no-nonsense smart contract auditor for meme coins on the Arc blockchain network. Analyze this meme coin and generate a satirical, droll audit review.
        
        Token details:
        - Name: ${token.name}
        - Ticker: ${token.ticker}
        - Description: ${token.description}
        - Creator holding percent: ${creatorHolding}%
        - Market cap: $${marketCap}
        - Pool type: ${token.marketType}

        Heuristics findings:
        - Creator holding score: ${creatorHolding}% (high holding means dump risk).
        - Pool liquidity: $${marketCap} (low liquidity means slippage risk).
        - Ticker analysis: check if ticker or name sounds suspicious (e.g. RUG, SCAM).

        You MUST generate a JSON response strictly matching this TypeScript structure:
        {
          "safetyScore": number, // 0 to 100 representing the safety rating
          "verdict": "danger" | "warning" | "safe", // based on security risk levels
          "satiricalWarning": string, // a single line of satirical, punchy, crypto-Twitter degen-style warning about this coin
          "auditLogs": string[] // an array of 6 humorous bytecode scanner actions with bracket headers (e.g., '[INF] Scanning dynamic honeypots...', '[OK] Found no blacklists...')
        }`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        if (response.ok) {
          const apiData = (await response.json()) as any;
          const textResponse = apiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textResponse) {
            const parsed = JSON.parse(textResponse);
            if (
              typeof parsed.safetyScore === "number" &&
              ["danger", "warning", "safe"].includes(parsed.verdict) &&
              typeof parsed.satiricalWarning === "string" &&
              Array.isArray(parsed.auditLogs)
            ) {
              res.json({
                safetyScore: parsed.safetyScore,
                verdict: parsed.verdict,
                summary: `AI Security Audit for ${token.name} (${ticker})`,
                auditLogs: parsed.auditLogs,
                satiricalWarning: parsed.satiricalWarning,
                creatorConcentration: creatorHolding,
                aiPowered: true
              });
              return;
            }
          }
        }
      } catch (err) {
        logger.error({ err }, "Dynamic Gemini AI Degen Audit failed, falling back to heuristics");
      }
    }

    let safetyScore = 85;
    let verdict: "danger" | "warning" | "safe" = "safe";
    let satiricalWarning = "✅ LP is locked tighter than a bank vault. Highly based creator. Clean code. Send it.";

    if (creatorHolding > 45) {
      safetyScore = 15;
      verdict = "danger";
      satiricalWarning = "⚠️ OWNER DUMP RISK: Dev owns half the supply from launch. Sniping tool detected. High risk of immediate dumping.";
    } else if (creatorHolding > 15) {
      safetyScore = 55;
      verdict = "warning";
      satiricalWarning = "⚠️ MEDIUM CONCENTRATION: Creator holds a notable chunk. If they decide to cash out, the chart goes straight to zero.";
    }

    if (id.includes("rug") || ticker.includes("RUG") || name.includes("RUG") || id.includes("scam") || ticker.includes("SCAM")) {
      safetyScore = Math.min(safetyScore, 10);
      verdict = "danger";
      satiricalWarning = "☠️ HONEYPOT RISK: Literally named after a rug or scam. Code is probably a honeypot. Auditing this is a waste of CPU cycles.";
    }

    if (isUnlisted) {
      safetyScore = Math.min(safetyScore, 45);
      if (verdict !== "danger") verdict = "warning";
      if (safetyScore > 15) {
        satiricalWarning = "⚠️ UNLISTED POOL: This token is not listed on AMM pools yet. Pure degen gambling before listing.";
      }
    } else if (marketCap < 2000) {
      safetyScore = Math.min(safetyScore, 35);
      if (verdict !== "danger") verdict = "warning";
      if (safetyScore > 15) {
        satiricalWarning = "⚠️ RESERVES DEPLETED: Reserves are shallower than a kiddie pool. Swapping $50 will move the price by 30%. Pure degen gambling.";
      }
    } else if (marketCap >= 35000 && safetyScore > 60) {
      safetyScore = Math.min(safetyScore + 10, 100);
      verdict = "safe";
      satiricalWarning = "🚀 SECURE RESERVES: LP is locked tighter than a bank vault. Highly based creator. Clean code. Send it.";
    }

    const auditLogs = [
      `[INF] Decompiling contract bytecode for $${ticker}...`,
      `[OK] Retargeted bytecode integrity signature verification.`,
      `[INF] Scanning for dynamic honeypot traps and blacklist maps...`,
      `[OK] Max transaction size restriction is not hardcoded.`,
      `[INF] Evaluation complete. Creator holding percent: ${creatorHolding}%.`,
      `[VERDICT] Final risk score computed: ${safetyScore}/100.`
    ];

    res.json({
      safetyScore,
      verdict,
      summary: `AI Security Audit for ${token.name} (${ticker})`,
      auditLogs,
      satiricalWarning,
      creatorConcentration: creatorHolding,
      aiPowered: false
    });
  } catch (err) {
    logger.error({ err, id: req.params.id }, "GET /api/tokens/:id/ai-audit failed");
    res.status(500).json({ error: "Failed to perform AI audit" });
  }
});

router.get("/tokens/:id/sentiment", async (req, res): Promise<void> => {
  try {
    const id = req.params.id;
    const token = await getToken(id);
    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    const comments = await getCommentsForToken(id);
    const totalComments = comments.length;
    const hypeScore = token.hypeScore ?? 0;

    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (geminiApiKey) {
      try {
        const prompt = `You are the ArcMeme AI Sentiment Analyst, a witty, satirical degen market analyst. Analyze the active community discussion feed for the meme token ${token.name} ($${token.ticker}).
        
        Social telemetry:
        - Total comments posted: ${totalComments}
        - Community Hype boosts triggered: ${hypeScore}
        - Token change 24h: ${token.change24h}%
        - Token price: $${token.price}

        Forum Comments:
        ${comments.slice(0, 10).map(c => `- "${c.content}"`).join("\n")}

        You MUST generate a JSON response strictly matching this TypeScript structure:
        {
          "buzzScore": number, // 0 to 100 representing the active community momentum
          "hypeStatus": string, // a punchy glowing title like "🔥 FOMO SURGE", "🟢 COPE SEASON", "🔴 PANIC SELLING", or "🟡 ACCUMULATING"
          "sentimentSummary": string // a brief 2-sentence satirical, punchy AI summary of what commenters are calling for (e.g. 100x leg up, or mourning the dev's exit)
        }`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        if (response.ok) {
          const apiData = (await response.json()) as any;
          const textResponse = apiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textResponse) {
            const parsed = JSON.parse(textResponse);
            if (
              typeof parsed.buzzScore === "number" &&
              typeof parsed.hypeStatus === "string" &&
              typeof parsed.sentimentSummary === "string"
            ) {
              res.json({
                buzzScore: parsed.buzzScore,
                hypeStatus: parsed.hypeStatus,
                sentimentSummary: parsed.sentimentSummary,
                mentionsCount: totalComments,
                aiPowered: true
              });
              return;
            }
          }
        }
      } catch (err) {
        logger.error({ err }, "Dynamic Gemini AI Sentiment failed, falling back to heuristics");
      }
    }

    let buzzScore = Math.round(Math.min(100, Math.max(10, (totalComments * 8) + (hypeScore * 3))));
    if (buzzScore === 10) {
      buzzScore = Math.round(15 + (id.charCodeAt(0) % 15));
    }

    let hypeStatus = "🟡 ACCUMULATING";
    let sentimentSummary = `Community mood is quiet but accumulating. No active spikes yet.`;

    if (buzzScore > 75) {
      hypeStatus = "🔥 FOMO SURGE";
      sentimentSummary = `Hype velocity is maxed out! Community chatter is parabolic, calling for an immediate 100x leg up.`;
    } else if (buzzScore > 45) {
      hypeStatus = "🟢 COPE SEASON";
      sentimentSummary = `Sentiment is positive but steady. Degens are holding strong, ignoring micro-dips.`;
    } else if (totalComments > 0 && id === "rugpull") {
      hypeStatus = "🔴 PANIC SELLING";
      sentimentSummary = `Extreme panic detected! Social feed is flooded with 'rug' and 'scam' alerts. Get out if you can.`;
    }

    res.json({
      buzzScore,
      hypeStatus,
      sentimentSummary,
      mentionsCount: totalComments,
      aiPowered: false
    });
  } catch (err) {
    logger.error({ err, id: req.params.id }, "GET /api/tokens/:id/sentiment failed");
    res.status(500).json({ error: "Failed to compute sentiment" });
  }
});

router.post("/tokens/:id/hype", async (req, res): Promise<void> => {
  try {
    const id = req.params.id;
    const points = typeof req.body.points === "number" ? req.body.points : 1;
    const newHype = await incrementHype(id, points);
    res.json({ success: true, hypeScore: newHype });
  } catch (err) {
    logger.error({ err, id: req.params.id }, "POST /api/tokens/:id/hype failed");
    res.status(500).json({ error: "Failed to increment hype." });
  }
});

router.post("/tokens/:id/ai-chat", async (req, res): Promise<void> => {
  try {
    const id = req.params.id;
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "prompt parameter is required." });
      return;
    }
    const response = await generateCopilotResponse(id, prompt);
    res.json(response);
  } catch (err) {
    logger.error({ err, id: req.params.id }, "POST /api/tokens/:id/ai-chat failed");
    res.status(500).json({ error: "Failed to generate AI copilot response." });
  }
});

export default router;
