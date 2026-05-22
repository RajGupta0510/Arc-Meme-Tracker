import { Router, type IRouter, type Response } from "express";
import {
  ListTokensQueryParams,
  LaunchTokenBody,
  GetTokenParams,
} from "@workspace/api-zod";
import {
  createToken,
  getToken,
  isCandleInterval,
  listCandles,
  listTrades,
  listTokens,
  updateTokenMarket,
  type Token,
} from "../lib/token-store";
import { logger } from "../lib/logger";
import { indexTokenSwapEvents } from "../lib/swap-indexer";

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

export default router;
