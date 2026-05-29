import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(moduleDir, "..", "data", "arcmeme.sqlite");

console.log("Opening SQLite DB at:", dbPath);
const db = new DatabaseSync(dbPath);

const tokens = db.prepare("SELECT id, ticker, createdAt, pairAddress FROM tokens").all();
console.log("Tracked Tokens Creation Times:");
console.log(tokens.map(t => ({
  id: t.id,
  ticker: t.ticker,
  createdAt: t.createdAt,
  hasPair: !!t.pairAddress
})));
