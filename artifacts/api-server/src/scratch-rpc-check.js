import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(moduleDir, "..", "data", "arcmeme.sqlite");

console.log("Opening SQLite DB at:", dbPath);
const db = new DatabaseSync(dbPath);

const tokens = db.prepare("SELECT * FROM tokens WHERE pairAddress IS NOT NULL AND pairAddress != ''").all();
const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function checkRpc() {
  try {
    const blockNumHex = await rpc("eth_blockNumber", []);
    const blockNum = parseInt(blockNumHex, 16);
    console.log("Current block number:", blockNum);

    const CHUNK_SIZE = 9000; // Safe below 10,000

    for (const t of tokens) {
      console.log(`\nChecking chunks for ${t.ticker} pair: ${t.pairAddress}`);
      
      const totalLookback = 100000;
      const startBlock = Math.max(0, blockNum - totalLookback);
      const endBlock = blockNum;

      console.log(`Scanning from block ${startBlock} to ${endBlock} (${totalLookback} blocks range)`);

      let totalLogs = 0;
      const logsList = [];

      for (let s = startBlock; s <= endBlock; s += CHUNK_SIZE) {
        const e = Math.min(s + CHUNK_SIZE - 1, endBlock);
        try {
          const chunk = await rpc("eth_getLogs", [{
            address: t.pairAddress,
            fromBlock: "0x" + s.toString(16),
            toBlock: "0x" + e.toString(16),
            topics: ["0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"] // SWAP_TOPIC
          }]);
          totalLogs += chunk.length;
          logsList.push(...chunk);
        } catch (err) {
          console.error(`Error fetching chunk ${s} to ${e}:`, err.message);
        }
      }

      console.log(`Total SWAP logs found: ${totalLogs}`);
      if (logsList.length > 0) {
        console.log("Latest 5 logs:");
        console.log(logsList.slice(-5).map(l => ({
          blockNumber: parseInt(l.blockNumber, 16),
          transactionHash: l.transactionHash,
          logIndex: parseInt(l.logIndex, 16)
        })));
      }
    }
  } catch (e) {
    console.error("Error during check:", e);
  }
}

async function rpc(method, params) {
  const response = await fetch(ARC_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const body = await response.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

checkRpc();
