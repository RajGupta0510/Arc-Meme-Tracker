const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function findPairCreated() {
  const factoryAddress = "0x2B865487A1008D2694C1D367c761f00a564aCECb"; // ApexiSwap Factory
  const rajToken = "0x253232FE8d9432a2B1b23bDD74a7e8aBf575Bf6e";
  const wusdc = "0x911b4000D3422F482F4062a913885f7b035382Df";

  console.log("Querying PairCreated events on factory:", factoryAddress);

  try {
    const blockNumHex = await rpc("eth_blockNumber", []);
    const blockNum = parseInt(blockNumHex, 16);
    console.log("Current block number:", blockNum);

    const CHUNK_SIZE = 9000;
    // Scan last 1,000,000 blocks (approx. last 20 days)
    const scanBlocks = 1000000;
    const startBlock = Math.max(0, blockNum - scanBlocks);
    const endBlock = blockNum;

    console.log(`Scanning historical logs from block ${startBlock} to ${endBlock}...`);

    // PairCreated topic: 0x0d3e512768b08d477f260692b90462660c4035c4f7d689c60bcd065... wait, let's just query all events on the factory
    // Uniswap V2 factory only emits PairCreated, so any event on it is PairCreated!
    
    let totalPairs = 0;
    const pairs = [];

    for (let s = startBlock; s <= endBlock; s += CHUNK_SIZE) {
      const e = Math.min(s + CHUNK_SIZE - 1, endBlock);
      try {
        const chunk = await rpc("eth_getLogs", [{
          address: factoryAddress,
          fromBlock: "0x" + s.toString(16),
          toBlock: "0x" + e.toString(16)
        }]);
        if (chunk.length > 0) {
          totalPairs += chunk.length;
          pairs.push(...chunk);
        }
      } catch (err) {
        console.error(`Error in chunk ${s}-${e}:`, err.message);
      }
    }

    console.log(`Total PairCreated events found: ${totalPairs}`);
    pairs.forEach(p => {
      const block = parseInt(p.blockNumber, 16);
      const token0 = "0x" + p.topics[1].slice(-40);
      const token1 = "0x" + p.topics[2].slice(-40);
      
      // Decode pair address from data
      // Data format is: abi.encode(pair, allPairsLength) -> 32 bytes pair address, 32 bytes length
      const pair = "0x" + p.data.slice(26, 66);
      
      console.log(`  Block: ${block}`);
      console.log(`    Token0: ${token0}`);
      console.log(`    Token1: ${token1}`);
      console.log(`    Pair: ${pair}`);
      console.log(`    TxHash: ${p.transactionHash}`);
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

findPairCreated();
