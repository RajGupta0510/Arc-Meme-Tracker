import app from "./app";
import { logger } from "./lib/logger";
import { pathToFileURL } from "node:url";
import { getTokens, saveTrades, updateTokenMarketStats } from "./lib/token-store";
import { dispatchCopytrades } from "./lib/swap-indexer";
import crypto from "node:crypto";

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

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    // Self-heal and recalculate token stats on boot
    try {
      const tokens = getTokens();
      logger.info({ count: tokens.length }, "Running startup token market stats self-healing...");
      for (const token of tokens) {
        updateTokenMarketStats(token.id);
      }
      logger.info("Startup token market stats self-healing completed.");
    } catch (healErr) {
      logger.error({ err: healErr }, "Startup token market stats self-healing failed");
    }
  });
}

export default app;
