const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function checkTx() {
  const hashes = [
    "0x9d57e418826f2428aeee36b71aa41168d7b8e7ac1e1941bf9c8ed2d779bd6f33",
    "0xda00c0c08a25a05560b158d477f260692b90462660c4035c4f7d689c60bcc065"
  ];

  for (const hash of hashes) {
    console.log(`\n======================================================`);
    console.log(`Checking transaction: ${hash}`);
    try {
      const tx = await rpc("eth_getTransactionByHash", [hash]);
      console.log("Transaction details:");
      console.log(`  From: ${tx.from}`);
      console.log(`  To: ${tx.to}`);
      console.log(`  Value: ${parseInt(tx.value, 16)} (${tx.value})`);
      
      const receipt = await rpc("eth_getTransactionReceipt", [hash]);
      console.log("Receipt details:");
      console.log(`  Status: ${parseInt(receipt.status, 16)}`);
      console.log(`  Gas Used: ${parseInt(receipt.gasUsed, 16)}`);
      console.log(`  Logs count: ${receipt.logs.length}`);
      
      receipt.logs.forEach((log, index) => {
        console.log(`\n  Log #${index}:`);
        console.log(`    Address: ${log.address}`);
        console.log(`    Topics:`, log.topics);
        console.log(`    Data: ${log.data}`);
      });
    } catch (e) {
      console.error("Error checking transaction:", e.message);
    }
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

checkTx();
