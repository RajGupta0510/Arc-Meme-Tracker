import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(moduleDir, "..", "data", "arcmeme.sqlite");

const db = new DatabaseSync(dbPath);

console.log("Testing insert without OR IGNORE...");

try {
  // Let's try to insert one of the MG trades that we know exists
  // MG pairAddress: 0x35A2740BEaA7732cE2D16ba499033D83934aaDAe
  // TxHash: 0xc9f6686f0ac4656823c6b6d1bb9a52666597216b689c7418155372eba2f5c53a
  // LogIndex: 19 (0x13)
  const trade = {
    $id: "0xc9f6686f0ac4656823c6b6d1bb9a52666597216b689c7418155372eba2f5c53a-19",
    $tokenId: " mg-1779112057970",
    $pairAddress: "0x35A2740BEaA7732cE2D16ba499033D83934aaDAe",
    $txHash: "0xc9f6686f0ac4656823c6b6d1bb9a52666597216b689c7418155372eba2f5c53a",
    $logIndex: 19,
    $blockNumber: 43832183,
    $side: "buy",
    $tokenAmount: 830487.776,
    $wusdcAmount: 0.5,
    $executionPrice: 0.000000602,
    $traderAddress: "0xef0642c9d173db4be17eb19e8d6c74eb86d1f2bc",
    $timestamp: "2026-05-27T09:58:12.000Z"
  };

  db.prepare(`
    INSERT INTO trades (
      id, tokenId, pairAddress, txHash, logIndex, blockNumber, side,
      tokenAmount, wusdcAmount, executionPrice, traderAddress, timestamp
    )
    VALUES (
      $id, $tokenId, $pairAddress, $txHash, $logIndex, $blockNumber, $side,
      $tokenAmount, $wusdcAmount, $executionPrice, $traderAddress, $timestamp
    )
  `).run(trade);

  console.log("Success! Trade inserted.");
} catch (err) {
  console.error("Insert failed with error:", err);
}
