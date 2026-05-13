import { Router, type IRouter } from "express";
import {
  ListTokensQueryParams,
  LaunchTokenBody,
  GetTokenParams,
  GetTokenChartParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

type Token = {
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
  totalSupply: number;
  holders: number;
  txCount: number;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
};

const MOCK_TOKENS: Token[] = [
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
    description: "Shiba Inu found a new blockchain. SHIBARC — the Arc killer dog. Much wow, very Arc, such degen.",
    createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    creatorAddress: "arc1sHb8...c3Dq",
    logoColor: "#f97316",
    logoUrl: null,
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
    totalSupply: 10000000000,
    holders: 1102,
    txCount: 5621,
    website: "https://arcfloki.io",
    twitter: "@arcfloki",
    telegram: "t.me/arcfloki",
  },
];

function generateChartData(basePrice: number, points = 120) {
  const now = Date.now();
  const interval = 5 * 60 * 1000;
  let price = basePrice * 0.5;
  const data = [];

  for (let i = points; i >= 0; i--) {
    const change = (Math.random() - 0.47) * price * 0.06;
    const open = price;
    price = Math.max(price + change, basePrice * 0.01);
    const high = Math.max(open, price) * (1 + Math.random() * 0.02);
    const low = Math.min(open, price) * (1 - Math.random() * 0.02);
    const close = price;
    const volume = basePrice * 1000000 * (0.5 + Math.random() * 2);

    data.push({
      timestamp: now - i * interval,
      open: parseFloat(open.toFixed(12)),
      high: parseFloat(high.toFixed(12)),
      low: parseFloat(low.toFixed(12)),
      close: parseFloat(close.toFixed(12)),
      volume: parseFloat(volume.toFixed(2)),
    });
  }

  return data;
}

router.get("/tokens", async (req, res): Promise<void> => {
  const query = ListTokensQueryParams.safeParse(req.query);
  const sort = query.success ? query.data.sort : "trending";
  const limit = query.success && query.data.limit ? query.data.limit : 50;

  let tokens = [...MOCK_TOKENS];

  switch (sort) {
    case "newest":
      tokens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case "marketCap":
      tokens.sort((a, b) => b.marketCap - a.marketCap);
      break;
    case "volume":
      tokens.sort((a, b) => b.volume24h - a.volume24h);
      break;
    case "trending":
    default:
      tokens.sort((a, b) => b.change24h - a.change24h);
      break;
  }

  res.json(tokens.slice(0, limit));
});

router.post("/tokens", async (req, res): Promise<void> => {
  const parsed = LaunchTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, ticker, description, website, twitter, telegram, logoColor, logoImage, totalSupply, creatorAddress } = parsed.data;

  const newToken: Token = {
    id: ticker.toLowerCase() + "-" + Date.now(),
    name,
    ticker: ticker.toUpperCase(),
    price: 0.000001,
    marketCap: 1000,
    volume24h: 0,
    change24h: 0,
    description,
    createdAt: new Date().toISOString(),
    creatorAddress: creatorAddress ?? ("arc1" + Math.random().toString(36).slice(2, 8) + "..." + Math.random().toString(36).slice(2, 6)),
    logoColor: logoColor ?? "#8b5cf6",
    logoUrl: logoImage ?? null,
    totalSupply: totalSupply ?? 1_000_000_000,
    holders: 1,
    txCount: 1,
    website: website ?? null,
    twitter: twitter ?? null,
    telegram: telegram ?? null,
  };

  MOCK_TOKENS.unshift(newToken);
  res.status(201).json(newToken);
});

router.get("/tokens/trending", async (_req, res): Promise<void> => {
  const trending = [...MOCK_TOKENS]
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, 6);
  res.json(trending);
});

router.get("/tokens/:id", async (req, res): Promise<void> => {
  const params = GetTokenParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const token = MOCK_TOKENS.find((t) => t.id === params.data.id);
  if (!token) {
    res.status(404).json({ error: "Token not found" });
    return;
  }

  res.json(token);
});

router.get("/tokens/:id/chart", async (req, res): Promise<void> => {
  const params = GetTokenChartParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const token = MOCK_TOKENS.find((t) => t.id === params.data.id);
  if (!token) {
    res.status(404).json({ error: "Token not found" });
    return;
  }

  const chart = generateChartData(token.price);
  res.json(chart);
});

export default router;
