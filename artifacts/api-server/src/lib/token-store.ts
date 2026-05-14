import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

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
  totalSupply: number;
  holders: number;
  txCount: number;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
};

type TokenInput = Omit<Token, "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
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

const db = new DatabaseSync(dbPath);

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
  ["totalSupply", "REAL NOT NULL DEFAULT 0"],
  ["holders", "INTEGER NOT NULL DEFAULT 0"],
  ["txCount", "INTEGER NOT NULL DEFAULT 0"],
  ["website", "TEXT"],
  ["twitter", "TEXT"],
  ["telegram", "TEXT"],
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

const tokenColumns = `
  id, name, ticker, price, marketCap, volume24h, change24h, description,
  createdAt, creatorAddress, logoColor, logoUrl, contractAddress, totalSupply,
  holders, txCount, website, twitter, telegram
`;

const countStatement = db.prepare("SELECT COUNT(*) AS count FROM tokens");
const insertStatement = db.prepare(`
  INSERT INTO tokens (${tokenColumns})
  VALUES (
    $id, $name, $ticker, $price, $marketCap, $volume24h, $change24h,
    $description, $createdAt, $creatorAddress, $logoColor, $logoUrl,
    $contractAddress, $totalSupply, $holders, $txCount, $website, $twitter,
    $telegram
  )
`);

function rowToToken(row: Record<string, unknown>): Token {
  return {
    id: String(row.id),
    name: String(row.name),
    ticker: String(row.ticker),
    price: Number(row.price),
    marketCap: Number(row.marketCap),
    volume24h: Number(row.volume24h),
    change24h: Number(row.change24h),
    description: String(row.description),
    createdAt: String(row.createdAt),
    creatorAddress: String(row.creatorAddress),
    logoColor: String(row.logoColor),
    logoUrl: row.logoUrl === null ? null : String(row.logoUrl),
    contractAddress: row.contractAddress === null ? null : String(row.contractAddress),
    totalSupply: Number(row.totalSupply),
    holders: Number(row.holders),
    txCount: Number(row.txCount),
    website: row.website === null ? null : String(row.website),
    twitter: row.twitter === null ? null : String(row.twitter),
    telegram: row.telegram === null ? null : String(row.telegram),
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
    $totalSupply: token.totalSupply,
    $holders: token.holders,
    $txCount: token.txCount,
    $website: token.website,
    $twitter: token.twitter,
    $telegram: token.telegram,
  });
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

export function listTokens(sort = "trending", limit = 50): Token[] {
  const orderBy =
    sort === "newest"
      ? "datetime(createdAt) DESC"
      : sort === "marketCap"
        ? "marketCap DESC"
        : sort === "volume"
          ? "volume24h DESC"
          : "change24h DESC";

  const rows = db
    .prepare(`SELECT ${tokenColumns} FROM tokens ORDER BY ${orderBy} LIMIT ?`)
    .all(limit) as Record<string, unknown>[];

  return rows.map(rowToToken);
}

export function getTokens(): Token[] {
  const rows = db
    .prepare(`SELECT ${tokenColumns} FROM tokens`)
    .all() as Record<string, unknown>[];

  return rows.map(rowToToken);
}

export function getToken(id: string): Token | null {
  const row = db
    .prepare(`SELECT ${tokenColumns} FROM tokens WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;

  return row ? rowToToken(row) : null;
}

export function createToken(input: TokenInput): Token {
  const token: Token = {
    ...input,
    id: input.id ?? `${input.ticker.toLowerCase()}-${Date.now()}`,
    ticker: input.ticker.toUpperCase(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };

  saveToken(token);
  return token;
}

export function getTokenDbPath() {
  return dbPath;
}
