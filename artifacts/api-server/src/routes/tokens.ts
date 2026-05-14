import { Router, type IRouter } from "express";
import {
  ListTokensQueryParams,
  LaunchTokenBody,
  GetTokenParams,
  GetTokenChartParams,
} from "@workspace/api-zod";
import {
  createToken,
  getToken,
  listTokens,
  type Token,
} from "../lib/token-store";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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

function generateChartData(basePrice: number, points = 120) {
  const now = Date.now();
  const interval = 5 * 60 * 1000;
  let price = basePrice * 0.5;
  const data = [];

  for (let i = points; i >= 0; i--) {
    const change = (Math.random() - 0.47) * price * 0.06;
    const open = price;
    price = Math.max(price + change, basePrice * 0.01);
    const high = Math.max(open, price) * (1 + Math.random() * 0.02);
    const low = Math.min(open, price) * (1 - Math.random() * 0.02);
    const close = price;
    const volume = basePrice * 1000000 * (0.5 + Math.random() * 2);

    data.push({
      timestamp: now - i * interval,
      open: parseFloat(open.toFixed(12)),
      high: parseFloat(high.toFixed(12)),
      low: parseFloat(low.toFixed(12)),
      close: parseFloat(close.toFixed(12)),
      volume: parseFloat(volume.toFixed(2)),
    });
  }

  return data;
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

router.get("/tokens/:id/chart", async (req, res): Promise<void> => {
  try {
    const params = GetTokenChartParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const token = getToken(params.data.id);
    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    const chart = generateChartData(token.price);
    res.json(chart);
  } catch (err) {
    logger.error({ err, id: req.params.id }, "GET /api/tokens/:id/chart failed");
    res.status(200).json([]);
  }
});

export default router;
