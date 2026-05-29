import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(moduleDir, "..", "data", "arcmeme.sqlite");

console.log("DB Path:", dbPath);
const db = new DatabaseSync(dbPath);
try {
  const trades = db.prepare("SELECT timestamp, COUNT(*) as count FROM trades GROUP BY date(timestamp) ORDER BY timestamp DESC LIMIT 10").all();
  console.log("Trades grouped by date:", trades);

  const allTrades = db.prepare("SELECT timestamp, tokenId, executionPrice FROM trades ORDER BY timestamp ASC LIMIT 10").all();
  console.log("First few trades:", allTrades);
} catch (e) {
  console.error(e);
}
