import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { Wallet } from "ethers";
import { eq, and, desc, asc, sql, isNotNull, ne } from "drizzle-orm";
import { db } from "@workspace/db";
export { db };
import {
  tokensTable,
  tradesTable,
  commentsTable,
  reactionsTable,
  copytradeWalletsTable,
  copytradeTargetsTable,
  copytradeActionsTable,
} from "@workspace/db";
import { logger } from "./logger";

export type Token = {
  id: string;
  name: string;
  ticker: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  description: string;
  createdAt: string;
  creatorAddress: string;
  logoColor: string;
  logoUrl: string | null;
  contractAddress: string | null;
  marketType: "unlisted" | "amm_pool";
  pairAddress: string | null;
  routerAddress: string | null;
  totalSupply: number;
  holders: number;
  txCount: number;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  momentumScore?: number;
  trustScore?: number;
  creatorHoldingPercent?: number;
  riskFlags?: string;
  signals?: string;
  hypeScore?: number;
  allTimeVolume?: number;
};

export type Trade = {
  id: string;
  tokenId: string;
  pairAddress: string;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  side: "buy" | "sell";
  tokenAmount: number;
  wusdcAmount: number;
  executionPrice: number;
  traderAddress: string;
  timestamp: string;
};

export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type TokenInput = Omit<Token, "id" | "createdAt" | "marketType" | "pairAddress" | "routerAddress"> & {
  id?: string;
  createdAt?: string;
  marketType?: Token["marketType"];
  pairAddress?: string | null;
  routerAddress?: string | null;
};

const seedTokens: Token[] = [
  {
    id: "arcdog",
    name: "ARC DOG",
    ticker: "ARCDOG",
    price: 0.0000421,
    marketCap: 42100,
    volume24h: 18500,
    change24h: 142.7,
    description: "The first and original meme dog of the Arc Network. ARCDOG is the mascot of the degen revolution on Arc. Diamond hands only.",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    creatorAddress: "arc1xKp9...f3Ra",
    logoColor: "#f59e0b",
    logoUrl: null,
    contractAddress: null,
    marketType: "unlisted",
    pairAddress: null,
    routerAddress: null,
    totalSupply: 1000000000,
    holders: 2847,
    txCount: 14203,
    website: "https://arcdog.fun",
    twitter: "@arcdogofficial",
    telegram: "t.me/arcdogfun",
  },
  {
    id: "mooncat",
    name: "MOON CAT",
    ticker: "MCAT",
    price: 0.00000891,
    marketCap: 8910,
    volume24h: 4200,
    change24h: 67.3,
    description: "Moon Cat is going to the moon and beyond. The most based feline on Arc Network. Meow to the moon.",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    creatorAddress: "arc1mNz3...h7Qx",
    logoColor: "#8b5cf6",
    logoUrl: null,
    contractAddress: null,
    marketType: "unlisted",
    pairAddress: null,
    routerAddress: null,
    totalSupply: 1000000000,
    holders: 1203,
    txCount: 6789,
    website: null,
    twitter: "@mooncatarc",
    telegram: null,
  },
  {
    id: "pepearc",
    name: "PEPE ARC",
    ticker: "PARCE",
    price: 0.0000178,
    marketCap: 17800,
    volume24h: 9100,
    change24h: -12.4,
    description: "Pepe found his new home on Arc Network. The most powerful frog in all of crypto has arrived. Feels good man.",
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    creatorAddress: "arc1pQ7s...w2Yx",
    logoColor: "#22c55e",
    logoUrl: null,
    contractAddress: null,
    marketType: "unlisted",
    pairAddress: null,
    routerAddress: null,
    totalSupply: 420690000000,
    holders: 3421,
    txCount: 21045,
    website: "https://pepearc.xyz",
    twitter: "@pepearc",
    telegram: "t.me/pepearc",
  },
  {
    id: "rugpull",
    name: "DEFINITELY NOT RUG",
    ticker: "NOTRUG",
    price: 0.000000341,
    marketCap: 341,
    volume24h: 890,
    change24h: -89.2,
    description: "We promise this is not a rug. 100% safu. Dev wallet locked. Liquidity burned. Trust us bro.",
    createdAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
    creatorAddress: "arc1eRf2...k9Lm",
    logoColor: "#ef4444",
    logoUrl: null,
    contractAddress: null,
    marketType: "unlisted",
    pairAddress: null,
    routerAddress: null,
    totalSupply: 1000000000000,
    holders: 47,
    txCount: 203,
    website: null,
    twitter: null,
    telegram: null,
  },
  {
    id: "arcwojak",
    name: "ARC WOJAK",
    ticker: "WOJAK",
    price: 0.00000562,
    marketCap: 5620,
    volume24h: 3400,
    change24h: 23.1,
    description: "The eternal wojak, now immortalized on Arc Network. Every up, every down, we feel it together. Wagmi.",
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    creatorAddress: "arc1wRt5...p4Ks",
    logoColor: "#3b82f6",
    logoUrl: null,
    contractAddress: null,
    marketType: "unlisted",
    pairAddress: null,
    routerAddress: null,
    totalSupply: 1000000000,
    holders: 892,
    txCount: 4512,
    website: null,
    twitter: "@arcwojak",
    telegram: "t.me/arcwojak",
  },
  {
    id: "shiberc",
    name: "SHIB ARC",
    ticker: "SHIBARC",
    price: 0.00000124,
    marketCap: 1240,
    volume24h: 720,
    change24h: 5.8,
    description: "Shiba Inu found a new blockchain. SHIBARC - the Arc killer dog. Much wow, very Arc, such degen.",
    createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    creatorAddress: "arc1sHb8...c3Dq",
    logoColor: "#f97316",
    logoUrl: null,
    contractAddress: null,
    marketType: "unlisted",
    pairAddress: null,
    routerAddress: null,
    totalSupply: 1000000000000000,
    holders: 412,
    txCount: 1893,
    website: "https://shibarc.io",
    twitter: "@shibarcofficial",
    telegram: "t.me/shibarc",
  },
  {
    id: "bonkarc",
    name: "BONK ARC",
    ticker: "BONKARC",
    price: 0.0000067,
    marketCap: 6700,
    volume24h: 5100,
    change24h: 88.4,
    description: "BONK has bonked its way to Arc Network. Grab your bat and bonk all the non-believers. Bonk or be bonked.",
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    creatorAddress: "arc1bKn1...r7Pz",
    logoColor: "#eab308",
    logoUrl: null,
    contractAddress: null,
    marketType: "unlisted",
    pairAddress: null,
    routerAddress: null,
    totalSupply: 100000000000,
    holders: 1678,
    txCount: 8934,
    website: null,
    twitter: "@bonkarc",
    telegram: "t.me/bonkarc",
  },
  {
    id: "arcmoon",
    name: "ARC MOON",
    ticker: "ARCMOON",
    price: 0.0000923,
    marketCap: 92300,
    volume24h: 41200,
    change24h: 204.5,
    description: "ARC MOON is the first token on Arc Network to be sent to the actual moon. NASA partnership coming soon (maybe). Wen moon? NOW moon.",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    creatorAddress: "arc1aMn6...z1Vw",
    logoColor: "#a855f7",
    logoUrl: null,
    contractAddress: null,
    marketType: "unlisted",
    pairAddress: null,
    routerAddress: null,
    totalSupply: 1000000000,
    holders: 4231,
    txCount: 31204,
    website: "https://arcmoon.fun",
    twitter: "@arcmoonofficial",
    telegram: "t.me/arcmoon",
  },
  {
    id: "degencat",
    name: "DEGEN CAT",
    ticker: "DCAT",
    price: 0.0000034,
    marketCap: 3400,
    volume24h: 1890,
    change24h: -34.2,
    description: "The most degen cat in all of crypto. 100x guaranteed* (*not financial advice). Wen lambo? Wen moon? All of the above.",
    createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    creatorAddress: "arc1dCt4...n8Jb",
    logoColor: "#06b6d4",
    logoUrl: null,
    contractAddress: null,
    marketType: "unlisted",
    pairAddress: null,
    routerAddress: null,
    totalSupply: 1000000000,
    holders: 623,
    txCount: 2891,
    website: null,
    twitter: "@degencat_arc",
    telegram: null,
  },
  {
    id: "arcfloki",
    name: "ARC FLOKI",
    ticker: "AFLOKI",
    price: 0.00000782,
    marketCap: 7820,
    volume24h: 3670,
    change24h: 41.9,
    description: "Floki has conquered the Arc blockchain. The viking dog of Arc Network. To Valhalla with your bags.",
    createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    creatorAddress: "arc1fLk7...m2St",
    logoColor: "#ec4899",
    logoUrl: null,
    contractAddress: null,
    marketType: "unlisted",
    pairAddress: null,
    routerAddress: null,
    totalSupply: 100000000,
    holders: 1102,
    txCount: 5621,
    website: "https://arcfloki.io",
    twitter: "@arcfloki",
    telegram: "t.me/arcfloki",
  },
];

const launchedTokenWhere = and(
  isNotNull(tokensTable.contractAddress),
  ne(tokensTable.contractAddress, ""),
  isNotNull(tokensTable.pairAddress),
  ne(tokensTable.pairAddress, "")
);

function rowToToken(row: any): Token {
  const id = row.id;
  const change24h = row.change24h;
  const volume24h = row.volume24h;
  const marketCap = row.marketCap;

  let momentum = Math.round(50 + change24h * 0.15 + Math.log1p(volume24h) * 2);
  momentum = Math.min(99, Math.max(10, momentum));

  let trust = id === "rugpull" ? 12 : Math.round(85 - (id.length % 5) + Math.min(10, Math.log1p(marketCap) * 0.5));
  trust = Math.min(99, Math.max(5, trust));

  const creatorHolding = id === "rugpull" ? 82.5 : Number((2.5 + (id.charCodeAt(0) % 8)).toFixed(1));

  const flagsList = [];
  if (id === "rugpull") {
    flagsList.push("creator_concentration", "unlocked_liquidity", "honeypot_risk");
  } else {
    if (marketCap < 2000) flagsList.push("low_liquidity");
    if (creatorHolding > 8) flagsList.push("medium_concentration");
  }
  const riskFlags = flagsList.join(",");

  const signalsList = [];
  if (momentum > 75) signalsList.push("fresh_momentum");
  if (volume24h > 15000) signalsList.push("volume_spike");
  if (change24h > 100) signalsList.push("price_surge");
  if (id === "arcdog") signalsList.push("whale_buys");
  if (id === "bonkarc") signalsList.push("liquidity_surge");
  const signals = signalsList.join(",");

  return {
    ...row,
    marketType: row.marketType === "amm_pool" ? "amm_pool" : "unlisted",
    momentumScore: row.momentumScore ?? momentum,
    trustScore: row.trustScore ?? trust,
    creatorHoldingPercent: row.creatorHoldingPercent ?? creatorHolding,
    riskFlags: row.riskFlags || riskFlags,
    signals: row.signals || signals,
    hypeScore: row.hypeScore ?? (id.charCodeAt(0) % 25),
  };
}

function rowToTrade(row: any): Trade {
  return {
    ...row,
    side: row.side === "sell" ? "sell" : "buy",
  };
}

export async function saveToken(token: Token) {
  await db.insert(tokensTable)
    .values(token)
    .onConflictDoUpdate({
      target: tokensTable.id,
      set: token,
    });
}

export async function saveTrades(trades: Trade[]): Promise<number> {
  if (trades.length === 0) return 0;
  let inserted = 0;
  for (const trade of trades) {
    try {
      const res = await db.insert(tradesTable)
        .values(trade)
        .onConflictDoNothing();
      // On Pg pool inserts, check if execution succeeded
      inserted++;
    } catch (e) {
      // Ignore conflict
    }
  }

  // Recalculate stats for each unique token in the saved trades
  const tokenIds = [...new Set(trades.map((t) => t.tokenId))];
  for (const tokenId of tokenIds) {
    await updateTokenMarketStats(tokenId);
  }
  return inserted;
}

const cachedRankings: Record<string, { timestamp: number; data: Token[] }> = {};

export async function getRecentTradeStats(hours = 24): Promise<Record<string, any>> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  try {
    const rows = await db.select({
      tokenId: tradesTable.tokenId,
      txs1h: sql<number>`COUNT(*)`,
      vol1h: sql<number>`SUM(${tradesTable.wusdcAmount})`,
      buys1h: sql<number>`SUM(CASE WHEN ${tradesTable.side} = 'buy' THEN 1 ELSE 0 END)`,
      sells1h: sql<number>`SUM(CASE WHEN ${tradesTable.side} = 'sell' THEN 1 ELSE 0 END)`,
    })
    .from(tradesTable)
    .where(sql`${tradesTable.timestamp} >= ${cutoff}`)
    .groupBy(tradesTable.tokenId);

    const stats: Record<string, any> = {};
    for (const row of rows) {
      stats[row.tokenId] = {
        tokenId: row.tokenId,
        txs1h: Number(row.txs1h),
        vol1h: Number(row.vol1h || 0),
        buys1h: Number(row.buys1h),
        sells1h: Number(row.sells1h),
      };
    }
    return stats;
  } catch (err) {
    return {};
  }
}

export async function listTokens(sort = "trending", limit = 50): Promise<Token[]> {
  const now = Date.now();
  const cacheKey = `${sort}_${limit}`;
  if (cachedRankings[cacheKey] && now - cachedRankings[cacheKey].timestamp < 5000) {
    return cachedRankings[cacheKey].data;
  }

  const rows = await db.select().from(tokensTable).where(launchedTokenWhere);

  // Fetch all-time volumes for all tokens using a single aggregate query
  let volumeMap: Record<string, number> = {};
  try {
    const volumeRows = await db.select({
      tokenId: tradesTable.tokenId,
      totalVolume: sql<number>`SUM(${tradesTable.wusdcAmount})`,
    })
    .from(tradesTable)
    .groupBy(tradesTable.tokenId);

    for (const vRow of volumeRows) {
      volumeMap[vRow.tokenId] = Number(vRow.totalVolume || 0);
    }
  } catch (err) {
    logger.error({ err }, "Failed to fetch aggregate all-time volumes");
  }

  const allTokens: Token[] = rows.map((row) => {
    const token = rowToToken(row);
    return {
      ...token,
      allTimeVolume: volumeMap[token.id] ?? 0,
    };
  });

  let sorted: Token[] = [];

  if (sort === "newest") {
    sorted = allTokens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sort === "marketCap") {
    sorted = allTokens.sort((a, b) => b.marketCap - a.marketCap);
  } else if (sort === "volume") {
    sorted = allTokens.sort((a, b) => b.volume24h - a.volume24h);
  } else if (sort === "topGainers") {
    sorted = allTokens.sort((a, b) => b.change24h - a.change24h);
  } else if (sort === "mostActive") {
    const recentStats = await getRecentTradeStats(24);
    sorted = allTokens.sort((a, b) => {
      const aRecent = recentStats[a.id]?.txs1h ?? 0;
      const bRecent = recentStats[b.id]?.txs1h ?? 0;
      const aScore = aRecent * 10 + a.txCount;
      const bScore = bRecent * 10 + b.txCount;
      return bScore - aScore;
    });
  } else {
    const recentStats = await getRecentTradeStats(6);
    sorted = allTokens.sort((a, b) => {
      const aStats = recentStats[a.id];
      const bStats = recentStats[b.id];

      const calculateScore = (token: Token, stats?: any) => {
        let score = 0;
        score += Math.log1p(token.volume24h) * 15;

        if (stats && stats.vol1h > 0) {
          score += Math.log1p(stats.vol1h) * 30;
        }

        if (token.change24h > 0) {
          score += Math.min(token.change24h, 100) * 2;
        } else if (token.change24h < 0) {
          score += Math.max(token.change24h, -50) * 0.5;
        }

        score += Math.log1p(token.txCount) * 5;
        if (stats && stats.txs1h > 0) {
          score += stats.txs1h * 10;
          const ratio = stats.buys1h / (stats.sells1h + 1);
          score += Math.min(ratio, 10) * 25;
        }

        score += Math.log1p(token.holders) * 8;
        return score;
      };

      const aScore = calculateScore(a, aStats);
      const bScore = calculateScore(b, bStats);
      return bScore - aScore;
    });
  }

  const result = sorted.slice(0, limit);
  cachedRankings[cacheKey] = { timestamp: now, data: result };
  return result;
}

export async function getTokenByContract(contractAddress: string): Promise<Token | null> {
  try {
    const rows = await db.select().from(tokensTable)
      .where(sql`LOWER(${tokensTable.contractAddress}) = LOWER(${contractAddress})`);
    return rows[0] ? rowToToken(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function getTokens(): Promise<Token[]> {
  const rows = await db.select().from(tokensTable).where(launchedTokenWhere);
  return rows.map(rowToToken);
}

export async function getAllTokens(): Promise<Token[]> {
  const rows = await db.select().from(tokensTable);
  return rows.map(rowToToken);
}

export async function listTrades(tokenId: string, limit = 50): Promise<Trade[]> {
  const rows = await db.select().from(tradesTable)
    .where(eq(tradesTable.tokenId, tokenId))
    .orderBy(desc(tradesTable.blockNumber), desc(tradesTable.logIndex))
    .limit(limit);
  return rows.map(rowToTrade);
}

const candleIntervalSeconds: Record<CandleInterval, number> = {
  "1m": 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1h": 60 * 60,
  "4h": 4 * 60 * 60,
  "1d": 24 * 60 * 60,
};

export function isCandleInterval(value: unknown): value is CandleInterval {
  return typeof value === "string" && value in candleIntervalSeconds;
}

export async function listCandles(tokenId: string, interval: CandleInterval): Promise<Candle[]> {
  const trades = await db.select().from(tradesTable)
    .where(eq(tradesTable.tokenId, tokenId))
    .orderBy(asc(tradesTable.blockNumber), asc(tradesTable.logIndex));

  const bucketSeconds = candleIntervalSeconds[interval];
  const buckets = new Map<number, Candle>();

  for (const trade of trades.map(rowToTrade)) {
    const tradeTime = Math.floor(new Date(trade.timestamp).getTime() / 1000);
    if (!Number.isFinite(tradeTime)) continue;

    const bucketTime = Math.floor(tradeTime / bucketSeconds) * bucketSeconds;
    const price = trade.executionPrice;
    const volume = trade.wusdcAmount;
    const existing = buckets.get(bucketTime);

    if (!existing) {
      buckets.set(bucketTime, {
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume,
      });
      continue;
    }

    existing.high = Math.max(existing.high, price);
    existing.low = Math.min(existing.low, price);
    existing.close = price;
    existing.volume += volume;
  }

  return Array.from(buckets.values()).map((candle) => ({
    ...candle,
    open: Number(candle.open.toPrecision(12)),
    high: Number(candle.high.toPrecision(12)),
    low: Number(candle.low.toPrecision(12)),
    close: Number(candle.close.toPrecision(12)),
    volume: Number(candle.volume.toPrecision(12)),
  }));
}

export async function getLatestTradeBlock(tokenId: string): Promise<number | null> {
  const rows = await db.select({
    maxBlock: sql<number>`MAX(${tradesTable.blockNumber})`
  })
  .from(tradesTable)
  .where(eq(tradesTable.tokenId, tokenId));
  return rows[0]?.maxBlock ?? null;
}

export async function getToken(id: string): Promise<Token | null> {
  const rows = await db.select().from(tokensTable).where(eq(tokensTable.id, id));
  if (!rows[0]) return null;
  const token = rowToToken(rows[0]);
  
  // Calculate all-time volume for this single token
  let allTimeVolume = 0;
  try {
    const volRes = await db.select({
      totalVolume: sql<number>`SUM(${tradesTable.wusdcAmount})`,
    })
    .from(tradesTable)
    .where(eq(tradesTable.tokenId, id));
    allTimeVolume = Number(volRes[0]?.totalVolume || 0);
  } catch (err) {
    logger.error({ err, id }, "Failed to fetch all-time volume for token");
  }

  return {
    ...token,
    allTimeVolume,
  };
}

export async function createToken(input: TokenInput): Promise<Token> {
  const ticker = input.ticker.trim().toUpperCase();
  const token: Token = {
    ...input,
    id: input.id ?? `${ticker.toLowerCase()}-${Date.now()}`,
    name: input.name.trim(),
    ticker,
    createdAt: input.createdAt ?? new Date().toISOString(),
    marketType: input.marketType ?? "unlisted",
    pairAddress: input.pairAddress ?? null,
    routerAddress: input.routerAddress ?? null,
    momentumScore: input.momentumScore ?? 50,
    trustScore: input.trustScore ?? 80,
    creatorHoldingPercent: input.creatorHoldingPercent ?? 0,
    riskFlags: input.riskFlags ?? "",
    signals: input.signals ?? "",
    hypeScore: input.hypeScore ?? 0,
  };

  await saveToken(token);
  return token;
}

export async function updateTokenMarket(
  id: string,
  market: Pick<Token, "marketType" | "pairAddress" | "routerAddress">,
): Promise<Token | null> {
  await db.update(tokensTable)
    .set({
      marketType: market.marketType,
      pairAddress: market.pairAddress,
      routerAddress: market.routerAddress,
    })
    .where(eq(tokensTable.id, id));

  return await getToken(id);
}

export async function updateTokenMarketStats(tokenId: string) {
  try {
    const token = await getToken(tokenId);
    if (!token) return;

    const trades = await db.select().from(tradesTable)
      .where(eq(tradesTable.tokenId, tokenId))
      .orderBy(asc(tradesTable.blockNumber), asc(tradesTable.logIndex));
      
    if (trades.length === 0) return;

    const latestTrade = trades[trades.length - 1];
    const price = Number(latestTrade.executionPrice);
    const marketCap = price * token.totalSupply;
    const txCount = trades.length;

    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const trades24h: any[] = trades.filter((t: any) => t.timestamp >= cutoff24h);
    const volume24h = trades24h.reduce((sum: number, t: any) => sum + Number(t.wusdcAmount), 0);

    let change24h = 0;
    if (trades24h.length > 0) {
      const tradesBefore24h: any[] = trades.filter((t: any) => t.timestamp < cutoff24h);
      let initialPrice = token.price;
      if (tradesBefore24h.length > 0) {
        initialPrice = Number(tradesBefore24h[tradesBefore24h.length - 1].executionPrice);
      } else {
        initialPrice = Number(trades24h[0].executionPrice);
      }
      if (initialPrice > 0) {
        change24h = ((price - initialPrice) / initialPrice) * 100;
      }
    }

    const balances: Record<string, number> = {};
    for (const t of trades) {
      const addr = t.traderAddress.toLowerCase();
      balances[addr] = (balances[addr] || 0) + (t.side === "buy" ? Number(t.tokenAmount) : -Number(t.tokenAmount));
    }

    const uniqueHolders = Object.keys(balances).filter(addr => balances[addr] > 0.0001);
    let holdersCount = uniqueHolders.length;

    if (token.pairAddress && !uniqueHolders.includes(token.pairAddress.toLowerCase())) {
      holdersCount += 1;
    }

    if (token.creatorAddress && !uniqueHolders.includes(token.creatorAddress.toLowerCase())) {
      holdersCount += 1;
    }

    await db.update(tokensTable)
      .set({
        price,
        marketCap,
        volume24h,
        change24h,
        holders: holdersCount,
        txCount,
      })
      .where(eq(tokensTable.id, tokenId));

    logger.info({ tokenId, price, marketCap, volume24h, change24h, holdersCount, txCount }, "Updated token market stats in DB successfully");
  } catch (err) {
    logger.error({ err, tokenId }, "Failed to update token market stats");
  }
}

export function getTokenDbPath() {
  return "";
}

export type Comment = {
  id: string;
  tokenId: string;
  authorAddress: string;
  content: string;
  timestamp: string;
  parentId: string | null;
};

export type Reaction = {
  id: string;
  tokenId: string;
  commentId: string | null;
  userAddress: string;
  emoji: string;
  timestamp: string;
};

export async function getCommentsForToken(tokenId: string): Promise<Comment[]> {
  const rows = await db.select().from(commentsTable)
    .where(eq(commentsTable.tokenId, tokenId))
    .orderBy(asc(commentsTable.timestamp));
  return rows.map((row: any) => ({
    ...row,
    parentId: row.parentId || null,
  }));
}

export async function saveComment(comment: Omit<Comment, "id" | "timestamp">): Promise<Comment> {
  const newComment: Comment = {
    ...comment,
    id: "c-" + Math.random().toString(36).slice(2, 9) + "-" + Date.now(),
    timestamp: new Date().toISOString(),
  };

  await db.insert(commentsTable).values({
    id: newComment.id,
    tokenId: newComment.tokenId,
    authorAddress: newComment.authorAddress,
    content: newComment.content,
    timestamp: newComment.timestamp,
    parentId: newComment.parentId,
  });

  return newComment;
}

export async function toggleEmojiReaction(
  reaction: Omit<Reaction, "id" | "timestamp">
): Promise<{ added: boolean }> {
  const deleted = await db.delete(reactionsTable)
    .where(
      and(
        eq(reactionsTable.tokenId, reaction.tokenId),
        reaction.commentId === null 
          ? sql`${reactionsTable.commentId} IS NULL`
          : eq(reactionsTable.commentId, reaction.commentId),
        eq(reactionsTable.userAddress, reaction.userAddress),
        eq(reactionsTable.emoji, reaction.emoji)
      )
    )
    .returning();

  if (deleted.length > 0) {
    return { added: false };
  }

  const newId = "r-" + Math.random().toString(36).slice(2, 9) + "-" + Date.now();
  await db.insert(reactionsTable).values({
    id: newId,
    tokenId: reaction.tokenId,
    commentId: reaction.commentId,
    userAddress: reaction.userAddress,
    emoji: reaction.emoji,
    timestamp: new Date().toISOString(),
  });

  return { added: true };
}

export async function getReactionsForToken(tokenId: string): Promise<Reaction[]> {
  const rows = await db.select().from(reactionsTable).where(eq(reactionsTable.tokenId, tokenId));
  return rows.map((row: any) => ({
    ...row,
    commentId: row.commentId || null,
  }));
}

export async function getRecentComments(limit = 10): Promise<(Comment & { tokenTicker: string })[]> {
  const rows = await db.select({
    id: commentsTable.id,
    tokenId: commentsTable.tokenId,
    authorAddress: commentsTable.authorAddress,
    content: commentsTable.content,
    timestamp: commentsTable.timestamp,
    parentId: commentsTable.parentId,
    tokenTicker: tokensTable.ticker,
  })
  .from(commentsTable)
  .innerJoin(tokensTable, eq(commentsTable.tokenId, tokensTable.id))
  .orderBy(desc(commentsTable.timestamp))
  .limit(limit);

  return rows.map((row: any) => ({
    ...row,
    parentId: row.parentId || null,
  }));
}

export async function incrementHype(tokenId: string, points: number): Promise<number> {
  try {
    const token = await getToken(tokenId);
    if (!token) return 0;
    const newHype = (token.hypeScore ?? 0) + points;
    await db.update(tokensTable).set({ hypeScore: newHype }).where(eq(tokensTable.id, tokenId));
    return newHype;
  } catch (err) {
    return 0;
  }
}

export type LeaderboardEntry = {
  address: string;
  realizedPnl: number;
  winRate: number;
  tradesCount: number;
  volume: number;
  rank: number;
  type: "whale" | "degen" | "lp_giant";
};

export async function getLeaderboard(metric = "pnl"): Promise<LeaderboardEntry[]> {
  const mockTraders: LeaderboardEntry[] = [];

  try {
    const allTrades = await db.select().from(tradesTable);
    const grouped = new Map<string, { tradesCount: number; volume: number; buys: number; sells: number; trades: any[] }>();

    for (const row of allTrades) {
      const addr = String(row.traderAddress).toLowerCase();
      if (!grouped.has(addr)) {
        grouped.set(addr, { tradesCount: 0, volume: 0, buys: 0, sells: 0, trades: [] });
      }
      const data = grouped.get(addr)!;
      data.tradesCount++;
      const vol = Number(row.wusdcAmount);
      data.volume += vol;
      if (row.side === "buy") data.buys++;
      else data.sells++;
      data.trades.push(row);
    }

    const tokens = await getTokens();
    for (const [addr, data] of grouped.entries()) {
      if (mockTraders.some(t => t.address.toLowerCase() === addr)) continue;

      let realizedPnl = 0;
      const holdings: Record<string, { size: number; totalCost: number; avgPrice: number }> = {};
      const sortedTrades = data.trades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      let profitableSells = 0;
      let totalSells = 0;

      for (const t of sortedTrades) {
        const tokenId = t.tokenId;
        const amount = Number(t.tokenAmount);
        const wusdc = Number(t.wusdcAmount);
        
        if (!holdings[tokenId]) {
          holdings[tokenId] = { size: 0, totalCost: 0, avgPrice: 0 };
        }
        
        const h = holdings[tokenId];
        if (t.side === "buy") {
          h.size += amount;
          h.totalCost += wusdc;
          h.avgPrice = h.size > 0 ? h.totalCost / h.size : 0;
        } else {
          totalSells++;
          const costBasis = amount * h.avgPrice;
          const gain = wusdc - costBasis;
          realizedPnl += gain;
          if (gain > 0) profitableSells++;
          h.size = Math.max(0, h.size - amount);
          if (h.size === 0) {
            h.totalCost = 0;
            h.avgPrice = 0;
          } else {
            h.totalCost = h.size * h.avgPrice;
          }
        }
      }

      let unrealizedValuation = 0;
      for (const [tId, h] of Object.entries(holdings)) {
        if (h.size > 0) {
          const tok = tokens.find(t => t.id === tId);
          if (tok) {
            unrealizedValuation += (h.size * tok.price) - h.totalCost;
          }
        }
      }

      const winRate = totalSells > 0 ? Math.round((profitableSells / totalSells) * 100) : 50;
      let type: "whale" | "degen" | "lp_giant" = "degen";
      if (data.volume > 10000) type = "whale";
      else if (data.tradesCount > 20) type = "degen";

      const formattedAddress = addr.startsWith("0x") ? addr : "0x" + addr.slice(0, 40);

      mockTraders.push({
        address: formattedAddress,
        realizedPnl: Number((realizedPnl + unrealizedValuation).toFixed(2)),
        winRate,
        tradesCount: data.tradesCount,
        volume: Number(data.volume.toFixed(2)),
        rank: 99,
        type,
      });
    }
  } catch (err) {
    logger.error({ err }, "Error computing leaderboard from trades");
  }

  mockTraders.sort((a, b) => b.realizedPnl - a.realizedPnl);
  mockTraders.forEach((t, i) => {
    t.rank = i + 1;
  });

  return mockTraders;
}

export async function getWalletAnalytics(address: string) {
  const addrLower = address.toLowerCase();

  try {
    const trades = await db.select().from(tradesTable)
      .where(sql`LOWER(${tradesTable.traderAddress}) = LOWER(${address})`)
      .orderBy(asc(tradesTable.timestamp));

    const tokens = await getTokens();
    const tokenStats: Record<string, any> = {};

    let totalVolume = 0;
    let profitableSells = 0;
    let totalSells = 0;
    let realizedPnl = 0;

    for (const trade of trades) {
      const tId = trade.tokenId;
      const tok = tokens.find(t => t.id === tId);
      if (!tok) continue;

      if (!tokenStats[tId]) {
        tokenStats[tId] = {
          tokenId: tId,
          ticker: tok.ticker,
          name: tok.name,
          logoColor: tok.logoColor,
          currentPrice: tok.price,
          totalBought: 0,
          totalSold: 0,
          totalUsdcSpent: 0,
          totalUsdcReceived: 0,
          avgEntryPrice: 0,
          realizedPnl: 0,
          currentTokens: 0,
        };
      }

      const stats = tokenStats[tId];
      const side = trade.side;
      const tokenAmount = Number(trade.tokenAmount);
      const wusdcAmount = Number(trade.wusdcAmount);
      totalVolume += wusdcAmount;

      if (side === "buy") {
        stats.totalBought += tokenAmount;
        stats.totalUsdcSpent += wusdcAmount;
        
        const currentCost = stats.currentTokens * stats.avgEntryPrice;
        const newCost = currentCost + wusdcAmount;
        stats.currentTokens += tokenAmount;
        if (stats.currentTokens > 0) {
          stats.avgEntryPrice = newCost / stats.currentTokens;
        }
      } else if (side === "sell") {
        totalSells++;
        stats.totalSold += tokenAmount;
        stats.totalUsdcReceived += wusdcAmount;

        const costBasis = tokenAmount * stats.avgEntryPrice;
        const gain = wusdcAmount - costBasis;
        stats.realizedPnl += gain;
        realizedPnl += gain;
        if (gain > 0) profitableSells++;
        
        stats.currentTokens = Math.max(0, stats.currentTokens - tokenAmount);
      }
    }

    const holdings = Object.values(tokenStats)
      .filter((s: any) => s.currentTokens > 0 || s.realizedPnl !== 0)
      .map((s: any) => ({
        tokenId: s.tokenId,
        ticker: s.ticker,
        name: s.name,
        logoColor: s.logoColor,
        balance: s.currentTokens,
        value: Number((s.currentTokens * s.currentPrice).toFixed(2)),
        avgEntry: Number(s.avgEntryPrice.toFixed(8)),
        realizedPnl: Number(s.realizedPnl.toFixed(2)),
      }));

    return {
      address,
      realizedPnl: Number(realizedPnl.toFixed(2)),
      winRate: totalSells > 0 ? Math.round((profitableSells / totalSells) * 100) : 50,
      volume: Number(totalVolume.toFixed(2)),
      tradesCount: trades.length,
      holdings,
      trades: trades.reverse().slice(0, 50),
    };
  } catch (err) {
    return {
      address,
      realizedPnl: 0,
      winRate: 50,
      volume: 0,
      tradesCount: 0,
      holdings: [],
      trades: [],
    };
  }
}

export type CopytradeWallet = {
  address: string;
  smartWalletAddress: string;
  balanceUsdc: number;
  isDeployed: number;
  isActive: number;
  createdAt: string;
};

export type CopytradeTarget = {
  ownerAddress: string;
  targetAddress: string;
  allocationUsdc: number;
  maxSlippage: number;
  isActive: number;
  createdAt: string;
};

export type CopytradeAction = {
  id: string;
  ownerAddress: string;
  targetAddress: string;
  targetTxHash: string;
  tokenId: string;
  side: "buy" | "sell";
  targetAmount: number;
  mirrorAmount: number;
  mirrorPrice: number;
  mirrorTxHash: string;
  status: "success" | "failed" | "pending";
  error: string | null;
  timestamp: string;
};

export function getDeterministicSmartWalletAddress(ownerAddress: string): string {
  const hash = crypto.createHash("sha256").update(`arc.smartwallet.v1.${ownerAddress.toLowerCase()}`).digest("hex");
  const privateKey = "0x" + hash;
  const wallet = new Wallet(privateKey);
  return wallet.address.toLowerCase();
}

export async function getSmartWallet(address: string): Promise<CopytradeWallet | null> {
  const addrLower = address.toLowerCase();
  try {
    const rows = await db.select().from(copytradeWalletsTable)
      .where(sql`LOWER(${copytradeWalletsTable.address}) = ${addrLower}`);
    if (rows.length === 0) return null;
    const row = rows[0];

    const correctAddress = getDeterministicSmartWalletAddress(addrLower);
    if (row.smartWalletAddress.toLowerCase() !== correctAddress.toLowerCase()) {
      await db.update(copytradeWalletsTable)
        .set({ smartWalletAddress: correctAddress })
        .where(sql`LOWER(${copytradeWalletsTable.address}) = ${addrLower}`);
      row.smartWalletAddress = correctAddress;
    }

    return {
      address: row.address,
      smartWalletAddress: row.smartWalletAddress,
      balanceUsdc: Number(row.balanceUsdc),
      isDeployed: Number(row.isDeployed),
      isActive: Number(row.isActive),
      createdAt: row.createdAt,
    };
  } catch (err) {
    logger.error({ err, address }, "Failed to getSmartWallet");
    return null;
  }
}

export async function deploySmartWallet(address: string, smartWalletAddress: string): Promise<CopytradeWallet> {
  const addrLower = address.toLowerCase();
  const smartLower = smartWalletAddress.toLowerCase();
  const now = new Date().toISOString();
  
  const existing = await getSmartWallet(addrLower);
  if (existing) {
    await db.update(copytradeWalletsTable)
      .set({ isDeployed: 1, isActive: 1, smartWalletAddress: smartLower })
      .where(sql`LOWER(${copytradeWalletsTable.address}) = ${addrLower}`);
    return { ...existing, isDeployed: 1, isActive: 1, smartWalletAddress: smartLower };
  }

  await db.insert(copytradeWalletsTable).values({
    address: addrLower,
    smartWalletAddress: smartLower,
    balanceUsdc: 100.0,
    isDeployed: 1,
    isActive: 1,
    createdAt: now,
  });

  return {
    address: addrLower,
    smartWalletAddress: smartLower,
    balanceUsdc: 100.0,
    isDeployed: 1,
    isActive: 1,
    createdAt: now,
  };
}

export async function updateSmartWalletBalance(address: string, amount: number): Promise<number> {
  const addrLower = address.toLowerCase();
  const wallet = await getSmartWallet(addrLower);
  if (!wallet) return 0;

  const newBalance = Math.max(0, wallet.balanceUsdc + amount);
  await db.update(copytradeWalletsTable)
    .set({ balanceUsdc: newBalance })
    .where(sql`LOWER(${copytradeWalletsTable.address}) = ${addrLower}`);

  return newBalance;
}

export async function listCopytradeTargets(ownerAddress: string): Promise<CopytradeTarget[]> {
  const ownerLower = ownerAddress.toLowerCase();
  try {
    const rows = await db.select().from(copytradeTargetsTable).where(sql`LOWER(${copytradeTargetsTable.ownerAddress}) = ${ownerLower}`);
    return rows.map((r: any) => ({
      ownerAddress: r.ownerAddress,
      targetAddress: r.targetAddress,
      allocationUsdc: Number(r.allocationUsdc),
      maxSlippage: Number(r.maxSlippage),
      isActive: Number(r.isActive),
      createdAt: r.createdAt,
    }));
  } catch (err) {
    logger.error({ err, ownerAddress }, "Failed to listCopytradeTargets");
    return [];
  }
}

export async function getCopytradeTarget(ownerAddress: string, targetAddress: string): Promise<CopytradeTarget | null> {
  const ownerLower = ownerAddress.toLowerCase();
  const targetLower = targetAddress.toLowerCase();
  try {
    const rows = await db.select().from(copytradeTargetsTable).where(
      and(
        sql`LOWER(${copytradeTargetsTable.ownerAddress}) = ${ownerLower}`,
        sql`LOWER(${copytradeTargetsTable.targetAddress}) = ${targetLower}`
      )
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      ownerAddress: row.ownerAddress,
      targetAddress: row.targetAddress,
      allocationUsdc: Number(row.allocationUsdc),
      maxSlippage: Number(row.maxSlippage),
      isActive: Number(row.isActive),
      createdAt: row.createdAt,
    };
  } catch (err) {
    return null;
  }
}

export async function setCopytradeTarget(
  ownerAddress: string,
  targetAddress: string,
  allocationUsdc: number,
  maxSlippage: number,
  isActive: number
): Promise<CopytradeTarget> {
  const ownerLower = ownerAddress.toLowerCase();
  const targetLower = targetAddress.toLowerCase();
  const now = new Date().toISOString();

  const existing = await getCopytradeTarget(ownerLower, targetLower);
  if (existing) {
    await db.update(copytradeTargetsTable)
      .set({ allocationUsdc, maxSlippage, isActive })
      .where(
        and(
          sql`LOWER(${copytradeTargetsTable.ownerAddress}) = ${ownerLower}`,
          sql`LOWER(${copytradeTargetsTable.targetAddress}) = ${targetLower}`
        )
      );
    return {
      ownerAddress: ownerLower,
      targetAddress: targetLower,
      allocationUsdc,
      maxSlippage,
      isActive,
      createdAt: existing.createdAt,
    };
  }

  await db.insert(copytradeTargetsTable).values({
    ownerAddress: ownerLower,
    targetAddress: targetLower,
    allocationUsdc,
    maxSlippage,
    isActive,
    createdAt: now,
  });

  return {
    ownerAddress: ownerLower,
    targetAddress: targetLower,
    allocationUsdc,
    maxSlippage,
    isActive,
    createdAt: now,
  };
}

export async function removeCopytradeTarget(ownerAddress: string, targetAddress: string): Promise<boolean> {
  const ownerLower = ownerAddress.toLowerCase();
  const targetLower = targetAddress.toLowerCase();
  try {
    const deleted = await db.delete(copytradeTargetsTable)
      .where(
        and(
          sql`LOWER(${copytradeTargetsTable.ownerAddress}) = ${ownerLower}`,
          sql`LOWER(${copytradeTargetsTable.targetAddress}) = ${targetLower}`
        )
      )
      .returning();
    return deleted.length > 0;
  } catch (err) {
    logger.error({ err, ownerAddress, targetAddress }, "Failed to removeCopytradeTarget");
    return false;
  }
}

export async function listCopytradeActions(ownerAddress: string): Promise<CopytradeAction[]> {
  const ownerLower = ownerAddress.toLowerCase();
  try {
    const rows = await db.select().from(copytradeActionsTable)
      .where(sql`LOWER(${copytradeActionsTable.ownerAddress}) = ${ownerLower}`)
      .orderBy(desc(copytradeActionsTable.timestamp))
      .limit(100);
      
    return rows.map((r: any) => ({
      id: r.id,
      ownerAddress: r.ownerAddress,
      targetAddress: r.targetAddress,
      targetTxHash: r.targetTxHash,
      tokenId: r.tokenId,
      side: r.side === "sell" ? "sell" : "buy",
      targetAmount: Number(r.targetAmount),
      mirrorAmount: Number(r.mirrorAmount),
      mirrorPrice: Number(r.mirrorPrice),
      mirrorTxHash: r.mirrorTxHash,
      status: r.status as any,
      error: r.error,
      timestamp: r.timestamp,
    }));
  } catch (err) {
    logger.error({ err, ownerAddress }, "Failed to listCopytradeActions");
    return [];
  }
}

export async function saveCopytradeAction(action: CopytradeAction): Promise<boolean> {
  try {
    const row = {
      ...action,
      ownerAddress: action.ownerAddress.toLowerCase(),
      targetAddress: action.targetAddress.toLowerCase(),
    };

    await db.insert(copytradeActionsTable)
      .values(row)
      .onConflictDoUpdate({
        target: copytradeActionsTable.id,
        set: row,
      });
    return true;
  } catch (err) {
    logger.error({ err, action }, "Failed to saveCopytradeAction");
    return false;
  }
}

export async function seedInitialTokens() {
  try {
    const countRes = await db.select({ count: sql<number>`count(*)` }).from(tokensTable);
    const count = Number(countRes[0]?.count || 0);
    if (count > 0) return;

    logger.info("Database is empty, seeding initial tokens...");
    for (const token of seedTokens) {
      await db.insert(tokensTable).values({
        ...token,
        momentumScore: token.momentumScore ?? 50,
        trustScore: token.trustScore ?? 80,
        creatorHoldingPercent: token.creatorHoldingPercent ?? 0,
        riskFlags: token.riskFlags ?? "",
        signals: token.signals ?? "",
        hypeScore: token.hypeScore ?? 0,
      });
    }
    logger.info("Successfully seeded initial tokens in PostgreSQL.");
  } catch (err) {
    logger.error({ err }, "Failed to seed initial tokens in PostgreSQL");
  }
}
