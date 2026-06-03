import { db, tokensTable } from "@workspace/db";

async function main() {
  try {
    const tokens = await db.select().from(tokensTable);
    console.log("=== TOKENS IN DATABASE ===");
    for (const t of tokens) {
      console.log(`Ticker: $${t.ticker} | Name: ${t.name} | Contract: ${t.contractAddress} | Pair: ${t.pairAddress}`);
    }
  } catch (err) {
    console.error("Failed to query tokens:", err);
  }
  process.exit(0);
}

main();
