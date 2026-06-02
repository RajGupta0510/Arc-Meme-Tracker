import { pgTable, text, integer, doublePrecision, primaryKey, unique, index } from "drizzle-orm/pg-core";

// 1. Tokens Table
export const tokensTable = pgTable("tokens", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ticker: text("ticker").notNull(),
  price: doublePrecision("price").notNull(),
  marketCap: doublePrecision("marketCap").notNull(),
  volume24h: doublePrecision("volume24h").notNull(),
  change24h: doublePrecision("change24h").notNull(),
  description: text("description").notNull(),
  createdAt: text("createdAt").notNull(),
  creatorAddress: text("creatorAddress").notNull(),
  logoColor: text("logoColor").notNull(),
  logoUrl: text("logoUrl"),
  contractAddress: text("contractAddress"),
  marketType: text("marketType").notNull().default("unlisted"),
  pairAddress: text("pairAddress"),
  routerAddress: text("routerAddress"),
  totalSupply: doublePrecision("totalSupply").notNull(),
  holders: integer("holders").notNull(),
  txCount: integer("txCount").notNull(),
  website: text("website"),
  twitter: text("twitter"),
  telegram: text("telegram"),
  momentumScore: doublePrecision("momentumScore").notNull().default(50),
  trustScore: doublePrecision("trustScore").notNull().default(80),
  creatorHoldingPercent: doublePrecision("creatorHoldingPercent").notNull().default(0),
  riskFlags: text("riskFlags").notNull().default(""),
  signals: text("signals").notNull().default(""),
  hypeScore: integer("hypeScore").notNull().default(0),
}, (table) => [
  index("tokens_createdAt_idx").on(table.createdAt),
  index("tokens_change24h_idx").on(table.change24h),
  index("tokens_marketCap_idx").on(table.marketCap),
  index("tokens_volume24h_idx").on(table.volume24h),
]);

// 2. Trades Table
export const tradesTable = pgTable("trades", {
  id: text("id").primaryKey(),
  tokenId: text("tokenId").notNull(),
  pairAddress: text("pairAddress").notNull(),
  txHash: text("txHash").notNull(),
  logIndex: integer("logIndex").notNull(),
  blockNumber: integer("blockNumber").notNull(),
  side: text("side").notNull(), // 'buy' | 'sell'
  tokenAmount: doublePrecision("tokenAmount").notNull(),
  wusdcAmount: doublePrecision("wusdcAmount").notNull(),
  executionPrice: doublePrecision("executionPrice").notNull(),
  traderAddress: text("traderAddress").notNull(),
  timestamp: text("timestamp").notNull(),
}, (table) => [
  index("trades_tokenId_blockNumber_idx").on(table.tokenId, table.blockNumber),
  index("trades_pairAddress_idx").on(table.pairAddress),
]);

// 3. Comments Table
export const commentsTable = pgTable("comments", {
  id: text("id").primaryKey(),
  tokenId: text("tokenId").notNull(),
  authorAddress: text("authorAddress").notNull(),
  content: text("content").notNull(),
  timestamp: text("timestamp").notNull(),
  parentId: text("parentId"),
}, (table) => [
  index("comments_tokenId_idx").on(table.tokenId),
]);

// 4. Reactions Table
export const reactionsTable = pgTable("reactions", {
  id: text("id").primaryKey(),
  tokenId: text("tokenId").notNull(),
  commentId: text("commentId"),
  userAddress: text("userAddress").notNull(),
  emoji: text("emoji").notNull(),
  timestamp: text("timestamp").notNull(),
}, (table) => [
  unique("reactions_uniq").on(table.tokenId, table.commentId, table.userAddress, table.emoji),
  index("reactions_tokenId_commentId_idx").on(table.tokenId, table.commentId),
]);

// 5. Copytrade Wallets Table
export const copytradeWalletsTable = pgTable("copytrade_wallets", {
  address: text("address").primaryKey(),
  smartWalletAddress: text("smartWalletAddress").notNull(),
  balanceUsdc: doublePrecision("balanceUsdc").notNull().default(0),
  isDeployed: integer("isDeployed").notNull().default(0),
  isActive: integer("isActive").notNull().default(1),
  createdAt: text("createdAt").notNull(),
});

// 6. Copytrade Targets Table
export const copytradeTargetsTable = pgTable("copytrade_targets", {
  ownerAddress: text("ownerAddress").notNull(),
  targetAddress: text("targetAddress").notNull(),
  allocationUsdc: doublePrecision("allocationUsdc").notNull().default(25.0),
  maxSlippage: doublePrecision("maxSlippage").notNull().default(1.0),
  isActive: integer("isActive").notNull().default(1),
  createdAt: text("createdAt").notNull(),
}, (table) => [
  primaryKey({ columns: [table.ownerAddress, table.targetAddress] }),
  index("copytrade_targets_owner_idx").on(table.ownerAddress),
]);

// 7. Copytrade Actions Table
export const copytradeActionsTable = pgTable("copytrade_actions", {
  id: text("id").primaryKey(),
  ownerAddress: text("ownerAddress").notNull(),
  targetAddress: text("targetAddress").notNull(),
  targetTxHash: text("targetTxHash").notNull(),
  tokenId: text("tokenId").notNull(),
  side: text("side").notNull(), // 'buy' | 'sell'
  targetAmount: doublePrecision("targetAmount").notNull(),
  mirrorAmount: doublePrecision("mirrorAmount").notNull(),
  mirrorPrice: doublePrecision("mirrorPrice").notNull(),
  mirrorTxHash: text("mirrorTxHash").notNull(),
  status: text("status").notNull(), // 'success' | 'failed' | 'pending'
  error: text("error"),
  timestamp: text("timestamp").notNull(),
}, (table) => [
  index("copytrade_actions_owner_idx").on(table.ownerAddress),
]);