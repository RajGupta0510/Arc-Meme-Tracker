import { db, tradesTable, tokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { updateTokenMarketStats } from "./dist/lib/token-store.mjs";

process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_noEtk09PJrDa@ep-fragrant-fog-aou4tdxi.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function run() {
  const tokenId = "raj-1718115664187";
  const pairAddress = "0x3a44fef8e7456ab35002bdf6c1c85093155776d6";
  const traderAddress = "0xdd2fd4581271e230360230f9337d5c0430bf44c0";

  try {
    console.log("Generating mock trades for RAJ token...");

    // Delete existing trades for RAJ to have a clean historical dataset
    await db.delete(tradesTable).where(eq(tradesTable.tokenId, tokenId));
    console.log("Cleared existing trades.");

    const now = Date.now();
    const trades = [];
    let price = 28.62142271810574;
    const baseBlockNumber = 2720000;

    // Generate 60 trades spanning the last 2 days (48 hours)
    for (let i = 0; i < 60; i++) {
      const timeOffset = (60 - i) * 45 * 60 * 1000; // 45 minutes intervals
      const tradeTime = new Date(now - timeOffset).toISOString();
      
      // Random walk for price
      const changePercent = (Math.random() - 0.48) * 0.08; // slight upward bias
      price = price * (1 + changePercent);
      if (price <= 0) price = 1.0;

      const side = Math.random() > 0.5 ? "buy" : "sell";
      const wusdcAmount = 50 + Math.random() * 2000; // $50 to $2050
      const tokenAmount = wusdcAmount / price;

      trades.push({
        id: `mock-tx-${i}-${now}`,
        tokenId,
        pairAddress,
        txHash: `0xmocktxhash${i}a8d9a2024b17ca39a7384a22c54df1103c80ff628df7`,
        logIndex: i,
        blockNumber: baseBlockNumber + i * 10,
        side,
        tokenAmount,
        wusdcAmount,
        executionPrice: price,
        traderAddress,
        timestamp: tradeTime,
      });
    }

    // Insert all generated trades
    for (const trade of trades) {
      await db.insert(tradesTable).values(trade);
    }
    console.log(`Successfully generated and inserted ${trades.length} mock trades.`);

    // Update token market stats
    await updateTokenMarketStats(tokenId);
    console.log("Updated token market stats.");

  } catch (err) {
    console.error("Error generating mock trades:", err);
  } finally {
    process.exit(0);
  }
}

run();
