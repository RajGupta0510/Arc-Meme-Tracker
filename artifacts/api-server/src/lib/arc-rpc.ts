import { logger } from "./logger";

const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  try {
    const response = await fetch(ARC_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    });

    if (!response.ok) {
      throw new Error(`Arc RPC ${method} failed with HTTP ${response.status}`);
    }

    const body = await response.json() as { result?: T; error?: { message?: string; code?: number } };
    if (body.error) {
      throw new Error(body.error.message ?? `Arc RPC ${method} failed`);
    }

    return body.result as T;
  } catch (err) {
    logger.error({ err, method, params }, "Arc RPC request failed");
    throw err;
  }
}

// ABI selectors
const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  getPair: "0xe6a43905", // getPair(address,address)
  token0: "0x0dfe1681",
  token1: "0xd21220a7",
  getReserves: "0x0902f1ac",
};

function decodeString(hex: string): string {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (cleanHex.length < 128) {
    return decodeBytes32String(cleanHex);
  }
  try {
    const lengthHex = cleanHex.slice(64, 128);
    const length = Number.parseInt(lengthHex, 16);
    if (!Number.isFinite(length) || length <= 0 || length > 1000) {
      return decodeBytes32String(cleanHex);
    }
    const charsHex = cleanHex.slice(128, 128 + length * 2);
    let str = "";
    for (let i = 0; i < charsHex.length; i += 2) {
      str += String.fromCharCode(Number.parseInt(charsHex.slice(i, i + 2), 16));
    }
    return str.trim();
  } catch {
    return decodeBytes32String(cleanHex);
  }
}

function decodeBytes32String(hex: string): string {
  let str = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = Number.parseInt(hex.slice(i, i + 2), 16);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str.trim();
}

function decodeAddress(hex: string): string {
  if (!hex || hex === "0x") {
    throw new Error("Empty address response");
  }
  return `0x${hex.slice(-40)}`.toLowerCase();
}

function padAddress(address: string): string {
  return address.replace("0x", "").toLowerCase().padStart(64, "0");
}

export async function fetchTokenMetadata(contractAddress: string) {
  try {
    const [nameHex, symbolHex, decimalsHex, supplyHex] = await Promise.all([
      rpc<string>("eth_call", [{ to: contractAddress, data: SELECTORS.name }, "latest"]),
      rpc<string>("eth_call", [{ to: contractAddress, data: SELECTORS.symbol }, "latest"]),
      rpc<string>("eth_call", [{ to: contractAddress, data: SELECTORS.decimals }, "latest"]),
      rpc<string>("eth_call", [{ to: contractAddress, data: SELECTORS.totalSupply }, "latest"]),
    ]);

    const name = decodeString(nameHex);
    const symbol = decodeString(symbolHex);
    const decimals = Number.parseInt(decimalsHex, 16);
    const totalSupplyRaw = BigInt(supplyHex);
    const totalSupply = Number(totalSupplyRaw / (10n ** BigInt(decimals)));

    return {
      name: name || symbol || "Unknown Token",
      symbol: symbol || "UNKNOWN",
      decimals,
      totalSupply,
    };
  } catch (err) {
    logger.error({ err, contractAddress }, "Failed to fetch ERC20 metadata");
    throw new Error("Could not validate ERC20 contract or fetch its metadata. Make sure it is a valid token contract.");
  }
}

// standard AMM factory and router configurations
export const AMMS = [
  {
    id: "apexiswap",
    routerAddress: "0x437b1aBf6e5a69548849b15EC35f83A73Fa1E28F",
    factoryAddress: "0x2B865487A1008D2694C1D367c761f00a564aCECb",
    wusdcAddress: "0x911b4000D3422F482F4062a913885f7b035382Df",
  },
  {
    id: "unitflow",
    routerAddress: "0x4AA8c7Ac458479d9A4FA5c1481e03061ac76824A",
    factoryAddress: "0xd67F63A4F26a497b364d1C82e6747Aec8B5743a5",
    wusdcAddress: "0xc856c3627ba9461087c4e89a058f737d5c0a545d",
  },
  {
    id: "achswap",
    routerAddress: "0xB92428D440c335546b69138F7fAF689F5ba8D436",
    factoryAddress: "0x7cC023C7184810B84657D55c1943eBfF8603B72B",
    wusdcAddress: "0xDe5DB9049a8dd344dC1B7Bbb098f9da60930A6dA",
  }
];

export async function detectMarket(tokenAddress: string) {
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  for (const amm of AMMS) {
    try {
      const data = SELECTORS.getPair + padAddress(tokenAddress) + padAddress(amm.wusdcAddress);
      const pairHex = await rpc<string>("eth_call", [{ to: amm.factoryAddress, data }, "latest"]);
      const pairAddress = decodeAddress(pairHex);

      if (pairAddress && pairAddress !== ZERO_ADDRESS) {
        const reservesHex = await rpc<string>("eth_call", [{ to: pairAddress, data: SELECTORS.getReserves }, "latest"]);
        const cleanReserves = reservesHex.startsWith("0x") ? reservesHex.slice(2) : reservesHex;
        const reserve0 = BigInt(`0x${cleanReserves.slice(0, 64)}`);
        const reserve1 = BigInt(`0x${cleanReserves.slice(64, 128)}`);

        const token0Hex = await rpc<string>("eth_call", [{ to: pairAddress, data: SELECTORS.token0 }, "latest"]);
        const token0 = decodeAddress(token0Hex);

        const tokenIsToken0 = token0 === tokenAddress.toLowerCase();
        const baseReserve = tokenIsToken0 ? reserve0 : reserve1;
        const quoteReserve = tokenIsToken0 ? reserve1 : reserve0;

        return {
          marketType: "amm_pool" as const,
          pairAddress,
          routerAddress: amm.routerAddress,
          baseReserve,
          quoteReserve,
          amm,
        };
      }
    } catch (err) {
      logger.warn({ err, tokenAddress, amm: amm.id }, "Error probing AMM market");
    }
  }

  return null;
}
