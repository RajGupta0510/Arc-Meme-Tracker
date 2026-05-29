const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function checkAllSwaps() {
  const tokens = [
    { ticker: "RAJ", pair: "0xD9A1e5282a8009121b74A81c9B734c4447474dFe", deployBlock: 44342503 },
    { ticker: "TT", pair: "0x88f561f0c4441e63cd6087c98402b377e8214bb2", deployBlock: 44343110 },
    { ticker: "MG", pair: "0x35a2740beaa7732ce2d16ba499033d83934aadae", deployBlock: 44343279 },
    { ticker: "EDSIND", pair: "0xbe4f91b14430e335cc0c90fb4199ca58517b1e96", deployBlock: 44427391 }
  ];

  const SWAP_TOPIC = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";

  try {
    const blockNumHex = await rpc("eth_blockNumber", []);
    const blockNum = parseInt(blockNumHex, 16);
    console.log("Current block number:", blockNum);

    const CHUNK_SIZE = 9000;

    for (const t of tokens) {
      console.log(`\n------------------------------------------------------`);
      console.log(`Checking ALL historical swaps for ${t.ticker} pair: ${t.pair}`);
      console.log(`Scanning from deploy block ${t.deployBlock} to current block ${blockNum}...`);

      let foundSwapsCount = 0;
      const swaps = [];

      for (let s = t.deployBlock; s <= blockNum; s += CHUNK_SIZE) {
        const e = Math.min(s + CHUNK_SIZE - 1, blockNum);
        try {
          const chunk = await rpc("eth_getLogs", [{
            address: t.pair,
            fromBlock: "0x" + s.toString(16),
            toBlock: "0x" + e.toString(16),
            topics: [SWAP_TOPIC]
          }]);
          if (chunk.length > 0) {
            foundSwapsCount += chunk.length;
            swaps.push(...chunk);
          }
        } catch (err) {
          console.error(`  Error in chunk ${s}-${e}:`, err.message);
        }
      }

      console.log(`Finished ${t.ticker}. Total swaps found: ${foundSwapsCount}`);
      if (swaps.length > 0) {
        swaps.forEach((s, idx) => {
          console.log(`  Swap #${idx}:`);
          console.log(`    Block: ${parseInt(s.blockNumber, 16)}`);
          console.log(`    TxHash: ${s.transactionHash}`);
          console.log(`    Topics:`, s.topics);
          console.log(`    Data: ${s.data}`);
        });
      }
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

checkAllSwaps();
