const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function testChunk() {
  try {
    const blockNumHex = await rpc("eth_blockNumber", []);
    const blockNum = parseInt(blockNumHex, 16);
    console.log("Current block:", blockNum);

    const start = blockNum - 100000;
    const end = blockNum;

    console.log(`Attempting to query eth_getLogs over a 100,000 block range (${start} to ${end})...`);
    
    const logs = await rpc("eth_getLogs", [{
      address: "0xd9a1e5282a8009121b74a81c9b734c4447474dfe", // RAJ pair
      fromBlock: "0x" + start.toString(16),
      toBlock: "0x" + end.toString(16),
      topics: ["0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"]
    }]);

    console.log("Success! Returned logs count:", logs.length);
  } catch (err) {
    console.error("Failed to query 100,000 blocks:", err.message);
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

testChunk();
