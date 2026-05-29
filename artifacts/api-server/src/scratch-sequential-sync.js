import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(moduleDir, "..", "data", "arcmeme.sqlite");

const db = new DatabaseSync(dbPath);
const tokens = db.prepare("SELECT * FROM tokens WHERE pairAddress IS NOT NULL AND pairAddress != ''").all();

console.log("Found active tokens to sync:", tokens.map(t => t.ticker));

const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const WUSDC_DECIMALS = 18;
const TOKEN_DECIMALS = 18;
const SWAP_TOPIC = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
const TOKEN0_SELECTOR = "0x0dfe1681";
const TOKEN1_SELECTOR = "0xd21220a7";

// Helper rpc function
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

function toHexBlock(block) {
  return `0x${Math.max(block, 0).toString(16)}`;
}

function hexToNumber(hex) {
  return parseInt(hex, 16);
}

function sameAddress(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

function topicToAddress(topic) {
  return `0x${topic.slice(-40)}`;
}

function decodeAddress(result) {
  return `0x${result.slice(-40)}`;
}

function decodeUint256Words(data) {
  const hex = data.startsWith("0x") ? data.slice(2) : data;
  const words = [];
  for (let offset = 0; offset < 64 * 4; offset += 64) {
    words.push(BigInt(`0x${hex.slice(offset, offset + 64)}`));
  }
  return words;
}

function formatUnits(value, decimals) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const integer = absolute / base;
  const fraction = absolute % base;
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  const text = fractionText ? `${integer}.${fractionText}` : integer.toString();
  return Number(negative ? `-${text}` : text);
}

async function readPairTokens(pairAddress) {
  const [token0, token1] = await Promise.all([
    rpc("eth_call", [{ to: pairAddress, data: TOKEN0_SELECTOR }, "latest"]),
    rpc("eth_call", [{ to: pairAddress, data: TOKEN1_SELECTOR }, "latest"]),
  ]);
  return {
    token0: decodeAddress(token0),
    token1: decodeAddress(token1),
  };
}

async function getBlockTimestamp(blockNumber, cache) {
  if (cache.has(blockNumber)) return cache.get(blockNumber);
  const block = await rpc("eth_getBlockByNumber", [toHexBlock(blockNumber), false]);
  const timestamp = new Date(hexToNumber(block.timestamp) * 1000).toISOString();
  cache.set(blockNumber, timestamp);
  return timestamp;
}

async function getTransactionSender(txHash, cache) {
  if (cache.has(txHash)) return cache.get(txHash);
  const tx = await rpc("eth_getTransactionByHash", [txHash]);
  const sender = tx.from;
  cache.set(txHash, sender);
  return sender;
}

const insertTradeStatement = db.prepare(`
  INSERT OR IGNORE INTO trades (
    id, tokenId, pairAddress, txHash, logIndex, blockNumber, side,
    tokenAmount, wusdcAmount, executionPrice, traderAddress, timestamp
  )
  VALUES (
    $id, $tokenId, $pairAddress, $txHash, $logIndex, $blockNumber, $side,
    $tokenAmount, $wusdcAmount, $executionPrice, $traderAddress, $timestamp
  )
`);

async function syncSequentially() {
  const latestBlock = hexToNumber(await rpc("eth_blockNumber", []));
  const maxLookback = 1500000;
  const fromBlock = Math.max(0, latestBlock - maxLookback);
  const toBlock = latestBlock;

  const CHUNK_SIZE = 9000;

  for (const t of tokens) {
    console.log(`\n=== Syncing ${t.ticker} (${t.id}) ===`);
    try {
      const pairTokens = await readPairTokens(t.pairAddress);
      console.log(`Pair tokens:`, pairTokens);

      const logs = [];
      for (let s = fromBlock; s <= toBlock; s += CHUNK_SIZE) {
        const e = Math.min(s + CHUNK_SIZE - 1, toBlock);
        process.stdout.write(`  Scanning chunk ${s} to ${e}... `);
        try {
          const chunk = await rpc("eth_getLogs", [{
            address: t.pairAddress,
            fromBlock: toHexBlock(s),
            toBlock: toHexBlock(e),
            topics: [SWAP_TOPIC],
          }]);
          console.log(`found ${chunk.length} logs.`);
          logs.push(...chunk);
        } catch (err) {
          console.log(`error: ${err.message}`);
        }
        // sleep a tiny bit to be gentle on RPC
        await new Promise(r => setTimeout(r, 50));
      }

      console.log(`Total swap logs found for ${t.ticker}: ${logs.length}`);

      const timestampCache = new Map();
      const senderCache = new Map();
      let inserted = 0;

      for (const log of logs) {
        try {
          const blockNumber = hexToNumber(log.blockNumber);
          const [timestamp, txSender] = await Promise.all([
            getBlockTimestamp(blockNumber, timestampCache),
            getTransactionSender(log.transactionHash, senderCache),
          ]);
          const logIndex = hexToNumber(log.logIndex);

          const [amount0In, amount1In, amount0Out, amount1Out] = decodeUint256Words(log.data);
          const tokenIsToken0 = sameAddress(pairTokens.token0, t.contractAddress);

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

          if (tokenAmount <= 0 || wusdcAmount <= 0 || executionPrice <= 0) continue;

          const recipient = log.topics[2] ? topicToAddress(log.topics[2]) : txSender;
          const traderAddress = sameAddress(txSender, t.routerAddress ?? "") ? recipient : txSender;

          const tradeId = `${log.transactionHash}-${logIndex}`;

          const result = insertTradeStatement.run({
            $id: tradeId,
            $tokenId: t.id,
            $pairAddress: t.pairAddress,
            $txHash: log.transactionHash,
            $logIndex: logIndex,
            $blockNumber: blockNumber,
            $side: side,
            $tokenAmount: tokenAmount,
            $wusdcAmount: wusdcAmount,
            $executionPrice: executionPrice,
            $traderAddress: traderAddress,
            $timestamp: timestamp,
          });

          inserted += Number(result.changes);
        } catch (err) {
          console.error(`  Error decoding log in block ${hexToNumber(log.blockNumber)}:`, err.message);
        }
      }

      console.log(`Saved ${inserted} new trades for ${t.ticker}!`);
    } catch (e) {
      console.error(`Failed to sync ${t.ticker}:`, e.message);
    }
  }

  console.log("\n=== Sequential Sync Complete! ===");
}

syncSequentially();
