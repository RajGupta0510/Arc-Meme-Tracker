import { useCallback, useState } from "react";
import type { Token } from "@workspace/api-client-react";
import { parseUnits, type Eip1193Provider } from "ethers";
import { useWallet } from "@/hooks/use-wallet";
import {
  DEFAULT_ARC_AMM,
  addTokenUsdcLiquidity,
  createTokenUsdcPair,
  getBrowserSigner,
  getWusdcContract,
  readTokenDecimals,
  removeTokenUsdcLiquidity,
  wrapNativeUsdc,
} from "@/lib/arc-amm";

export type LiquidityActionStatus =
  | { status: "idle" }
  | { status: "detecting-pair" }
  | { status: "wrapping-usdc" }
  | { status: "approving" }
  | { status: "adding" }
  | { status: "withdrawing" }
  | { status: "saving-market" }
  | { status: "success"; txHash: string; pairAddress: string; action: "add" | "withdraw" }
  | { status: "error"; message: string };

type AddLiquidityParams = {
  token: Token;
  tokenAmount: string;
  wusdcAmount: string;
};

type WithdrawLiquidityParams = {
  token: Token;
  lpTokenAmount: string;
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

  return message?.slice(0, 260) || "Liquidity transaction failed.";
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

export function useTokenLiquidity() {
  const [status, setStatus] = useState<LiquidityActionStatus>({ status: "idle" });
  const { state: walletState } = useWallet();
  const isOld = walletState.status === "connected" && walletState.chainId.toLowerCase() === "0x4e454153";
  const nativeDecimals = isOld ? 6 : 18;

  const reset = useCallback(() => setStatus({ status: "idle" }), []);

  const addLiquidity = useCallback(async ({ token, tokenAmount, wusdcAmount }: AddLiquidityParams) => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setStatus({ status: "error", message: "MetaMask is required to add liquidity." });
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

      const signerAddress = await signer.getAddress();
      const wusdcContract = getWusdcContract(DEFAULT_ARC_AMM.wusdcAddress, signer);
      const currentWusdcBalance = BigInt(await wusdcContract.balanceOf(signerAddress));
      const neededWusdc = parseUnits(wusdcAmount, nativeDecimals);

      if (currentWusdcBalance < neededWusdc) {
        setStatus({ status: "wrapping-usdc" });
        const amountToWrap = neededWusdc - currentWusdcBalance;
        await wrapNativeUsdc(amountToWrap, DEFAULT_ARC_AMM, signer);
      }

      setStatus({ status: "approving" });
      const tokenDecimals = await readTokenDecimals(token.contractAddress, signer);

      setStatus({ status: "adding" });
      const txHash = await addTokenUsdcLiquidity({
        tokenAddress: token.contractAddress,
        tokenAmount,
        tokenDecimals,
        wusdcAmount,
        signer,
        nativeDecimals,
      });

      if (token.pairAddress !== pairResult.pairAddress || token.marketType !== "amm_pool") {
        setStatus({ status: "saving-market" });
        await saveTokenMarket(token.id, pairResult.pairAddress);
      }

      setStatus({ status: "success", action: "add", txHash, pairAddress: pairResult.pairAddress });
      return { txHash, pairAddress: pairResult.pairAddress };
    } catch (error) {
      console.error("[liquidity] Add liquidity failed", error);
      setStatus({ status: "error", message: getErrorMessage(error) });
      return null;
    }
  }, []);

  const withdrawLiquidity = useCallback(async ({ token, lpTokenAmount }: WithdrawLiquidityParams) => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setStatus({ status: "error", message: "MetaMask is required to withdraw liquidity." });
      return null;
    }

    if (!token.contractAddress || !token.pairAddress) {
      setStatus({ status: "error", message: "This token does not have a liquidity pool yet." });
      return null;
    }

    try {
      const signer = await getBrowserSigner(ethereum as unknown as Eip1193Provider);

      setStatus({ status: "approving" });
      setStatus({ status: "withdrawing" });
      const txHash = await removeTokenUsdcLiquidity({
        tokenAddress: token.contractAddress,
        pairAddress: token.pairAddress,
        lpTokenAmount,
        signer,
      });

      setStatus({ status: "success", action: "withdraw", txHash, pairAddress: token.pairAddress });
      return { txHash, pairAddress: token.pairAddress };
    } catch (error) {
      console.error("[liquidity] Withdraw liquidity failed", error);
      setStatus({ status: "error", message: getErrorMessage(error) });
      return null;
    }
  }, []);

  return {
    amm: DEFAULT_ARC_AMM,
    status,
    addLiquidity,
    withdrawLiquidity,
    reset,
  };
}
