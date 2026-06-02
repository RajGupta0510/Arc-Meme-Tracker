import { useTokenMarket } from "./use-token-market";
import type { Token } from "@workspace/api-client-react";

export type LiveTokenData = {
  price: number;
  marketCap: number;
  change24h: number;
  volume24h: number;
  allTimeVolume: number;
  txCount: number;
  isLoading: boolean;
};

export function useLiveTokenData(token: Token): LiveTokenData {
  const market = useTokenMarket(token);
  
  // Calculate live spot price from chain if available, else fallback to db price
  const livePrice = market.price ?? token.price;
  
  // Calculate live market cap based on the live spot price
  const liveMarketCap = livePrice * token.totalSupply;
  
  // Calculate live 24h percent change based on the original 24h change and the live spot price
  // Formula:
  //   initialPrice = db_price / (1 + change24h / 100)
  //   liveChange24h = ((livePrice - initialPrice) / initialPrice) * 100
  const initialPrice = token.price / (1 + token.change24h / 100);
  const liveChange24h = initialPrice > 0 
    ? ((livePrice - initialPrice) / initialPrice) * 100 
    : token.change24h;

  return {
    price: livePrice,
    marketCap: liveMarketCap,
    change24h: liveChange24h,
    volume24h: token.volume24h,
    allTimeVolume: (token as any).allTimeVolume ?? token.volume24h, // Fallback to 24h volume if not loaded
    txCount: token.txCount,
    isLoading: market.isLoading,
  };
}
