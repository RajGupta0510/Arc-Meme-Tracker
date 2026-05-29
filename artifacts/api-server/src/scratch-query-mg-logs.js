const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function checkMgLogs() {
  const pairAddress = "0x35A2740BEaA7732cE2D16ba499033D83934aaDAe";
  const blockNumber = 43833225;

  console.log("Checking logs on MG pair at block", blockNumber);

  try {
    const startBlock = 43828458;
    const endBlock = 43838456;
    console.log(`Querying block range ${startBlock} to ${endBlock}...`);
    const logs = await rpc("eth_getLogs", [{
      address: pairAddress,
      fromBlock: "0x" + startBlock.toString(16),
      toBlock: "0x" + endBlock.toString(16),
      topics: ["0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"]
    }]);

    console.log("Total logs found at block:", logs.length);
    logs.forEach((log, i) => {
      console.log(`Log ${i}:`);
      console.log(`  Address: ${log.address}`);
      console.log(`  Topics:`, log.topics);
      console.log(`  Data: ${log.data}`);
    });
  } catch (err) {
    console.error("Error:", err.message);
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

checkMgLogs();
