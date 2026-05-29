import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { indexTokenSwapEvents } from "../dist/lib/swap-indexer.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(moduleDir, "..", "data", "arcmeme.sqlite");

const db = new DatabaseSync(dbPath);

const token = db.prepare("SELECT * FROM tokens WHERE ticker = ' MG'").get();
console.log("Loaded Token:", token);

// Since we compiled the project to dist, we can run the compiled indexer
indexTokenSwapEvents(token)
  .then(res => {
    console.log("Indexer returned:", res);
    const trades = db.prepare("SELECT * FROM trades WHERE tokenId = ?").all(token.id);
    console.log("Trades stored in DB for MG:", trades.length);
    console.log(trades);
  })
  .catch(err => console.error("Error running indexer:", err));
