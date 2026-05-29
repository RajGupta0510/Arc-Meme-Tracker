const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

// ABI function selectors
const DECIMALS_SELECTOR = "0x313ce567"; // decimals()
const BALANCE_OF_SELECTOR = "0x70a08231"; // balanceOf(address)
const GET_RESERVES_SELECTOR = "0x0902f1ac"; // getReserves()

const userAddress = "0xef0642c9d173db4be17eb19e8d6c74eb86d1f2bc";
const tokens = [
  { ticker: "EDSIND", token: "0x30cf8d7311eb32a3c189d59406547731ca8036bB", pair: "0xbe4f91B14430e335cC0c90FB4199ca58517B1E96" },
  { ticker: "TT", token: "0x96131109AF5219473A1040fBF24c37ca96DC2478", pair: "0x88F561F0c4441e63CD6087C98402b377E8214BB2" },
  { ticker: "RAJ", token: "0x253232FE8d9432a2B1b23bDD74a7e8aBf575Bf6e", pair: "0xD9A1e5282a8009121b74A81c9B734c4447474dFe" }
];

function addressToBytes32(addr) {
  return "0x" + addr.slice(2).padStart(64, "0");
}

function hexToBigInt(hex) {
  return BigInt(hex === "0x" || !hex ? 0 : hex);
}

async function checkBalances() {
  console.log("Checking balances on-chain for user:", userAddress);
  
  for (const t of tokens) {
    console.log(`\n---------------- ${t.ticker} ----------------`);
    try {
      // 1. Decimals
      const decHex = await rpc("eth_call", [{ to: t.token, data: DECIMALS_SELECTOR }, "latest"]);
      const decimals = parseInt(decHex, 16);
      console.log(`  Token Decimals: ${decimals}`);

      // 2. Token Balance
      const balData = BALANCE_OF_SELECTOR + userAddress.slice(2).padStart(64, "0");
      const balHex = await rpc("eth_call", [{ to: t.token, data: balData }, "latest"]);
      const balance = hexToBigInt(balHex);
      console.log(`  User Token Balance (raw): ${balance}`);
      console.log(`  User Token Balance: ${Number(balance) / 10**decimals}`);

      // 3. LP Token Balance
      const lpBalHex = await rpc("eth_call", [{ to: t.pair, data: balData }, "latest"]);
      const lpBalance = hexToBigInt(lpBalHex);
      console.log(`  User LP Balance (raw): ${lpBalance}`);
      console.log(`  User LP Balance: ${Number(lpBalance) / 10**18}`);

      // 4. Pair Reserves
      const resHex = await rpc("eth_call", [{ to: t.pair, data: GET_RESERVES_SELECTOR }, "latest"]);
      console.log(`  Pair Reserves Hex: ${resHex}`);
      if (resHex && resHex !== "0x") {
        const hex = resHex.startsWith("0x") ? resHex.slice(2) : resHex;
        const res0 = BigInt("0x" + hex.slice(0, 64));
        const res1 = BigInt("0x" + hex.slice(64, 128));
        console.log(`    Reserve0: ${res0}`);
        console.log(`    Reserve1: ${res1}`);
      }

    } catch (e) {
      console.error(`  Error:`, e.message);
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

checkBalances();
