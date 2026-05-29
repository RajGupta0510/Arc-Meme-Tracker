import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(moduleDir, "..", "data", "arcmeme.sqlite");

const db = new DatabaseSync(dbPath);
const token = db.prepare("SELECT * FROM tokens WHERE ticker = ' MG'").get();

console.log("Loaded Token:", token);

const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const SWAP_TOPIC = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";

async function diagnose() {
  const latestBlock = 44538537;
  const fromBlock = latestBlock - 1500000;
  const toBlock = latestBlock;

  console.log(`Diagnosing MG swaps from ${fromBlock} to ${toBlock}...`);

  const LOG_CHUNK_BLOCKS = 9999;
  
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK_BLOCKS) {
    const end = Math.min(start + LOG_CHUNK_BLOCKS - 1, toBlock);
    
    // Check if block 43833225 is in this chunk
    if (43833225 >= start && 43833225 <= end) {
      console.log(`\nFound target block chunk: ${start} to ${end}`);
      
      const payload = {
        address: token.pairAddress,
        fromBlock: toHexBlock(start),
        toBlock: toHexBlock(end),
        topics: [SWAP_TOPIC]
      };
      
      console.log("Request Payload:", JSON.stringify(payload, null, 2));

      try {
        const chunk = await rpc("eth_getLogs", [payload]);
        console.log("Response chunk count:", chunk.length);
        console.log("Chunk results:", JSON.stringify(chunk, null, 2));
      } catch (err) {
        console.error("RPC Error:", err.message);
      }
    }
  }
}

function toHexBlock(block) {
  return `0x${Math.max(block, 0).toString(16)}`;
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

diagnose();
