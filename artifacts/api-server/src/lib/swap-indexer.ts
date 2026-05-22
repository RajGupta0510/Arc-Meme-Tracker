import { getLatestTradeBlock, saveTrades, type Token, type Trade } from "./token-store";
import { logger } from "./logger";

const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const WUSDC_DECIMALS = 18;
const TOKEN_DECIMALS = 18;
const SWAP_TOPIC = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
const TOKEN0_SELECTOR = "0x0dfe1681";
const TOKEN1_SELECTOR = "0xd21220a7";
const DEFAULT_LOOKBACK_BLOCKS = Number(process.env.TRADE_INDEX_LOOKBACK_BLOCKS ?? 9_999);
const LOG_CHUNK_BLOCKS = Number(process.env.TRADE_INDEX_LOG_CHUNK_BLOCKS ?? 9_999);

type RpcLog = {
  address: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  data: string;
  topics: string[];
};

type RpcBlock = {
  timestamp: string;
};

type RpcTransaction = {
  from: string;
};

type PairTokens = {
  token0: string;
  token1: string;
};

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
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

function toHexBlock(block: number) {
  return `0x${Math.max(block, 0).toString(16)}`;
}

function hexToNumber(hex: string) {
  return Number.parseInt(hex, 16);
}

function sameAddress(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function topicToAddress(topic: string) {
  return `0x${topic.slice(-40)}`;
}

function decodeAddress(result: string) {
  if (!result || result === "0x") {
    throw new Error("Contract call returned empty address data");
  }
  return `0x${result.slice(-40)}`;
}

function decodeUint256Words(data: string) {
  const hex = data.startsWith("0x") ? data.slice(2) : data;
  if (hex.length < 64 * 4) {
    throw new Error(`Swap log data is too short: ${data}`);
  }
  const words: bigint[] = [];
  for (let offset = 0; offset < 64 * 4; offset += 64) {
    words.push(BigInt(`0x${hex.slice(offset, offset + 64)}`));
  }
  return words;
}

function formatUnits(value: bigint, decimals: number) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const integer = absolute / base;
  const fraction = absolute % base;
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  const text = fractionText ? `${integer}.${fractionText}` : integer.toString();
  return Number(negative ? `-${text}` : text);
}

async function readPairTokens(pairAddress: string): Promise<PairTokens> {
  try {
    const [token0, token1] = await Promise.all([
      rpc<string>("eth_call", [{ to: pairAddress, data: TOKEN0_SELECTOR }, "latest"]),
      rpc<string>("eth_call", [{ to: pairAddress, data: TOKEN1_SELECTOR }, "latest"]),
    ]);

    const tokens = {
      token0: decodeAddress(token0),
      token1: decodeAddress(token1),
    };
    logger.info({ pairAddress, ...tokens }, "Read pair token ordering");
    return tokens;
  } catch (err) {
    logger.error({ err, pairAddress }, "Failed to read pair token0/token1");
    throw err;
  }
}

async function getLatestBlockNumber() {
  return hexToNumber(await rpc<string>("eth_blockNumber", []));
}

async function getBlockTimestamp(blockNumber: number, cache: Map<number, string>) {
  const cached = cache.get(blockNumber);
  if (cached) return cached;

  try {
    const block = await rpc<RpcBlock>("eth_getBlockByNumber", [toHexBlock(blockNumber), false]);
    const timestamp = new Date(hexToNumber(block.timestamp) * 1000).toISOString();
    cache.set(blockNumber, timestamp);
    return timestamp;
  } catch (err) {
    const fallback = new Date().toISOString();
    logger.warn({ err, blockNumber, fallback }, "Timestamp fetch failed; using fallback timestamp");
    cache.set(blockNumber, fallback);
    return fallback;
  }
}

async function getTransactionSender(txHash: string, cache: Map<string, string>) {
  const cached = cache.get(txHash);
  if (cached) return cached;

  try {
    const tx = await rpc<RpcTransaction>("eth_getTransactionByHash", [txHash]);
    const sender = tx.from;
    cache.set(txHash, sender);
    return sender;
  } catch (err) {
    logger.warn({ err, txHash }, "Transaction sender fetch failed; using zero address");
    const fallback = "0x0000000000000000000000000000000000000000";
    cache.set(txHash, fallback);
    return fallback;
  }
}

function decodeSwapLog(token: Token, pairTokens: PairTokens, log: RpcLog, timestamp: string, traderAddress: string): Trade | null {
  if (!token.contractAddress || !token.pairAddress) {
    logger.warn({ tokenId: token.id, txHash: log.transactionHash }, "Skipped log because token has no contract or pair address");
    return null;
  }

  const [amount0In, amount1In, amount0Out, amount1Out] = decodeUint256Words(log.data);
  const tokenIsToken0 = sameAddress(pairTokens.token0, token.contractAddress);
  const tokenIsToken1 = sameAddress(pairTokens.token1, token.contractAddress);
  if (!tokenIsToken0 && !tokenIsToken1) {
    logger.warn(
      { tokenId: token.id, contractAddress: token.contractAddress, pairTokens, txHash: log.transactionHash },
      "Skipped log because token contract is not token0/token1",
    );
    return null;
  }

  const tokenAmountRaw = tokenIsToken0
    ? amount0In > 0n ? amount0In : amount0Out
    : amount1In > 0n ? amount1In : amount1Out;
  const wusdcAmountRaw = tokenIsToken0
    ? amount1In > 0n ? amount1In : amount1Out
    : amount0In > 0n ? amount0In : amount0Out;
  const tokenOut = tokenIsToken0 ? amount0Out > 0n : amount1Out > 0n;
  const side = tokenOut ? "buy" : "sell";
  const tokenAmount = formatUnits(tokenAmountRaw, TOKEN_DECIMALS);
  const wusdcAmount = formatUnits(wusdcAmountRaw, WUSDC_DECIMALS);
  const executionPrice = tokenAmount > 0 ? wusdcAmount / tokenAmount : 0;

  if (tokenAmount <= 0 || wusdcAmount <= 0 || executionPrice <= 0) {
    logger.warn(
      { tokenId: token.id, txHash: log.transactionHash, tokenAmount, wusdcAmount, executionPrice },
      "Skipped decoded swap with invalid amounts",
    );
    return null;
  }

  const trade: Trade = {
    id: `${log.transactionHash}-${hexToNumber(log.logIndex)}`,
    tokenId: token.id,
    pairAddress: token.pairAddress,
    txHash: log.transactionHash,
    logIndex: hexToNumber(log.logIndex),
    blockNumber: hexToNumber(log.blockNumber),
    side,
    tokenAmount,
    wusdcAmount,
    executionPrice,
    traderAddress,
    timestamp,
  };
  logger.info({ trade }, "Indexed trade");
  return trade;
}

async function fetchSwapLogs(pairAddress: string, fromBlock: number, toBlock: number) {
  const logs: RpcLog[] = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK_BLOCKS) {
    const end = Math.min(start + LOG_CHUNK_BLOCKS - 1, toBlock);
    try {
      const chunk = await rpc<RpcLog[]>("eth_getLogs", [{
        address: pairAddress,
        fromBlock: toHexBlock(start),
        toBlock: toHexBlock(end),
        topics: [SWAP_TOPIC],
      }]);
      logger.info(
        {
          pairAddress,
          fromBlock: start,
          toBlock: end,
          count: chunk.length,
          sample: chunk.slice(0, 3).map((log) => ({
            blockNumber: hexToNumber(log.blockNumber),
            txHash: log.transactionHash,
            logIndex: hexToNumber(log.logIndex),
            topics: log.topics,
            dataLength: log.data.length,
          })),
        },
        "Fetched swap log chunk",
      );
      logs.push(...chunk);
    } catch (err) {
      logger.error({ err, pairAddress, fromBlock: start, toBlock: end }, "Failed to fetch swap log chunk");
    }
  }
  return logs;
}

async function logRawPairLogs(pairAddress: string, fromBlock: number, toBlock: number) {
  try {
    const rawLogs = await rpc<RpcLog[]>("eth_getLogs", [{
      address: pairAddress,
      fromBlock: toHexBlock(fromBlock),
      toBlock: toHexBlock(toBlock),
    }]);
    logger.warn(
      {
        pairAddress,
        fromBlock,
        toBlock,
        count: rawLogs.length,
        sample: rawLogs.slice(0, 10).map((log) => ({
          blockNumber: hexToNumber(log.blockNumber),
          txHash: log.transactionHash,
          logIndex: hexToNumber(log.logIndex),
          topic0: log.topics[0],
          topics: log.topics,
          dataLength: log.data.length,
        })),
      },
      "No Swap logs found; raw pair log probe",
    );
  } catch (err) {
    logger.error({ err, pairAddress, fromBlock, toBlock }, "Raw pair log probe failed");
  }
}

export async function indexTokenSwapEvents(token: Token) {
  if (token.marketType !== "amm_pool" || !token.pairAddress || !token.contractAddress) {
    return { indexed: 0, inserted: 0 };
  }

  const latestBlock = await getLatestBlockNumber();
  const latestStoredBlock = getLatestTradeBlock(token.id);
  const recentWindowStart = Math.max(0, latestBlock - DEFAULT_LOOKBACK_BLOCKS);
  const fromBlock = latestStoredBlock === null
    ? recentWindowStart
    : Math.max(recentWindowStart, latestStoredBlock - 5);
  const toBlock = latestBlock;

  logger.info(
    {
      tokenId: token.id,
      pairAddress: token.pairAddress,
      contractAddress: token.contractAddress,
      latestStoredBlock,
      fromBlock,
      toBlock,
      swapTopic: SWAP_TOPIC,
    },
    "Starting swap event indexing",
  );

  const pairTokens = await readPairTokens(token.pairAddress);
  const logs = await fetchSwapLogs(token.pairAddress, fromBlock, toBlock);

  logger.info({ tokenId: token.id, pairAddress: token.pairAddress, count: logs.length }, "Fetched total swap logs");
  if (logs.length === 0) {
    await logRawPairLogs(token.pairAddress, fromBlock, toBlock);
  }

  const blockTimestampCache = new Map<number, string>();
  const txSenderCache = new Map<string, string>();
  const trades: Trade[] = [];

  for (const log of logs) {
    try {
      const blockNumber = hexToNumber(log.blockNumber);
      const [timestamp, txSender] = await Promise.all([
        getBlockTimestamp(blockNumber, blockTimestampCache),
        getTransactionSender(log.transactionHash, txSenderCache),
      ]);
      const recipient = log.topics[2] ? topicToAddress(log.topics[2]) : txSender;
      const traderAddress = sameAddress(txSender, token.routerAddress ?? "") ? recipient : txSender;
      const trade = decodeSwapLog(token, pairTokens, log, timestamp, traderAddress);
      if (trade) trades.push(trade);
    } catch (err) {
      logger.error(
        { err, tokenId: token.id, pairAddress: token.pairAddress, txHash: log.transactionHash, logIndex: log.logIndex },
        "Decode error; skipped swap log",
      );
    }
  }

  return {
    indexed: trades.length,
    inserted: saveTrades(trades),
  };
}
