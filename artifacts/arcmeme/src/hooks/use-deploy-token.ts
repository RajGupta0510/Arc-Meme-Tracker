import { useState, useCallback } from "react";
import {
  BrowserProvider,
  ContractFactory,
  JsonRpcProvider,
  type Eip1193Provider,
  type InterfaceAbi,
} from "ethers";
import { MEME_TOKEN_ABI, MEME_TOKEN_BYTECODE } from "@/lib/erc20-artifact";

// ─── RPC Configuration ─────────────────────────────────────────────────────
// Edit this list to change or add RPC endpoints.
// The first URL is the primary; the rest are tried as fallbacks in order.
export const ARC_RPC_URLS = [
  "https://testnet-rpc.arcnetwork.io",
  // "https://testnet-rpc-2.arcnetwork.io",   // ← add backups here
  // "https://rpc.arcchain.dev",
];

export const ARC_TESTNET_CHAIN_ID = "0x4E454153";
export const ARC_EXPLORER = "https://testnet-explorer.arcnetwork.io";

const ARC_TESTNET_PARAMS = {
  chainId: ARC_TESTNET_CHAIN_ID,
  chainName: "Arc Network Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: ARC_RPC_URLS,
  blockExplorerUrls: [ARC_EXPLORER],
};

// ─── Status Types ──────────────────────────────────────────────────────────

export type DeployStatus =
  | { status: "idle" }
  | { status: "switching-network" }
  | { status: "confirming" }
  | { status: "deploying"; txHash: string }
  | { status: "retrying"; step: string; attempt: number; maxAttempts: number }
  | { status: "success"; contractAddress: string; txHash: string }
  | { status: "error"; message: string; isRpcError: boolean };

// ─── Retry Utilities ───────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  baseDelayMs: number,
  onRetry?: (attempt: number) => void
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Never retry a MetaMask rejection
      if ((err as { code?: number }).code === 4001) throw err;
      if (attempt < maxAttempts) {
        onRetry?.(attempt + 1);
        await sleep(baseDelayMs * attempt);
      }
    }
  }
  throw lastErr;
}

// Tries each RPC URL in order and returns the first responsive JsonRpcProvider.
async function findWorkingProvider(): Promise<JsonRpcProvider> {
  const errors: string[] = [];
  for (const url of ARC_RPC_URLS) {
    try {
      const p = new JsonRpcProvider(url);
      // Race against a 6-second timeout per RPC
      await Promise.race([
        p.getNetwork(),
        sleep(6_000).then(() => {
          throw new Error("Connection timeout");
        }),
      ]);
      return p;
    } catch (err) {
      errors.push(`${url} — ${(err as Error).message}`);
    }
  }
  throw new Error(
    `All RPC endpoints failed:\n${errors.join("\n")}\n\nAdd a working RPC to ARC_RPC_URLS in use-deploy-token.ts`
  );
}

// ─── Error Helpers ─────────────────────────────────────────────────────────

const RPC_KEYWORDS = [
  "too many errors",
  "network error",
  "timeout",
  "connection",
  "econnrefused",
  "econnreset",
  "502",
  "503",
  "503",
  "rate limit",
  "rpc",
];

export function isRpcError(err: unknown): boolean {
  const msg = ((err as { message?: string }).message ?? "").toLowerCase();
  return RPC_KEYWORDS.some((kw) => msg.includes(kw));
}

export function friendlyError(err: unknown): string {
  const raw = ((err as { message?: string }).message ?? "Unknown error").trim();
  const lower = raw.toLowerCase();
  if (lower.includes("too many errors")) {
    return "Arc Testnet RPC is overloaded and returned too many errors. All retries exhausted.";
  }
  if (lower.includes("timeout") || lower.includes("time out")) {
    return "RPC request timed out. The node may be congested — try again in a moment.";
  }
  if (lower.includes("network") || lower.includes("econnrefused") || lower.includes("econnreset")) {
    return "Cannot reach the Arc Testnet RPC endpoint. Check your internet connection or add a fallback RPC.";
  }
  if (lower.includes("502") || lower.includes("503")) {
    return "Arc Testnet RPC returned a server error (5xx). The node may be down — try a fallback RPC.";
  }
  return raw.slice(0, 250);
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useDeployToken() {
  const [deployStatus, setDeployStatus] = useState<DeployStatus>({ status: "idle" });

  const deploy = useCallback(
    async (name: string, symbol: string, totalSupply: number): Promise<string | null> => {
      const eth = (window as { ethereum?: unknown }).ethereum;
      if (!eth) {
        setDeployStatus({
          status: "error",
          message: "MetaMask not found. Install the MetaMask browser extension to deploy.",
          isRpcError: false,
        });
        return null;
      }

      const request = (eth as { request: (a: unknown) => Promise<unknown> }).request.bind(eth);

      try {
        // ── Step 1: Switch MetaMask to Arc Testnet ────────────────────────
        setDeployStatus({ status: "switching-network" });
        await withRetry(
          async () => {
            try {
              await request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: ARC_TESTNET_CHAIN_ID }],
              });
            } catch (switchErr: unknown) {
              // 4902 = chain not yet added to MetaMask
              if ((switchErr as { code?: number }).code === 4902) {
                await request({
                  method: "wallet_addEthereumChain",
                  params: [ARC_TESTNET_PARAMS],
                });
              } else {
                throw switchErr;
              }
            }
          },
          2,
          1_000,
          (attempt) =>
            setDeployStatus({
              status: "retrying",
              step: "Switching network",
              attempt,
              maxAttempts: 2,
            })
        );

        // ── Step 2: Send deployment tx through MetaMask ───────────────────
        // MetaMask must sign — no retry here (each attempt would create a new tx popup).
        setDeployStatus({ status: "confirming" });
        const browserProvider = new BrowserProvider(eth as Eip1193Provider);
        const signer = await browserProvider.getSigner();
        const factory = new ContractFactory(
          MEME_TOKEN_ABI as unknown as InterfaceAbi,
          MEME_TOKEN_BYTECODE,
          signer
        );
        const contract = await factory.deploy(name, symbol, BigInt(totalSupply));
        const txHash = contract.deploymentTransaction()?.hash ?? "";

        // ── Step 3: Wait for mining via fallback JsonRpcProvider ──────────
        // Using a direct JsonRpcProvider (not BrowserProvider) for polling
        // so we bypass MetaMask's RPC for the confirmation phase.
        setDeployStatus({ status: "deploying", txHash });

        const contractAddress = await withRetry(
          async () => {
            const provider = await findWorkingProvider();
            const receipt = await Promise.race([
              provider.waitForTransaction(txHash, 1, 120_000),
              sleep(110_000).then(() => {
                throw new Error("Transaction confirmation timeout after 110s");
              }),
            ]);
            if (!receipt) throw new Error("Transaction receipt not found");
            return receipt.contractAddress ?? (await contract.getAddress());
          },
          3,
          2_500,
          (attempt) =>
            setDeployStatus({
              status: "retrying",
              step: "Confirming on-chain",
              attempt,
              maxAttempts: 3,
            })
        );

        setDeployStatus({ status: "success", contractAddress, txHash });
        return contractAddress;
      } catch (err: unknown) {
        const code = (err as { code?: number }).code;
        if (code === 4001) {
          setDeployStatus({
            status: "error",
            message: "Transaction rejected in MetaMask. No funds were spent.",
            isRpcError: false,
          });
        } else {
          setDeployStatus({
            status: "error",
            message: friendlyError(err),
            isRpcError: isRpcError(err),
          });
        }
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => setDeployStatus({ status: "idle" }), []);

  return { deployStatus, deploy, reset };
}
