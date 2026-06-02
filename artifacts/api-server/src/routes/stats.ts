import { Router, type IRouter } from "express";
import { getTokens } from "../lib/token-store";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  try {
    const tokens = await getTokens();
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    res.json({
      totalTokens: tokens.length,
      totalVolume24h: tokens.reduce((sum, token) => sum + token.volume24h, 0),
      totalMarketCap: tokens.reduce((sum, token) => sum + token.marketCap, 0),
      activeTraders: tokens.reduce((sum, token) => sum + token.holders, 0),
      tokensLaunched24h: tokens.filter(
        (token) => now - new Date(token.createdAt).getTime() <= oneDayMs,
      ).length,
    });
  } catch (err) {
    logger.error({ err }, "GET /api/stats failed");
    res.status(200).json({
      totalTokens: 0,
      totalVolume24h: 0,
      totalMarketCap: 0,
      activeTraders: 0,
      tokensLaunched24h: 0,
    });
  }
});

export default router;
