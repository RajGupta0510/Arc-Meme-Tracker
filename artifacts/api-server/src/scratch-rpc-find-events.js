import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(moduleDir, "..", "data", "arcmeme.sqlite");

const db = new DatabaseSync(dbPath);
const tokens = db.prepare("SELECT * FROM tokens WHERE pairAddress IS NOT NULL AND pairAddress != ''").all();
const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function findEvents() {
  try {
    const blockNumHex = await rpc("eth_blockNumber", []);
    const blockNum = parseInt(blockNumHex, 16);
    console.log("Current block number:", blockNum);

    const CHUNK_SIZE = 9000;
    
    // Scan a massive block range of 500,000 blocks (approx last 10 days)
    const scanBlocks = 500000;
    const startBlock = Math.max(0, blockNum - scanBlocks);
    const endBlock = blockNum;

    console.log(`Scanning historical logs from block ${startBlock} to ${endBlock}...`);

    for (const t of tokens) {
      console.log(`\nScanning history for ${t.ticker} (${t.id})...`);
      let foundCount = 0;
      
      // Let's do chunk-by-chunk search
      for (let s = startBlock; s <= endBlock; s += CHUNK_SIZE) {
        const e = Math.min(s + CHUNK_SIZE - 1, endBlock);
        
        try {
          const chunk = await rpc("eth_getLogs", [{
            address: t.pairAddress,
            fromBlock: "0x" + s.toString(16),
            toBlock: "0x" + e.toString(16)
          }]);
          
          if (chunk.length > 0) {
            foundCount += chunk.length;
            console.log(`  Found ${chunk.length} events in block chunk ${s} to ${e}:`);
            console.log(chunk.map(l => ({
              blockNumber: parseInt(l.blockNumber, 16),
              txHash: l.transactionHash,
              topics: l.topics,
              dataLength: l.data.length
            })));
          }
        } catch (err) {
          // ignore or print error
          console.error(`  Error in chunk ${s}-${e}:`, err.message);
        }
      }
      
      console.log(`Finished ${t.ticker}. Total events found: ${foundCount}`);
    }
  } catch (e) {
    console.error("Error:", e);
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

findEvents();
