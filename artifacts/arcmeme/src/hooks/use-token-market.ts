import { useCallback, useEffect, useMemo, useState } from "react";
import type { Token } from "@workspace/api-client-react";
import { formatUnits } from "ethers";
import {
  DEFAULT_ARC_AMM,
  calculatePoolPrice,
  getArcReadProvider,
  getErc20Contract,
  normalizeReserves,
  readPairReserves,
  readTokenDecimals,
  type ArcAmmConfig,
  type NormalizedReserves,
} from "@/lib/arc-amm";
import { formatBalance } from "@/lib/utils";
import { useWallet } from "@/hooks/use-wallet";

export type TokenMarketState = {
  isTradeable: boolean;
  amm: ArcAmmConfig;
  tokenDecimals: number;
  reserves: NormalizedReserves | null;
  price: number | null;
  tokenBalance: string;
  lpBalance: string;
  isLoading: boolean;
  error: string | null;
};

function getMarketAmm(token: Token): ArcAmmConfig {
  return {
    ...DEFAULT_ARC_AMM,
    routerAddress: token.routerAddress || DEFAULT_ARC_AMM.routerAddress,
  };
}

function getErrorMessage(error: unknown) {
  return (error as { shortMessage?: string; message?: string })?.shortMessage
    ?? (error as { message?: string })?.message
    ?? "Failed to load market data.";
}

export function useTokenMarket(token: Token | null | undefined, walletAddress?: string) {
  const { state: walletState } = useWallet();
  const walletChainId = walletState.status === "connected" ? walletState.chainId : undefined;

  const [state, setState] = useState<TokenMarketState>(() => ({
    isTradeable: false,
    amm: token ? getMarketAmm(token) : DEFAULT_ARC_AMM,
    tokenDecimals: 18,
    reserves: null,
    price: null,
    tokenBalance: "0.000",
    lpBalance: "0.000",
    isLoading: false,
    error: null,
  }));

  const amm = useMemo(() => (token ? getMarketAmm(token) : DEFAULT_ARC_AMM), [token]);
  const isTradeable = Boolean(token?.contractAddress && token?.pairAddress && token?.marketType === "amm_pool");

  const refresh = useCallback(async () => {
    if (!token?.contractAddress || !token.pairAddress || token.marketType !== "amm_pool") {
      setState((previous) => ({
        ...previous,
        amm,
        isTradeable: false,
        reserves: null,
        price: null,
        tokenBalance: "0.000",
        lpBalance: "0.000",
        isLoading: false,
        error: null,
      }));
      return;
    }

    setState((previous) => ({ ...previous, amm, isTradeable: true, isLoading: true, error: null }));

    try {
      const provider = getArcReadProvider(walletChainId);
      const [rawReserves, tokenDecimals] = await Promise.all([
        readPairReserves(token.pairAddress, provider),
        readTokenDecimals(token.contractAddress, provider),
      ]);

      const reserves = normalizeReserves(rawReserves, token.contractAddress, amm.wusdcAddress);
      const price = calculatePoolPrice(reserves.baseReserve, reserves.quoteReserve, tokenDecimals, 18);
      let tokenBalance = "0.000";
      let lpBalance = "0.000";

      if (walletAddress) {
        const [tokenContract, pairContract] = [
          getErc20Contract(token.contractAddress, provider),
          getErc20Contract(token.pairAddress, provider),
        ];
        const [balance, lpTokenBalance] = await Promise.all([
          tokenContract.balanceOf(walletAddress),
          pairContract.balanceOf(walletAddress),
        ]);
        tokenBalance = formatBalance(formatUnits(balance, tokenDecimals));
        lpBalance = formatBalance(formatUnits(lpTokenBalance, 18));
      }

      setState({
        isTradeable: true,
        amm,
        tokenDecimals,
        reserves,
        price,
        tokenBalance,
        lpBalance,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("[market] Failed to refresh TOKEN/WUSDC market", error);
      setState((previous) => ({
        ...previous,
        amm,
        isTradeable,
        isLoading: false,
        error: getErrorMessage(error),
      }));
    }
  }, [amm, isTradeable, token?.contractAddress, token?.marketType, token?.pairAddress, walletAddress, walletChainId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isTradeable) return;
    const interval = window.setInterval(() => {
      refresh();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [isTradeable, refresh]);

  return {
    ...state,
    refresh,
  };
}
