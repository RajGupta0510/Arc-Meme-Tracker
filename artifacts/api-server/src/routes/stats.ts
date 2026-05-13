import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  res.json({
    totalTokens: 10,
    totalVolume24h: 88650,
    totalMarketCap: 186231,
    activeTraders: 8432,
    tokensLaunched24h: 3,
  });
});

export default router;
