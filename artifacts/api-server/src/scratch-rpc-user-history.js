const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function getUserHistory() {
  const userAddress = "0xef0642c9d173db4be17eb19e8d6c74eb86d1f2bc";
  console.log("Querying history for user:", userAddress);

  try {
    const blockNumHex = await rpc("eth_blockNumber", []);
    const blockNum = parseInt(blockNumHex, 16);
    console.log("Current block number:", blockNum);

    const CHUNK_SIZE = 9000;
    const scanBlocks = 1500000; // last ~30 days
    const startBlock = Math.max(0, blockNum - scanBlocks);
    const endBlock = blockNum;

    console.log(`Scanning historical logs where user is sender/receiver from block ${startBlock} to ${endBlock}...`);
    
    // We can query eth_getLogs with the userAddress as topic1 or topic2 (e.g. for Transfer events)
    // Transfer topic: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
    // Topic 1: from userAddress, or Topic 2: to userAddress
    const userTopic = "0x" + userAddress.slice(2).padStart(64, "0");

    let totalTransferLogs = 0;
    const allTransferLogs = [];

    for (let s = startBlock; s <= endBlock; s += CHUNK_SIZE) {
      const e = Math.min(s + CHUNK_SIZE - 1, endBlock);
      try {
        // Query transfers from user
        const chunkFrom = await rpc("eth_getLogs", [{
          fromBlock: "0x" + s.toString(16),
          toBlock: "0x" + e.toString(16),
          topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", userTopic]
        }]);

        // Query transfers to user
        const chunkTo = await rpc("eth_getLogs", [{
          fromBlock: "0x" + s.toString(16),
          toBlock: "0x" + e.toString(16),
          topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", null, userTopic]
        }]);

        allTransferLogs.push(...chunkFrom, ...chunkTo);
        totalTransferLogs += (chunkFrom.length + chunkTo.length);
      } catch (err) {
        console.error(`Error in chunk ${s}-${e}:`, err.message);
      }
    }

    console.log(`Total Transfer events associated with user: ${totalTransferLogs}`);
    
    // Deduplicate by txHash
    const uniqueTxs = new Map();
    for (const log of allTransferLogs) {
      uniqueTxs.set(log.transactionHash, parseInt(log.blockNumber, 16));
    }

    console.log(`Found ${uniqueTxs.size} unique transaction hashes:`);
    for (const [txHash, block] of uniqueTxs.entries()) {
      console.log(`  Tx: ${txHash} (Block: ${block})`);
      
      // Let's query the receipt to see what events are inside
      const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
      console.log(`    Receipt Logs: ${receipt.logs.length}`);
      
      // Let's check if there are any standard Swap events
      const hasSwap = receipt.logs.some(l => l.topics[0] === "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822");
      console.log(`    Has Swap Event? ${hasSwap ? "YES 🟢" : "NO 🔴"}`);
      if (hasSwap) {
        const swapLogs = receipt.logs.filter(l => l.topics[0] === "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822");
        console.log("    Swap logs details:");
        swapLogs.forEach(sl => {
          console.log(`      Pair contract address: ${sl.address}`);
          console.log(`      Topics:`, sl.topics);
          console.log(`      Data: ${sl.data}`);
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

getUserHistory();
