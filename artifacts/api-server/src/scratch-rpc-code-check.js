const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function checkCode() {
  const addresses = [
    "0xD9A1e5282a8009121b74A81c9B734c4447474dFe", // RAJ pair
    "0x253232FE8d9432a2B1b23bDD74a7e8aBf575Bf6e", // RAJ token
    "0xbe4f91B14430e335cC0c90FB4199ca58517B1E96", // EDSIND pair
    "0x30cf8d7311eb32a3C189d59406547731cA8036bB"  // EDSIND token
  ];

  for (const addr of addresses) {
    try {
      const code = await rpc("eth_getCode", [addr, "latest"]);
      console.log(`Address: ${addr}`);
      console.log(`  Code length: ${code.length}`);
      console.log(`  Exists? ${code !== "0x" && code.length > 2 ? "YES 🟢" : "NO 🔴"}`);
    } catch (e) {
      console.error(`Error for ${addr}:`, e.message);
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

checkCode();
