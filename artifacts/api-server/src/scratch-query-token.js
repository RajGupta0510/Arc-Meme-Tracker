import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(moduleDir, "..", "data", "arcmeme.sqlite");

console.log("Opening SQLite DB at:", dbPath);
const db = new DatabaseSync(dbPath);

const token = db.prepare("SELECT * FROM tokens WHERE ticker = 'EDSIND'").get();
console.log("Token EDSIND Details:");
console.log(token);
