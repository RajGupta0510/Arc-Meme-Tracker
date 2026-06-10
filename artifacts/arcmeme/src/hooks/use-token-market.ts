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
  wusdcBalance: string;
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
    wusdcBalance: "0.000",
    isLoading: false,
    error: null,
  }));

  const amm = useMemo(() => (token ? getMarketAmm(token) : DEFAULT_ARC_AMM), [token]);
  const isTradeable = Boolean(token?.contractAddress && token?.pairAddress && token?.marketType === "amm_pool");

  const refresh = useCallback(async () => {
    if (!token?.contractAddress) {
      setState((previous) => ({
        ...previous,
        amm,
        isTradeable: false,
        reserves: null,
        price: null,
        tokenBalance: "0.000",
        lpBalance: "0.000",
        wusdcBalance: "0.000",
        isLoading: false,
        error: null,
      }));
      return;
    }

    setState((previous) => ({ ...previous, amm, isLoading: true, error: null }));

    try {
      const provider = getArcReadProvider(walletChainId);
      const tokenDecimals = await readTokenDecimals(token.contractAddress, provider);

      let reserves: NormalizedReserves | null = null;
      let price: number | null = null;
      let lpBalance = "0.000";

      if (token.pairAddress && token.marketType === "amm_pool") {
        const rawReserves = await readPairReserves(token.pairAddress, provider);
        reserves = normalizeReserves(rawReserves, token.contractAddress, amm.wusdcAddress);
        price = calculatePoolPrice(reserves.baseReserve, reserves.quoteReserve, tokenDecimals, 18);
      }

      let tokenBalance = "0.000";
      let wusdcBalance = "0.000";

      if (walletAddress) {
        const tokenContract = getErc20Contract(token.contractAddress, provider);
        const wusdcContract = getErc20Contract(amm.wusdcAddress, provider);

        const promises: Promise<any>[] = [
          tokenContract.balanceOf(walletAddress),
          wusdcContract.balanceOf(walletAddress),
        ];

        if (token.pairAddress) {
          const pairContract = getErc20Contract(token.pairAddress, provider);
          promises.push(pairContract.balanceOf(walletAddress));
        }

        const results = await Promise.all(promises);
        tokenBalance = formatBalance(formatUnits(results[0], tokenDecimals));
        wusdcBalance = formatBalance(formatUnits(results[1], 18));
        if (token.pairAddress) {
          lpBalance = formatBalance(formatUnits(results[2], 18));
        }
      }

      setState({
        isTradeable: Boolean(token.pairAddress && token.marketType === "amm_pool"),
        amm,
        tokenDecimals,
        reserves,
        price,
        tokenBalance,
        lpBalance,
        wusdcBalance,
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
