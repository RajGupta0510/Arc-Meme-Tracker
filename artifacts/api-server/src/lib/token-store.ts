import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
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
    totalSupply: 10000000000,
    holders: 1102,
    txCount: 5621,
    website: "https://arcfloki.io",
    twitter: "@arcfloki",
    telegram: "t.me/arcfloki",
  },
];

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(moduleDir, "..", "data", "arcmeme.sqlite");
const dbPath = process.env.TOKEN_DB_PATH ?? defaultDbPath;

mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

const createTokensTableSql = `
  CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ticker TEXT NOT NULL,
    price REAL NOT NULL,
    marketCap REAL NOT NULL,
    volume24h REAL NOT NULL,
    change24h REAL NOT NULL,
    description TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    creatorAddress TEXT NOT NULL,
    logoColor TEXT NOT NULL,
    logoUrl TEXT,
    contractAddress TEXT,
    marketType TEXT NOT NULL DEFAULT 'unlisted',
    pairAddress TEXT,
    routerAddress TEXT,
    totalSupply REAL NOT NULL,
    holders INTEGER NOT NULL,
    txCount INTEGER NOT NULL,
    website TEXT,
    twitter TEXT,
    telegram TEXT
  );
`;

db.exec(createTokensTableSql);

const requiredColumns = [
  ["id", "TEXT PRIMARY KEY"],
  ["name", "TEXT NOT NULL DEFAULT ''"],
  ["ticker", "TEXT NOT NULL DEFAULT ''"],
  ["price", "REAL NOT NULL DEFAULT 0"],
  ["marketCap", "REAL NOT NULL DEFAULT 0"],
  ["volume24h", "REAL NOT NULL DEFAULT 0"],
  ["change24h", "REAL NOT NULL DEFAULT 0"],
  ["description", "TEXT NOT NULL DEFAULT ''"],
  ["createdAt", "TEXT NOT NULL DEFAULT ''"],
  ["creatorAddress", "TEXT NOT NULL DEFAULT ''"],
  ["logoColor", "TEXT NOT NULL DEFAULT '#8b5cf6'"],
  ["logoUrl", "TEXT"],
  ["contractAddress", "TEXT"],
  ["marketType", "TEXT NOT NULL DEFAULT 'unlisted'"],
  ["pairAddress", "TEXT"],
  ["routerAddress", "TEXT"],
  ["totalSupply", "REAL NOT NULL DEFAULT 0"],
  ["holders", "INTEGER NOT NULL DEFAULT 0"],
  ["txCount", "INTEGER NOT NULL DEFAULT 0"],
  ["website", "TEXT"],
  ["twitter", "TEXT"],
  ["telegram", "TEXT"],
  ["momentumScore", "REAL NOT NULL DEFAULT 50"],
  ["trustScore", "REAL NOT NULL DEFAULT 80"],
  ["creatorHoldingPercent", "REAL NOT NULL DEFAULT 0"],
  ["riskFlags", "TEXT NOT NULL DEFAULT ''"],
  ["signals", "TEXT NOT NULL DEFAULT ''"],
  ["hypeScore", "INTEGER NOT NULL DEFAULT 0"],
] as const;

function ensureTokenSchema() {
  const tableInfo = db.prepare("PRAGMA table_info(tokens)").all() as Array<{
    name: string;
  }>;
  const existingColumns = new Set(tableInfo.map((column) => column.name));

  if (!existingColumns.has("id")) {
    db.exec(`ALTER TABLE tokens RENAME TO tokens_legacy_${Date.now()}`);
    db.exec(createTokensTableSql);
    return;
  }

  for (const [name, definition] of requiredColumns) {
    if (existingColumns.has(name)) continue;
    db.exec(`ALTER TABLE tokens ADD COLUMN ${name} ${definition}`);
  }
}

ensureTokenSchema();

db.exec(`
  CREATE INDEX IF NOT EXISTS tokens_createdAt_idx ON tokens(createdAt);
  CREATE INDEX IF NOT EXISTS tokens_change24h_idx ON tokens(change24h);
  CREATE INDEX IF NOT EXISTS tokens_marketCap_idx ON tokens(marketCap);
  CREATE INDEX IF NOT EXISTS tokens_volume24h_idx ON tokens(volume24h);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    tokenId TEXT NOT NULL,
    pairAddress TEXT NOT NULL,
    txHash TEXT NOT NULL,
    logIndex INTEGER NOT NULL,
    blockNumber INTEGER NOT NULL,
    side TEXT NOT NULL,
    tokenAmount REAL NOT NULL,
    wusdcAmount REAL NOT NULL,
    executionPrice REAL NOT NULL,
    traderAddress TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS trades_tokenId_blockNumber_idx ON trades(tokenId, blockNumber DESC);
  CREATE INDEX IF NOT EXISTS trades_pairAddress_idx ON trades(pairAddress);

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    tokenId TEXT NOT NULL,
    authorAddress TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    parentId TEXT
  );

  CREATE TABLE IF NOT EXISTS reactions (
    id TEXT PRIMARY KEY,
    tokenId TEXT NOT NULL,
    commentId TEXT,
    userAddress TEXT NOT NULL,
    emoji TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    UNIQUE(tokenId, commentId, userAddress, emoji)
  );

  CREATE TABLE IF NOT EXISTS copytrade_wallets (
    address TEXT PRIMARY KEY,
    smartWalletAddress TEXT NOT NULL,
    balanceUsdc REAL NOT NULL DEFAULT 0,
    isDeployed INTEGER NOT NULL DEFAULT 0,
    isActive INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS copytrade_targets (
    ownerAddress TEXT NOT NULL,
    targetAddress TEXT NOT NULL,
    allocationUsdc REAL NOT NULL DEFAULT 25.0,
    maxSlippage REAL NOT NULL DEFAULT 1.0,
    isActive INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    PRIMARY KEY (ownerAddress, targetAddress)
  );

  CREATE TABLE IF NOT EXISTS copytrade_actions (
    id TEXT PRIMARY KEY,
    ownerAddress TEXT NOT NULL,
    targetAddress TEXT NOT NULL,
    targetTxHash TEXT NOT NULL,
    tokenId TEXT NOT NULL,
    side TEXT NOT NULL,
    targetAmount REAL NOT NULL,
    mirrorAmount REAL NOT NULL,
    mirrorPrice REAL NOT NULL,
    mirrorTxHash TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    timestamp TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS comments_tokenId_idx ON comments(tokenId);
  CREATE INDEX IF NOT EXISTS reactions_tokenId_commentId_idx ON reactions(tokenId, commentId);
  CREATE INDEX IF NOT EXISTS copytrade_targets_owner_idx ON copytrade_targets(ownerAddress);
  CREATE INDEX IF NOT EXISTS copytrade_actions_owner_idx ON copytrade_actions(ownerAddress);
`);

const tokenColumns = `
  id, name, ticker, price, marketCap, volume24h, change24h, description,
  createdAt, creatorAddress, logoColor, logoUrl, contractAddress, marketType,
  pairAddress, routerAddress, totalSupply, holders, txCount, website, twitter, telegram,
  momentumScore, trustScore, creatorHoldingPercent, riskFlags, signals, hypeScore
`;
const launchedTokenWhere = "contractAddress IS NOT NULL AND contractAddress != '' AND pairAddress IS NOT NULL AND pairAddress != ''";

const countStatement = db.prepare("SELECT COUNT(*) AS count FROM tokens");
const insertStatement = db.prepare(`
  INSERT INTO tokens (${tokenColumns})
  VALUES (
    $id, $name, $ticker, $price, $marketCap, $volume24h, $change24h,
    $description, $createdAt, $creatorAddress, $logoColor, $logoUrl,
    $contractAddress, $marketType, $pairAddress, $routerAddress, $totalSupply,
    $holders, $txCount, $website, $twitter, $telegram,
    $momentumScore, $trustScore, $creatorHoldingPercent, $riskFlags, $signals, $hypeScore
  )
`);

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

function rowToToken(row: Record<string, unknown>): Token {
  const id = String(row.id);
  const change24h = Number(row.change24h);
  const volume24h = Number(row.volume24h);
  const marketCap = Number(row.marketCap);
  
  // Calculate dynamic momentum score (0-99)
  let momentum = Math.round(50 + change24h * 0.15 + Math.log1p(volume24h) * 2);
  momentum = Math.min(99, Math.max(10, momentum));
  
  // Calculate dynamic trust score (0-99)
  let trust = id === "rugpull" ? 12 : Math.round(85 - (id.length % 5) + Math.min(10, Math.log1p(marketCap) * 0.5));
  trust = Math.min(99, Math.max(5, trust));
  
  // Calculate dynamic creator concentration
  const creatorHolding = id === "rugpull" ? 82.5 : Number((2.5 + (id.charCodeAt(0) % 8)).toFixed(1));
  
  // Generate dynamic risk flags
  const flagsList = [];
  if (id === "rugpull") {
    flagsList.push("creator_concentration", "unlocked_liquidity", "honeypot_risk");
  } else {
    if (marketCap < 2000) flagsList.push("low_liquidity");
    if (creatorHolding > 8) flagsList.push("medium_concentration");
  }
  const riskFlags = flagsList.join(",");
  
  // Generate dynamic active signals
  const signalsList = [];
  if (momentum > 75) signalsList.push("fresh_momentum");
  if (volume24h > 15000) signalsList.push("volume_spike");
  if (change24h > 100) signalsList.push("price_surge");
  if (id === "arcdog") signalsList.push("whale_buys");
  if (id === "bonkarc") signalsList.push("liquidity_surge");
  const signals = signalsList.join(",");

  return {
    id,
    name: String(row.name).trim(),
    ticker: String(row.ticker).trim(),
    price: Number(row.price),
    marketCap,
    volume24h,
    change24h,
    description: String(row.description),
    createdAt: String(row.createdAt),
    creatorAddress: String(row.creatorAddress),
    logoColor: String(row.logoColor),
    logoUrl: row.logoUrl === null ? null : String(row.logoUrl),
    contractAddress: row.contractAddress === null ? null : String(row.contractAddress),
    marketType: row.marketType === "amm_pool" ? "amm_pool" : "unlisted",
    pairAddress: row.pairAddress === null ? null : String(row.pairAddress),
    routerAddress: row.routerAddress === null ? null : String(row.routerAddress),
    totalSupply: Number(row.totalSupply),
    holders: Number(row.holders),
    txCount: Number(row.txCount),
    website: row.website === null ? null : String(row.website),
    twitter: row.twitter === null ? null : String(row.twitter),
    telegram: row.telegram === null ? null : String(row.telegram),
    momentumScore: Number(row.momentumScore ?? momentum),
    trustScore: Number(row.trustScore ?? trust),
    creatorHoldingPercent: Number(row.creatorHoldingPercent ?? creatorHolding),
    riskFlags: String(row.riskFlags || riskFlags),
    signals: String(row.signals || signals),
    hypeScore: Number(row.hypeScore ?? (id.charCodeAt(0) % 25)),
  };
}

function saveToken(token: Token) {
  insertStatement.run({
    $id: token.id,
    $name: token.name,
    $ticker: token.ticker,
    $price: token.price,
    $marketCap: token.marketCap,
    $volume24h: token.volume24h,
    $change24h: token.change24h,
    $description: token.description,
    $createdAt: token.createdAt,
    $creatorAddress: token.creatorAddress,
    $logoColor: token.logoColor,
    $logoUrl: token.logoUrl,
    $contractAddress: token.contractAddress,
    $marketType: token.marketType,
    $pairAddress: token.pairAddress,
    $routerAddress: token.routerAddress,
    $totalSupply: token.totalSupply,
    $holders: token.holders,
    $txCount: token.txCount,
    $website: token.website,
    $twitter: token.twitter,
    $telegram: token.telegram,
    $momentumScore: token.momentumScore ?? 50,
    $trustScore: token.trustScore ?? 80,
    $creatorHoldingPercent: token.creatorHoldingPercent ?? 0,
    $riskFlags: token.riskFlags ?? "",
    $signals: token.signals ?? "",
    $hypeScore: token.hypeScore ?? 0,
  });
}

function rowToTrade(row: Record<string, unknown>): Trade {
  return {
    id: String(row.id),
    tokenId: String(row.tokenId),
    pairAddress: String(row.pairAddress),
    txHash: String(row.txHash),
    logIndex: Number(row.logIndex),
    blockNumber: Number(row.blockNumber),
    side: row.side === "sell" ? "sell" : "buy",
    tokenAmount: Number(row.tokenAmount),
    wusdcAmount: Number(row.wusdcAmount),
    executionPrice: Number(row.executionPrice),
    traderAddress: String(row.traderAddress),
    timestamp: String(row.timestamp),
  };
}

export function saveTrades(trades: Trade[]) {
  if (trades.length === 0) return 0;

  db.exec("BEGIN");
  let inserted = 0;
  try {
    for (const trade of trades) {
      const result = insertTradeStatement.run({
        $id: trade.id,
        $tokenId: trade.tokenId,
        $pairAddress: trade.pairAddress,
        $txHash: trade.txHash,
        $logIndex: trade.logIndex,
        $blockNumber: trade.blockNumber,
        $side: trade.side,
        $tokenAmount: trade.tokenAmount,
        $wusdcAmount: trade.wusdcAmount,
        $executionPrice: trade.executionPrice,
        $traderAddress: trade.traderAddress,
        $timestamp: trade.timestamp,
      });
      inserted += Number(result.changes);
    }
    db.exec("COMMIT");

    // Recalculate stats for each unique token in the saved trades
    const tokenIds = [...new Set(trades.map((t) => t.tokenId))];
    for (const tokenId of tokenIds) {
      updateTokenMarketStats(tokenId);
    }

    return inserted;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function seedInitialTokens() {
  const row = countStatement.get() as { count: number };
  if (row.count > 0) return;

  db.exec("BEGIN");
  try {
    for (const token of seedTokens) {
      saveToken(token);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

seedInitialTokens();

type TradeStats = {
  tokenId: string;
  txs1h: number;
  vol1h: number;
  buys1h: number;
  sells1h: number;
};

const cachedRankings: Record<string, { timestamp: number; data: Token[] }> = {};

function getRecentTradeStats(hours = 24): Record<string, TradeStats> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  try {
    const rows = db.prepare(`
      SELECT
        tokenId,
        COUNT(*) as txs1h,
        SUM(wusdcAmount) as vol1h,
        SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) as buys1h,
        SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) as sells1h
      FROM trades
      WHERE timestamp >= ?
      GROUP BY tokenId
    `).all(cutoff) as Record<string, unknown>[];

    const stats: Record<string, TradeStats> = {};
    for (const row of rows) {
      const tId = String(row.tokenId);
      stats[tId] = {
        tokenId: tId,
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

export function listTokens(sort = "trending", limit = 50): Token[] {
  const now = Date.now();
  const cacheKey = `${sort}_${limit}`;
  if (cachedRankings[cacheKey] && now - cachedRankings[cacheKey].timestamp < 5000) {
    return cachedRankings[cacheKey].data;
  }

  const rows = db
    .prepare(`SELECT ${tokenColumns} FROM tokens WHERE ${launchedTokenWhere}`)
    .all() as Record<string, unknown>[];
  const allTokens = rows.map(rowToToken);

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
    const recentStats = getRecentTradeStats(24);
    sorted = allTokens.sort((a, b) => {
      const aRecent = recentStats[a.id]?.txs1h ?? 0;
      const bRecent = recentStats[b.id]?.txs1h ?? 0;
      const aScore = aRecent * 10 + a.txCount;
      const bScore = bRecent * 10 + b.txCount;
      return bScore - aScore;
    });
  } else {
    const recentStats = getRecentTradeStats(6);
    sorted = allTokens.sort((a, b) => {
      const aStats = recentStats[a.id];
      const bStats = recentStats[b.id];

      const calculateScore = (token: Token, stats?: TradeStats) => {
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

export function getTokenByContract(contractAddress: string): Token | null {
  try {
    const row = db
      .prepare(`SELECT ${tokenColumns} FROM tokens WHERE LOWER(contractAddress) = LOWER(?)`)
      .get(contractAddress) as Record<string, unknown> | undefined;
    return row ? rowToToken(row) : null;
  } catch {
    return null;
  }
}

export function getTokens(): Token[] {
  const rows = db
    .prepare(`SELECT ${tokenColumns} FROM tokens WHERE ${launchedTokenWhere}`)
    .all() as Record<string, unknown>[];

  return rows.map(rowToToken);
}

export function getAllTokens(): Token[] {
  const rows = db
    .prepare(`SELECT ${tokenColumns} FROM tokens`)
    .all() as Record<string, unknown>[];

  return rows.map(rowToToken);
}

export function listTrades(tokenId: string, limit = 50): Trade[] {
  const rows = db
    .prepare("SELECT * FROM trades WHERE tokenId = ? ORDER BY blockNumber DESC, logIndex DESC LIMIT ?")
    .all(tokenId, limit) as Record<string, unknown>[];

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

export function listCandles(tokenId: string, interval: CandleInterval): Candle[] {
  const trades = db
    .prepare("SELECT * FROM trades WHERE tokenId = ? ORDER BY blockNumber ASC, logIndex ASC")
    .all(tokenId) as Record<string, unknown>[];

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

export function getLatestTradeBlock(tokenId: string): number | null {
  const row = db
    .prepare("SELECT MAX(blockNumber) AS blockNumber FROM trades WHERE tokenId = ?")
    .get(tokenId) as { blockNumber: number | null } | undefined;

  return row?.blockNumber ?? null;
}

export function getToken(id: string): Token | null {
  const row = db
    .prepare(`SELECT ${tokenColumns} FROM tokens WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;

  return row ? rowToToken(row) : null;
}

export function createToken(input: TokenInput): Token {
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
  };

  saveToken(token);
  return token;
}

const updateMarketStatement = db.prepare(`
  UPDATE tokens
  SET marketType = $marketType,
      pairAddress = $pairAddress,
      routerAddress = $routerAddress
  WHERE id = $id
`);

export function updateTokenMarket(
  id: string,
  market: Pick<Token, "marketType" | "pairAddress" | "routerAddress">,
): Token | null {
  const result = updateMarketStatement.run({
    $id: id,
    $marketType: market.marketType,
    $pairAddress: market.pairAddress,
    $routerAddress: market.routerAddress,
  });

  if (result.changes === 0) return null;
  return getToken(id);
}

export function updateTokenMarketStats(tokenId: string) {
  try {
    const token = getToken(tokenId);
    if (!token) return;

    const trades = db.prepare("SELECT * FROM trades WHERE tokenId = ? ORDER BY blockNumber ASC, logIndex ASC").all(tokenId) as any[];
    if (trades.length === 0) return;

    // Price is based on the latest execution price
    const latestTrade = trades[trades.length - 1];
    const price = Number(latestTrade.executionPrice);
    const marketCap = price * token.totalSupply;
    const txCount = trades.length;

    // 24h volume
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const trades24h = trades.filter(t => t.timestamp >= cutoff24h);
    const volume24h = trades24h.reduce((sum, t) => sum + Number(t.wusdcAmount), 0);

    // 24h change
    let change24h = 0;
    if (trades24h.length > 0) {
      const tradesBefore24h = trades.filter(t => t.timestamp < cutoff24h);
      let initialPrice = token.price; // fallback
      if (tradesBefore24h.length > 0) {
        initialPrice = Number(tradesBefore24h[tradesBefore24h.length - 1].executionPrice);
      } else {
        initialPrice = Number(trades24h[0].executionPrice);
      }
      if (initialPrice > 0) {
        change24h = ((price - initialPrice) / initialPrice) * 100;
      }
    }

    // Holders: unique traderAddress with positive remaining balance
    const balances: Record<string, number> = {};
    for (const t of trades) {
      const addr = t.traderAddress.toLowerCase();
      balances[addr] = (balances[addr] || 0) + (t.side === "buy" ? Number(t.tokenAmount) : -Number(t.tokenAmount));
    }

    const uniqueHolders = Object.keys(balances).filter(addr => balances[addr] > 0.0001);
    let holdersCount = uniqueHolders.length;

    // Add pair address if launched and not in list
    if (token.pairAddress && !uniqueHolders.includes(token.pairAddress.toLowerCase())) {
      holdersCount += 1;
    }

    // Add creator if not in list
    if (token.creatorAddress && !uniqueHolders.includes(token.creatorAddress.toLowerCase())) {
      holdersCount += 1;
    }

    db.prepare(`
      UPDATE tokens
      SET price = ?,
          marketCap = ?,
          volume24h = ?,
          change24h = ?,
          holders = ?,
          txCount = ?
      WHERE id = ?
    `).run(price, marketCap, volume24h, change24h, holdersCount, txCount, tokenId);

    logger.info({ tokenId, price, marketCap, volume24h, change24h, holdersCount, txCount }, "Updated token market stats in DB successfully");
  } catch (err) {
    logger.error({ err, tokenId }, "Failed to update token market stats");
  }
}

export function getTokenDbPath() {
  return dbPath;
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

// Statements for Comments and Reactions
const insertCommentStatement = db.prepare(`
  INSERT INTO comments (id, tokenId, authorAddress, content, timestamp, parentId)
  VALUES ($id, $tokenId, $authorAddress, $content, $timestamp, $parentId)
`);

const selectCommentsStatement = db.prepare(`
  SELECT * FROM comments WHERE tokenId = ? ORDER BY datetime(timestamp) ASC
`);

const toggleReactionStatement = db.prepare(`
  INSERT INTO reactions (id, tokenId, commentId, userAddress, emoji, timestamp)
  VALUES ($id, $tokenId, $commentId, $userAddress, $emoji, $timestamp)
`);

const deleteReactionStatement = db.prepare(`
  DELETE FROM reactions 
  WHERE tokenId = $tokenId 
    AND (commentId = $commentId OR (commentId IS NULL AND $commentId IS NULL))
    AND userAddress = $userAddress 
    AND emoji = $emoji
`);

const selectReactionsStatement = db.prepare(`
  SELECT * FROM reactions WHERE tokenId = ?
`);

const selectRecentCommentsStatement = db.prepare(`
  SELECT c.*, t.ticker as tokenTicker 
  FROM comments c
  JOIN tokens t ON c.tokenId = t.id
  ORDER BY datetime(c.timestamp) DESC
  LIMIT ?
`);

export function getCommentsForToken(tokenId: string): Comment[] {
  const rows = selectCommentsStatement.all(tokenId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    tokenId: String(row.tokenId),
    authorAddress: String(row.authorAddress),
    content: String(row.content),
    timestamp: String(row.timestamp),
    parentId: row.parentId ? String(row.parentId) : null,
  }));
}

export function saveComment(comment: Omit<Comment, "id" | "timestamp">): Comment {
  const newComment: Comment = {
    ...comment,
    id: "c-" + Math.random().toString(36).slice(2, 9) + "-" + Date.now(),
    timestamp: new Date().toISOString(),
  };

  insertCommentStatement.run({
    $id: newComment.id,
    $tokenId: newComment.tokenId,
    $authorAddress: newComment.authorAddress,
    $content: newComment.content,
    $timestamp: newComment.timestamp,
    $parentId: newComment.parentId,
  });

  return newComment;
}

export function toggleEmojiReaction(
  reaction: Omit<Reaction, "id" | "timestamp">
): { added: boolean } {
  // Try deleting first (to toggle off)
  const deleteResult = deleteReactionStatement.run({
    $tokenId: reaction.tokenId,
    $commentId: reaction.commentId,
    $userAddress: reaction.userAddress,
    $emoji: reaction.emoji,
  });

  if (deleteResult.changes > 0) {
    return { added: false };
  }

  // Otherwise, add it
  const newId = "r-" + Math.random().toString(36).slice(2, 9) + "-" + Date.now();
  toggleReactionStatement.run({
    $id: newId,
    $tokenId: reaction.tokenId,
    $commentId: reaction.commentId,
    $userAddress: reaction.userAddress,
    $emoji: reaction.emoji,
    $timestamp: new Date().toISOString(),
  });

  return { added: true };
}

export function getReactionsForToken(tokenId: string): Reaction[] {
  const rows = selectReactionsStatement.all(tokenId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    tokenId: String(row.tokenId),
    commentId: row.commentId ? String(row.commentId) : null,
    userAddress: String(row.userAddress),
    emoji: String(row.emoji),
    timestamp: String(row.timestamp),
  }));
}

export function getRecentComments(limit = 10): (Comment & { tokenTicker: string })[] {
  const rows = selectRecentCommentsStatement.all(limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    tokenId: String(row.tokenId),
    authorAddress: String(row.authorAddress),
    content: String(row.content),
    timestamp: String(row.timestamp),
    parentId: row.parentId ? String(row.parentId) : null,
    tokenTicker: String(row.tokenTicker),
  }));
}

export function incrementHype(tokenId: string, points: number): number {
  try {
    const token = getToken(tokenId);
    if (!token) return 0;
    const newHype = (token.hypeScore ?? 0) + points;
    db.prepare("UPDATE tokens SET hypeScore = ? WHERE id = ?").run(newHype, tokenId);
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

export function getLeaderboard(metric = "pnl"): LeaderboardEntry[] {
  const mockTraders: LeaderboardEntry[] = [];

  try {
    const allTrades = db.prepare("SELECT * FROM trades").all() as Record<string, unknown>[];
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

    const tokens = getTokens();
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

export function getWalletAnalytics(address: string) {
  const addrLower = address.toLowerCase();

  const mockHoldings: Record<string, any> = {};

  const isMock = addrLower in mockHoldings;
  const mockData = isMock ? mockHoldings[addrLower] : null;

  try {
    const trades = db.prepare(`
      SELECT * FROM trades
      WHERE LOWER(traderAddress) = LOWER(?)
      ORDER BY datetime(timestamp) ASC
    `).all(address) as any[];

    const tokens = getTokens();
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

    const finalRealizedPnl = isMock ? mockData.realizedPnl : realizedPnl;
    const finalWinRate = isMock ? mockData.winRate : (totalSells > 0 ? Math.round((profitableSells / totalSells) * 100) : 50);
    const finalVolume = isMock ? mockData.volume : totalVolume;
    const finalTradesCount = isMock ? mockData.tradesCount : trades.length;
    const finalHoldings = isMock ? [...mockData.holdings, ...holdings] : holdings;

    return {
      address,
      realizedPnl: Number(finalRealizedPnl.toFixed(2)),
      winRate: finalWinRate,
      volume: Number(finalVolume.toFixed(2)),
      tradesCount: finalTradesCount,
      holdings: finalHoldings,
      trades: trades.reverse().slice(0, 50),
    };
  } catch (err) {
    return {
      address,
      realizedPnl: isMock ? mockData.realizedPnl : 0,
      winRate: isMock ? mockData.winRate : 50,
      volume: isMock ? mockData.volume : 0,
      tradesCount: isMock ? mockData.tradesCount : 0,
      holdings: isMock ? mockData.holdings : [],
      trades: [],
    };
  }
}

// --- Smart Copytrading Wallets, Targets, and Actions Interfaces & Helpers ---

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

import crypto from "node:crypto";
import { Wallet } from "ethers";

export function getDeterministicSmartWalletAddress(ownerAddress: string): string {
  const hash = crypto.createHash("sha256").update(`arc.smartwallet.v1.${ownerAddress.toLowerCase()}`).digest("hex");
  const privateKey = "0x" + hash;
  const wallet = new Wallet(privateKey);
  return wallet.address.toLowerCase();
}

export function getSmartWallet(address: string): CopytradeWallet | null {
  const addrLower = address.toLowerCase();
  try {
    const row = db.prepare("SELECT * FROM copytrade_wallets WHERE LOWER(address) = ?").get(addrLower) as any;
    if (!row) return null;

    // Self-heal stale database records from previous sessions
    const correctAddress = getDeterministicSmartWalletAddress(addrLower);
    if (row.smartWalletAddress.toLowerCase() !== correctAddress.toLowerCase()) {
      db.prepare(`
        UPDATE copytrade_wallets
        SET smartWalletAddress = ?
        WHERE LOWER(address) = ?
      `).run(correctAddress, addrLower);
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

export function deploySmartWallet(address: string, smartWalletAddress: string): CopytradeWallet {
  const addrLower = address.toLowerCase();
  const smartLower = smartWalletAddress.toLowerCase();
  const now = new Date().toISOString();
  
  const existing = getSmartWallet(addrLower);
  if (existing) {
    db.prepare(`
      UPDATE copytrade_wallets
      SET isDeployed = 1, isActive = 1, smartWalletAddress = ?
      WHERE LOWER(address) = ?
    `).run(smartLower, addrLower);
    return { ...existing, isDeployed: 1, isActive: 1, smartWalletAddress: smartLower };
  }

  db.prepare(`
    INSERT INTO copytrade_wallets (address, smartWalletAddress, balanceUsdc, isDeployed, isActive, createdAt)
    VALUES (?, ?, 100.0, 1, 1, ?)
  `).run(addrLower, smartLower, now);

  return {
    address: addrLower,
    smartWalletAddress: smartLower,
    balanceUsdc: 100.0,
    isDeployed: 1,
    isActive: 1,
    createdAt: now,
  };
}

export function updateSmartWalletBalance(address: string, amount: number): number {
  const addrLower = address.toLowerCase();
  const wallet = getSmartWallet(addrLower);
  if (!wallet) return 0;

  const newBalance = Math.max(0, wallet.balanceUsdc + amount);
  db.prepare(`
    UPDATE copytrade_wallets
    SET balanceUsdc = ?
    WHERE LOWER(address) = ?
  `).run(newBalance, addrLower);

  return newBalance;
}

export function listCopytradeTargets(ownerAddress: string): CopytradeTarget[] {
  const ownerLower = ownerAddress.toLowerCase();
  try {
    const rows = db.prepare("SELECT * FROM copytrade_targets WHERE LOWER(ownerAddress) = ?").all(ownerLower) as any[];
    return rows.map(r => ({
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

export function getCopytradeTarget(ownerAddress: string, targetAddress: string): CopytradeTarget | null {
  const ownerLower = ownerAddress.toLowerCase();
  const targetLower = targetAddress.toLowerCase();
  try {
    const row = db.prepare("SELECT * FROM copytrade_targets WHERE LOWER(ownerAddress) = ? AND LOWER(targetAddress) = ?").get(ownerLower, targetLower) as any;
    if (!row) return null;
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

export function setCopytradeTarget(
  ownerAddress: string,
  targetAddress: string,
  allocationUsdc: number,
  maxSlippage: number,
  isActive: number
): CopytradeTarget {
  const ownerLower = ownerAddress.toLowerCase();
  const targetLower = targetAddress.toLowerCase();
  const now = new Date().toISOString();

  const existing = getCopytradeTarget(ownerLower, targetLower);
  if (existing) {
    db.prepare(`
      UPDATE copytrade_targets
      SET allocationUsdc = ?, maxSlippage = ?, isActive = ?
      WHERE LOWER(ownerAddress) = ? AND LOWER(targetAddress) = ?
    `).run(allocationUsdc, maxSlippage, isActive, ownerLower, targetLower);
    return {
      ownerAddress: ownerLower,
      targetAddress: targetLower,
      allocationUsdc,
      maxSlippage,
      isActive,
      createdAt: existing.createdAt,
    };
  }

  db.prepare(`
    INSERT INTO copytrade_targets (ownerAddress, targetAddress, allocationUsdc, maxSlippage, isActive, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(ownerLower, targetLower, allocationUsdc, maxSlippage, isActive, now);

  return {
    ownerAddress: ownerLower,
    targetAddress: targetLower,
    allocationUsdc,
    maxSlippage,
    isActive,
    createdAt: now,
  };
}

export function removeCopytradeTarget(ownerAddress: string, targetAddress: string): boolean {
  const ownerLower = ownerAddress.toLowerCase();
  const targetLower = targetAddress.toLowerCase();
  try {
    const result = db.prepare("DELETE FROM copytrade_targets WHERE LOWER(ownerAddress) = ? AND LOWER(targetAddress) = ?").run(ownerLower, targetLower);
    return Number(result.changes) > 0;
  } catch (err) {
    logger.error({ err, ownerAddress, targetAddress }, "Failed to removeCopytradeTarget");
    return false;
  }
}

export function listCopytradeActions(ownerAddress: string): CopytradeAction[] {
  const ownerLower = ownerAddress.toLowerCase();
  try {
    const rows = db.prepare("SELECT * FROM copytrade_actions WHERE LOWER(ownerAddress) = ? ORDER BY datetime(timestamp) DESC LIMIT 100").all(ownerLower) as any[];
    return rows.map(r => ({
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

export function saveCopytradeAction(action: CopytradeAction): boolean {
  try {
    db.prepare(`
      INSERT OR REPLACE INTO copytrade_actions (
        id, ownerAddress, targetAddress, targetTxHash, tokenId, side,
        targetAmount, mirrorAmount, mirrorPrice, mirrorTxHash, status, error, timestamp
      ) VALUES (
        $id, $ownerAddress, $targetAddress, $targetTxHash, $tokenId, $side,
        $targetAmount, $mirrorAmount, $mirrorPrice, $mirrorTxHash, $status, $error, $timestamp
      )
    `).run({
      $id: action.id,
      $ownerAddress: action.ownerAddress.toLowerCase(),
      $targetAddress: action.targetAddress.toLowerCase(),
      $targetTxHash: action.targetTxHash,
      $tokenId: action.tokenId,
      $side: action.side,
      $targetAmount: action.targetAmount,
      $mirrorAmount: action.mirrorAmount,
      $mirrorPrice: action.mirrorPrice,
      $mirrorTxHash: action.mirrorTxHash,
      $status: action.status,
      $error: action.error,
      $timestamp: action.timestamp,
    });
    return true;
  } catch (err) {
    logger.error({ err, action }, "Failed to saveCopytradeAction");
    return false;
  }
}
