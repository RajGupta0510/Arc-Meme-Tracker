import { useCallback, useState } from "react";
import type { Token } from "@workspace/api-client-react";
import { parseUnits, type Eip1193Provider } from "ethers";
import {
  buyTokenWithNativeUsdc,
  calculateAmountOut,
  getBrowserSigner,
  sellTokenForNativeUsdc,
  type ArcAmmConfig,
  type NormalizedReserves,
} from "@/lib/arc-amm";

export type TradeSide = "buy" | "sell";

export type TradeStatus =
  | { status: "idle" }
  | { status: "quoting" }
  | { status: "approving" }
  | { status: "confirming" }
  | { status: "success"; txHash: string }
  | { status: "error"; message: string };

type ExecuteTradeParams = {
  token: Token;
  side: TradeSide;
  amount: string;
  reserves: NormalizedReserves;
  tokenDecimals: number;
  amm: ArcAmmConfig;
  slippageBps?: number;
};

function getEthereum() {
  return typeof window !== "undefined" ? window.ethereum : undefined;
}

function applySlippage(amountOut: bigint, slippageBps: number) {
  return amountOut - (amountOut * BigInt(slippageBps)) / 10_000n;
}

function getErrorMessage(error: unknown) {
  const code = (error as { code?: number })?.code;
  if (code === 4001) return "Transaction rejected in MetaMask.";

  return (error as { shortMessage?: string; reason?: string; message?: string })?.shortMessage
    ?? (error as { reason?: string; message?: string })?.reason
    ?? (error as { message?: string })?.message
    ?? "Trade failed.";
}

export function useTokenTrade() {
  const [status, setStatus] = useState<TradeStatus>({ status: "idle" });

  const reset = useCallback(() => setStatus({ status: "idle" }), []);

  const executeTrade = useCallback(async (params: ExecuteTradeParams) => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setStatus({ status: "error", message: "MetaMask is required to trade." });
      return null;
    }

    if (!params.token.contractAddress || !params.token.pairAddress) {
      setStatus({ status: "error", message: "This token does not have a liquidity pool yet." });
      return null;
    }

    const numericAmount = Number(params.amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus({ status: "error", message: "Enter a trade amount greater than zero." });
      return null;
    }

    try {
      setStatus({ status: "quoting" });
      const signer = await getBrowserSigner(ethereum as unknown as Eip1193Provider);
      const slippageBps = params.slippageBps ?? 500;
      let txHash: string;

      if (params.side === "buy") {
        const amountIn = parseUnits(params.amount, 18);
        const quotedOut = calculateAmountOut(
          amountIn,
          params.reserves.quoteReserve,
          params.reserves.baseReserve,
        );
        const amountOutMin = applySlippage(quotedOut, slippageBps);

        if (amountOutMin <= 0n) {
          throw new Error("Pool liquidity is too low for this buy amount.");
        }

        setStatus({ status: "confirming" });
        txHash = await buyTokenWithNativeUsdc({
          tokenAddress: params.token.contractAddress,
          nativeUsdcAmount: params.amount,
          amountOutMin,
          amm: params.amm,
          signer,
        });
      } else {
        const amountIn = parseUnits(params.amount, params.tokenDecimals);
        const quotedOut = calculateAmountOut(
          amountIn,
          params.reserves.baseReserve,
          params.reserves.quoteReserve,
        );
        const amountOutMin = applySlippage(quotedOut, slippageBps);

        if (amountOutMin <= 0n) {
          throw new Error("Pool liquidity is too low for this sell amount.");
        }

        setStatus({ status: "approving" });
        txHash = await sellTokenForNativeUsdc({
          tokenAddress: params.token.contractAddress,
          tokenAmount: params.amount,
          tokenDecimals: params.tokenDecimals,
          amountOutMin,
          amm: params.amm,
          signer,
        });
      }

      setStatus({ status: "success", txHash });
      return txHash;
    } catch (error) {
      console.error("[trade] TOKEN/WUSDC swap failed", error);
      setStatus({ status: "error", message: getErrorMessage(error) });
      return null;
    }
  }, []);

  return {
    status,
    executeTrade,
    reset,
  };
}
