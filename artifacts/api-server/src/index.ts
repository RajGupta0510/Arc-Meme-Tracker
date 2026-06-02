import app from "./app";
import { logger } from "./lib/logger";
import { pathToFileURL } from "node:url";
import { getTokens, updateTokenMarketStats, seedInitialTokens } from "./lib/token-store";
import { indexTokenSwapEvents } from "./lib/swap-indexer";

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, async (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    // 1. Seed database with initial tokens if empty
    await seedInitialTokens();

    // 2. Self-heal and recalculate token stats on boot
    try {
      const tokens = await getTokens();
      logger.info({ count: tokens.length }, "Running startup token market stats self-healing...");
      for (const token of tokens) {
        await updateTokenMarketStats(token.id);
      }
      logger.info("Startup token market stats self-healing completed.");
    } catch (healErr) {
      logger.error({ err: healErr }, "Startup token market stats self-healing failed");
    }

    // 3. Set up 30-second background transaction indexing loop
    // This solves transaction sync lags and keeps database trade/stats fresh continuously
    setInterval(async () => {
      try {
        const tokens = await getTokens();
        logger.info({ count: tokens.length }, "Periodic background swap indexing cycle started");
        for (const token of tokens) {
          if (token.marketType === "amm_pool" && token.pairAddress && token.contractAddress) {
            await indexTokenSwapEvents(token).catch(err => {
              logger.error({ err, tokenId: token.id }, "Periodic background swap indexing failed for token");
            });
          }
        }
      } catch (err) {
        logger.error({ err }, "Periodic background swap indexing cycle failed");
      }
    }, 30000); // 30 seconds
  });
}

export default app;
