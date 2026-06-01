import { useCallback, useState } from "react";
import type { Token } from "@workspace/api-client-react";
import { parseUnits, type Eip1193Provider } from "ethers";
import { useWallet } from "@/hooks/use-wallet";
import {
  DEFAULT_ARC_AMM,
  addTokenUsdcLiquidity,
  createTokenUsdcPair,
  getBrowserSigner,
  readTokenDecimals,
  wrapNativeUsdc,
} from "@/lib/arc-amm";

export type LiquidityStatus =
  | { status: "idle" }
  | { status: "detecting-pair" }
  | { status: "creating-pair" }
  | { status: "wrapping-usdc" }
  | { status: "approving" }
  | { status: "adding-liquidity" }
  | { status: "saving-market" }
  | { status: "success"; pairAddress: string; txHash: string }
  | { status: "error"; message: string };

type CreateLiquidityParams = {
  token: Token;
  tokenAmount: string;
  wusdcAmount: string;
};

function getEthereum() {
  return typeof window !== "undefined" ? window.ethereum : undefined;
}

function getErrorMessage(error: unknown) {
  const code = (error as { code?: number })?.code;
  if (code === 4001) return "Transaction rejected in MetaMask.";

  const message = (error as { reason?: string; shortMessage?: string; message?: string })?.shortMessage
    ?? (error as { reason?: string; message?: string })?.reason
    ?? (error as { message?: string })?.message;

  return message?.slice(0, 260) || "Failed to create liquidity pool.";
}

async function saveTokenMarket(tokenId: string, pairAddress: string) {
  const response = await fetch(`/api/tokens/${encodeURIComponent(tokenId)}/market`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      marketType: "amm_pool",
      pairAddress,
      routerAddress: DEFAULT_ARC_AMM.routerAddress,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Failed to save market metadata (${response.status})`);
  }

  return response.json() as Promise<Token>;
}

export function useCreateLiquidityPool() {
  const [status, setStatus] = useState<LiquidityStatus>({ status: "idle" });
  const { state: walletState } = useWallet();
  const isOld = walletState.status === "connected" && walletState.chainId.toLowerCase() === "0x4e454153";
  const nativeDecimals = isOld ? 6 : 18;

  const reset = useCallback(() => setStatus({ status: "idle" }), []);

  const createLiquidityPool = useCallback(
    async ({ token, tokenAmount, wusdcAmount }: CreateLiquidityParams) => {
      const ethereum = getEthereum();
      if (!ethereum) {
        setStatus({ status: "error", message: "MetaMask is required to create liquidity." });
        return null;
      }

      if (!token.contractAddress) {
        setStatus({ status: "error", message: "This token has no deployed ERC20 contract address." });
        return null;
      }

      try {
        const signer = await getBrowserSigner(ethereum as unknown as Eip1193Provider);

        setStatus({ status: "detecting-pair" });
        const pairResult = await createTokenUsdcPair(token.contractAddress, DEFAULT_ARC_AMM, signer);

        setStatus({ status: "wrapping-usdc" });
        await wrapNativeUsdc(parseUnits(wusdcAmount, nativeDecimals), DEFAULT_ARC_AMM, signer);

        setStatus({ status: "approving" });
        const tokenDecimals = await readTokenDecimals(token.contractAddress, signer);

        setStatus({ status: "adding-liquidity" });
        const addLiquidityTxHash = await addTokenUsdcLiquidity({
          tokenAddress: token.contractAddress,
          tokenAmount,
          tokenDecimals,
          wusdcAmount,
          signer,
          nativeDecimals,
        });

        setStatus({ status: "saving-market" });
        const updatedToken = await saveTokenMarket(token.id, pairResult.pairAddress);

        setStatus({
          status: "success",
          pairAddress: pairResult.pairAddress,
          txHash: addLiquidityTxHash,
        });

        return updatedToken;
      } catch (error) {
        console.error("[liquidity] Failed to create TOKEN/WUSDC pool", error);
        setStatus({ status: "error", message: getErrorMessage(error) });
        return null;
      }
    },
    [],
  );

  return {
    amm: DEFAULT_ARC_AMM,
    status,
    createLiquidityPool,
    reset,
  };
}
