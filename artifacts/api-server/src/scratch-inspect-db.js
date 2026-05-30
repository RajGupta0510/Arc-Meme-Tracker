import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, "..", "data", "arcmeme.sqlite");
console.log("Opening SQLite DB at:", dbPath);
const db = new DatabaseSync(dbPath);

console.log("=== TRADES ===");
const trades = db.prepare("SELECT id, tokenId, tokenAmount, wusdcAmount, executionPrice, traderAddress, timestamp, side FROM trades ORDER BY timestamp DESC LIMIT 20").all();
console.log(`Total trades found: ${trades.length}`);
trades.forEach(t => {
  console.log(`Trade: ${t.side.toUpperCase()} ${t.tokenAmount} units for $${t.wusdcAmount} USDC by trader ${t.traderAddress} on token ${t.tokenId} at ${t.timestamp}`);
});

console.log("\n=== TOKEN CONFIGS ===");
const tokens = db.prepare("SELECT id, ticker, pairAddress FROM tokens").all();
console.log(tokens);
