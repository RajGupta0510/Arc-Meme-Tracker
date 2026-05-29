import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(moduleDir, "..", "data", "arcmeme.sqlite");

const db = new DatabaseSync(dbPath);
const tokens = db.prepare("SELECT id, name, ticker, price FROM tokens").all();
console.log("Tokens in DB:", tokens);
