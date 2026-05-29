import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(moduleDir, "..", "data", "arcmeme.sqlite");

console.log("Opening SQLite DB at:", dbPath);
const db = new DatabaseSync(dbPath);

try {
  // Let's count existing rows first
  const tradesCountBefore = db.prepare("SELECT COUNT(*) as count FROM trades").get().count;
  const actionsCountBefore = db.prepare("SELECT COUNT(*) as count FROM copytrade_actions").get().count;
  console.log(`Before purge: ${tradesCountBefore} trades, ${actionsCountBefore} copytrade actions.`);

  // Purge the tables
  db.exec("DELETE FROM trades;");
  db.exec("DELETE FROM copytrade_actions;");
  console.log("Deleted rows successfully.");

  const tradesCountAfter = db.prepare("SELECT COUNT(*) as count FROM trades").get().count;
  const actionsCountAfter = db.prepare("SELECT COUNT(*) as count FROM copytrade_actions").get().count;
  console.log(`After purge: ${tradesCountAfter} trades, ${actionsCountAfter} copytrade actions.`);

  console.log("Mock trades and copytrade actions successfully purged!");
} catch (e) {
  console.error("Error during DB purge:", e);
  process.exit(1);
}
