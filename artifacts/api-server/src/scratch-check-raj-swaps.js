const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function checkRajSwaps() {
  const pairAddress = "0xD9A1e5282a8009121b74A81c9B734c4447474dFe";
  const swapTopic = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
  
  console.log("Querying swaps on RAJ pair:", pairAddress);

  try {
    const blockNumHex = await rpc("eth_blockNumber", []);
    const blockNum = parseInt(blockNumHex, 16);
    console.log("Current block number:", blockNum);

    const CHUNK_SIZE = 9000;
    const startBlock = 43920000; // creation block is around 43928222
    const endBlock = blockNum;

    console.log(`Scanning historical logs from block ${startBlock} to ${endBlock}...`);
    
    let totalLogs = 0;
    const logs = [];

    for (let s = startBlock; s <= endBlock; s += CHUNK_SIZE) {
      const e = Math.min(s + CHUNK_SIZE - 1, endBlock);
      try {
        const chunk = await rpc("eth_getLogs", [{
          address: pairAddress,
          fromBlock: "0x" + s.toString(16),
          toBlock: "0x" + e.toString(16),
          topics: [swapTopic]
        }]);
        if (chunk.length > 0) {
          totalLogs += chunk.length;
          logs.push(...chunk);
          console.log(`  Found ${chunk.length} logs in chunk ${s}-${e}`);
        }
      } catch (err) {
        console.error(`Error in chunk ${s}-${e}:`, err.message);
      }
    }

    console.log(`Total Swap logs found for RAJ: ${totalLogs}`);
    logs.forEach(l => {
      console.log(`  Block: ${parseInt(l.blockNumber, 16)}, Tx: ${l.transactionHash}`);
    });

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

checkRajSwaps();
