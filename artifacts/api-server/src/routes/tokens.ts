import { Router, type IRouter, type Response } from "express";
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
  db,
  getCommentsForToken,
  saveComment,
  toggleEmojiReaction,
  getReactionsForToken,
  getRecentComments,
} from "../lib/token-store";
import { logger } from "../lib/logger";
import { indexTokenSwapEvents } from "../lib/swap-indexer";
import { fetchTokenMetadata, detectMarket } from "../lib/arc-rpc";

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
    const tokens = listTokens(sort, limit);

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

    const newToken: Token = createToken({
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
    res.json(listTokens("trending", 6));
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

    const token = getToken(params.data.id);
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

    const token = updateTokenMarket(id, parsed.data);
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

    const token = getToken(params.data.id);
    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    if (token.marketType === "amm_pool" && token.pairAddress && token.contractAddress) {
      try {
        const result = await indexTokenSwapEvents(token);
        logger.info({ id: token.id, pairAddress: token.pairAddress, ...result }, "GET /api/tokens/:id/trades indexed swaps");
      } catch (err) {
        logger.error(
          {
            err,
            id: token.id,
            pairAddress: token.pairAddress,
            contractAddress: token.contractAddress,
          },
          "Swap indexing failed; returning cached trades",
        );
        res.setHeader("x-arcmeme-indexing-error", err instanceof Error ? err.message : "Unknown indexing error");
      }
    }

    res.json(listTrades(token.id, 50));
  } catch (err) {
    const details = getErrorPayload(err);
    logger.error({ err, id: req.params.id }, "GET /api/tokens/:id/trades failed");
    res.status(200).json([]);
  }
});

async function indexTokenTradesIfTradeable(token: Token, res: Response) {
  if (token.marketType !== "amm_pool" || !token.pairAddress || !token.contractAddress) return;

  try {
    const result = await indexTokenSwapEvents(token);
    logger.info({ id: token.id, pairAddress: token.pairAddress, ...result }, "Indexed token swaps before market data response");
  } catch (err) {
    logger.error(
      {
        err,
        id: token.id,
        pairAddress: token.pairAddress,
        contractAddress: token.contractAddress,
      },
      "Swap indexing failed before market data response",
    );
    res.setHeader("x-arcmeme-indexing-error", err instanceof Error ? err.message : "Unknown indexing error");
  }
}

router.get("/tokens/:id/candles", async (req, res): Promise<void> => {
  try {
    const params = GetTokenParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const interval = isCandleInterval(req.query.interval) ? req.query.interval : "1m";
    const token = getToken(params.data.id);
    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    await indexTokenTradesIfTradeable(token, res);
    const candles = listCandles(token.id, interval);

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

    const token = getToken(params.data.id);
    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    await indexTokenTradesIfTradeable(token, res);
    res.json(
      listCandles(token.id, "5m").map(({ time, ...candle }) => ({
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

    const existing = getTokenByContract(contractAddress);
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

    const token = createToken({
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

    const trades = db.prepare(`
      SELECT * FROM trades
      WHERE LOWER(traderAddress) = LOWER(?)
      ORDER BY datetime(timestamp) ASC
    `).all(address) as any[];

    const tokens = getTokens();

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

    for (const trade of trades) {
      const tId = trade.tokenId;
      const tok = tokens.find(t => t.id === tId);
      if (!tok) continue;

      if (!tokenStats[tId]) {
        tokenStats[tId] = {
          tokenId: tId,
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

      const stats = tokenStats[tId];
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
    const comments = getCommentsForToken(id);
    const reactions = getReactionsForToken(id);
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

    const comment = saveComment({
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

    const result = toggleEmojiReaction({
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
    const comments = getRecentComments(limit);
    res.json(comments);
  } catch (err) {
    logger.error({ err }, "GET /api/community/activity failed");
    res.status(500).json({ error: "Failed to load community activity." });
  }
});

export default router;
