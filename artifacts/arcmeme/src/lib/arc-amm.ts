import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  MaxUint256,
  formatUnits,
  parseUnits,
  type BigNumberish,
  type ContractRunner,
  type Eip1193Provider,
  type EventLog,
  type Log,
  type Provider,
  type Signer,
} from "ethers";

export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_TESTNET_RPC_URL = "https://rpc.testnet.arc.network";

// Arc's native USDC has an ERC-20 interface for approve/transferFrom flows.
// Native gas accounting uses 18 decimals; this ERC-20 interface uses 6 decimals.
export const ARC_USDC_ERC20_ADDRESS = "0x3600000000000000000000000000000000000000";

export type ArcAmmRouterKind = "apexiswap-v1" | "unitflow-v2" | "uniswap-v2";

export type ArcAmmConfig = {
  id: string;
  name: string;
  routerKind: ArcAmmRouterKind;
  routerAddress: string;
  factoryAddress: string;
  wusdcAddress: string;
  externalProtocolFeeNative?: bigint;
};

export const ARC_AMM_OPTIONS: ArcAmmConfig[] = [
  {
    id: "apexiswap",
    name: "ApexiSwap",
    routerKind: "apexiswap-v1",
    routerAddress: "0x437b1aBf6e5a69548849b15EC35f83A73Fa1E28F",
    factoryAddress: "0x2B865487A1008D2694C1D367c761f00a564aCECb",
    wusdcAddress: "0x911b4000D3422F482F4062a913885f7b035382Df",
  },
  {
    id: "unitflow",
    name: "Unit Flow",
    routerKind: "unitflow-v2",
    routerAddress: "0x4AA8c7Ac458479d9A4FA5c1481e03061ac76824A",
    factoryAddress: "0xd67F63A4F26a497b364d1C82e6747Aec8B5743a5",
    wusdcAddress: "0xc856c3627ba9461087c4e89a058f737d5c0a545d",
    externalProtocolFeeNative: parseUnits("0.0013", 18),
  },
  {
    id: "achswap",
    name: "Achswap",
    routerKind: "uniswap-v2",
    routerAddress: "0xB92428D440c335546b69138F7fAF689F5ba8D436",
    factoryAddress: "0x7cC023C7184810B84657D55c1943eBfF8603B72B",
    wusdcAddress: "0xDe5DB9049a8dd344dC1B7Bbb098f9da60930A6dA",
    externalProtocolFeeNative: parseUnits("0.0013", 18),
  },
];

export const DEFAULT_ARC_AMM = ARC_AMM_OPTIONS[0];

export const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
] as const;

export const WUSDC_ABI = [
  ...ERC20_ABI,
  "function deposit() payable",
  "function withdraw(uint256 wad)",
] as const;

export const UNISWAP_V2_FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)",
  "function createPair(address tokenA, address tokenB) returns (address pair)",
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
] as const;

export const UNISWAP_V2_PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "event Mint(address indexed sender, uint256 amount0, uint256 amount1)",
  "event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)",
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
  "event Sync(uint112 reserve0, uint112 reserve1)",
] as const;

export const UNISWAP_V2_ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] memory amounts)",
  "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) payable returns (uint256[] memory amounts)",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)",
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)",
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) payable",
] as const;

export type PairReserves = {
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  blockTimestampLast: number;
};

export type NormalizedReserves = PairReserves & {
  baseToken: string;
  quoteToken: string;
  baseReserve: bigint;
  quoteReserve: bigint;
};

export type SwapHistoryItem = {
  pairAddress: string;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  sender: string;
  to: string;
  amount0In: bigint;
  amount1In: bigint;
  amount0Out: bigint;
  amount1Out: bigint;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isEventLog(log: EventLog | Log): log is EventLog {
  return "args" in log;
}

function sameAddress(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function toDeadline(secondsFromNow = 60 * 20) {
  return Math.floor(Date.now() / 1000) + secondsFromNow;
}

export function getArcReadProvider(rpcUrl = ARC_TESTNET_RPC_URL) {
  return new JsonRpcProvider(rpcUrl, ARC_TESTNET_CHAIN_ID);
}

export async function getBrowserSigner(ethereum: Eip1193Provider) {
  const provider = new BrowserProvider(ethereum);
  return provider.getSigner();
}

export function getErc20Contract(address: string, runner: ContractRunner) {
  return new Contract(address, ERC20_ABI, runner);
}

export function getWusdcContract(address: string, runner: ContractRunner) {
  return new Contract(address, WUSDC_ABI, runner);
}

export function getFactoryContract(amm: ArcAmmConfig, runner: ContractRunner) {
  return new Contract(amm.factoryAddress, UNISWAP_V2_FACTORY_ABI, runner);
}

export function getPairContract(pairAddress: string, runner: ContractRunner) {
  return new Contract(pairAddress, UNISWAP_V2_PAIR_ABI, runner);
}

export function getRouterContract(amm: ArcAmmConfig, runner: ContractRunner) {
  return new Contract(amm.routerAddress, UNISWAP_V2_ROUTER_ABI, runner);
}

export async function readTokenDecimals(tokenAddress: string, runner: ContractRunner) {
  const token = getErc20Contract(tokenAddress, runner);
  return Number(await token.decimals());
}

export async function approveIfNeeded(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  amount: bigint,
  signer: Signer,
) {
  const token = getErc20Contract(tokenAddress, signer);
  const allowance = BigInt(await token.allowance(ownerAddress, spenderAddress));

  if (allowance >= amount) {
    return { approved: false, allowance };
  }

  const tx = await token.approve(spenderAddress, amount);
  await tx.wait();
  return { approved: true, allowance: amount, txHash: tx.hash as string };
}

export async function approveMaxIfNeeded(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  signer: Signer,
) {
  return approveIfNeeded(tokenAddress, ownerAddress, spenderAddress, MaxUint256, signer);
}

export async function wrapNativeUsdc(amountNativeUsdcWei: bigint, amm: ArcAmmConfig, signer: Signer) {
  const wusdc = getWusdcContract(amm.wusdcAddress, signer);
  const tx = await wusdc.deposit({ value: amountNativeUsdcWei });
  await tx.wait();
  return tx.hash as string;
}

export async function unwrapNativeUsdc(amountWusdc: bigint, amm: ArcAmmConfig, signer: Signer) {
  const wusdc = getWusdcContract(amm.wusdcAddress, signer);
  const tx = await wusdc.withdraw(amountWusdc);
  await tx.wait();
  return tx.hash as string;
}

export async function getTokenUsdcPairAddress(
  tokenAddress: string,
  amm: ArcAmmConfig = DEFAULT_ARC_AMM,
  runner: ContractRunner = getArcReadProvider(),
) {
  const factory = getFactoryContract(amm, runner);
  const pair = String(await factory.getPair(tokenAddress, amm.wusdcAddress));
  return sameAddress(pair, ZERO_ADDRESS) ? null : pair;
}

export async function createTokenUsdcPair(
  tokenAddress: string,
  amm: ArcAmmConfig,
  signer: Signer,
) {
  const existingPair = await getTokenUsdcPairAddress(tokenAddress, amm, signer.provider ?? signer);
  if (existingPair) return { pairAddress: existingPair, created: false };

  const factory = getFactoryContract(amm, signer);
  const tx = await factory.createPair(tokenAddress, amm.wusdcAddress);
  const receipt = await tx.wait();
  const pairCreated = receipt?.logs
    ?.map((log: Log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed: ReturnType<typeof factory.interface.parseLog> | null) => parsed?.name === "PairCreated");

  const pairAddress = pairCreated?.args?.pair
    ? String(pairCreated.args.pair)
    : await getTokenUsdcPairAddress(tokenAddress, amm, signer.provider ?? signer);

  if (!pairAddress) {
    throw new Error("Pair creation transaction succeeded, but no pair address was found.");
  }

  return { pairAddress, created: true, txHash: tx.hash as string };
}

export async function readPairReserves(
  pairAddress: string,
  provider: Provider = getArcReadProvider(),
): Promise<PairReserves> {
  const pair = getPairContract(pairAddress, provider);
  const [token0, token1, reserves] = await Promise.all([
    pair.token0(),
    pair.token1(),
    pair.getReserves(),
  ]);

  return {
    pairAddress,
    token0: String(token0),
    token1: String(token1),
    reserve0: BigInt(reserves[0]),
    reserve1: BigInt(reserves[1]),
    blockTimestampLast: Number(reserves[2]),
  };
}

export function normalizeReserves(
  reserves: PairReserves,
  baseToken: string,
  quoteToken: string,
): NormalizedReserves {
  if (sameAddress(reserves.token0, baseToken) && sameAddress(reserves.token1, quoteToken)) {
    return {
      ...reserves,
      baseToken,
      quoteToken,
      baseReserve: reserves.reserve0,
      quoteReserve: reserves.reserve1,
    };
  }

  if (sameAddress(reserves.token1, baseToken) && sameAddress(reserves.token0, quoteToken)) {
    return {
      ...reserves,
      baseToken,
      quoteToken,
      baseReserve: reserves.reserve1,
      quoteReserve: reserves.reserve0,
    };
  }

  throw new Error("Pair reserves do not match the requested base/quote tokens.");
}

export function calculatePoolPrice(
  baseReserve: bigint,
  quoteReserve: bigint,
  baseDecimals: number,
  quoteDecimals: number,
) {
  const base = Number(formatUnits(baseReserve, baseDecimals));
  const quote = Number(formatUnits(quoteReserve, quoteDecimals));
  if (!Number.isFinite(base) || !Number.isFinite(quote) || base <= 0) return 0;
  return quote / base;
}

export function calculateAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps = 30,
) {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const feeDenominator = 10_000n;
  const amountInWithFee = amountIn * BigInt(10_000 - feeBps);
  return (amountInWithFee * reserveOut) / (reserveIn * feeDenominator + amountInWithFee);
}

export function calculateAmountIn(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps = 30,
) {
  if (amountOut <= 0n || reserveIn <= 0n || reserveOut <= 0n || amountOut >= reserveOut) return 0n;
  const feeDenominator = 10_000n;
  const feeNumerator = BigInt(10_000 - feeBps);
  return (reserveIn * amountOut * feeDenominator) / ((reserveOut - amountOut) * feeNumerator) + 1n;
}

export async function quoteTokenUsdcBuy(
  tokenAddress: string,
  usdcAmount: string,
  amm: ArcAmmConfig = DEFAULT_ARC_AMM,
  provider: Provider = getArcReadProvider(),
) {
  const pairAddress = await getTokenUsdcPairAddress(tokenAddress, amm, provider);
  if (!pairAddress) return null;

  const reserves = normalizeReserves(
    await readPairReserves(pairAddress, provider),
    tokenAddress,
    amm.wusdcAddress,
  );
  const amountIn = parseUnits(usdcAmount, 18);
  const amountOut = calculateAmountOut(amountIn, reserves.quoteReserve, reserves.baseReserve);

  return {
    pairAddress,
    amountIn,
    amountOut,
    reserves,
  };
}

export async function addTokenUsdcLiquidity(params: {
  tokenAddress: string;
  tokenAmount: string;
  tokenDecimals: number;
  wusdcAmount: string;
  slippageBps?: number;
  amm?: ArcAmmConfig;
  signer: Signer;
}) {
  const amm = params.amm ?? DEFAULT_ARC_AMM;
  const signerAddress = await params.signer.getAddress();
  const router = getRouterContract(amm, params.signer);
  const tokenAmount = parseUnits(params.tokenAmount, params.tokenDecimals);
  const wusdcAmount = parseUnits(params.wusdcAmount, 18);
  const slippageBps = BigInt(params.slippageBps ?? 100);
  const amountTokenMin = tokenAmount - (tokenAmount * slippageBps) / 10_000n;
  const amountWusdcMin = wusdcAmount - (wusdcAmount * slippageBps) / 10_000n;

  await approveIfNeeded(params.tokenAddress, signerAddress, amm.routerAddress, tokenAmount, params.signer);
  await approveIfNeeded(amm.wusdcAddress, signerAddress, amm.routerAddress, wusdcAmount, params.signer);

  const tx = await router.addLiquidity(
    params.tokenAddress,
    amm.wusdcAddress,
    tokenAmount,
    wusdcAmount,
    amountTokenMin,
    amountWusdcMin,
    signerAddress,
    toDeadline(),
  );
  await tx.wait();
  return tx.hash as string;
}

export async function buyTokenWithNativeUsdc(params: {
  tokenAddress: string;
  nativeUsdcAmount: string;
  amountOutMin: BigNumberish;
  amm?: ArcAmmConfig;
  signer: Signer;
}) {
  const amm = params.amm ?? DEFAULT_ARC_AMM;
  const router = getRouterContract(amm, params.signer);
  const signerAddress = await params.signer.getAddress();
  const path = [amm.wusdcAddress, params.tokenAddress];
  const value = parseUnits(params.nativeUsdcAmount, 18);

  const tx =
    amm.routerKind === "apexiswap-v1"
      ? await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          params.amountOutMin,
          path,
          signerAddress,
          toDeadline(),
          { value },
        )
      : await router.swapExactETHForTokens(params.amountOutMin, path, signerAddress, toDeadline(), {
          value: value + (amm.externalProtocolFeeNative ?? 0n),
        });

  await tx.wait();
  return tx.hash as string;
}

export async function sellTokenForNativeUsdc(params: {
  tokenAddress: string;
  tokenAmount: string;
  tokenDecimals: number;
  amountOutMin: BigNumberish;
  amm?: ArcAmmConfig;
  signer: Signer;
}) {
  const amm = params.amm ?? DEFAULT_ARC_AMM;
  const router = getRouterContract(amm, params.signer);
  const signerAddress = await params.signer.getAddress();
  const amountIn = parseUnits(params.tokenAmount, params.tokenDecimals);
  const path = [params.tokenAddress, amm.wusdcAddress];

  await approveIfNeeded(params.tokenAddress, signerAddress, amm.routerAddress, amountIn, params.signer);

  const tx =
    amm.routerKind === "apexiswap-v1"
      ? await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
          amountIn,
          params.amountOutMin,
          path,
          signerAddress,
          toDeadline(),
        )
      : await router.swapExactTokensForETH(amountIn, params.amountOutMin, path, signerAddress, toDeadline(), {
          value: amm.externalProtocolFeeNative ?? 0n,
        });

  await tx.wait();
  return tx.hash as string;
}

export async function readSwapHistory(params: {
  pairAddress: string;
  provider?: Provider;
  fromBlock: number;
  toBlock?: number | "latest";
}): Promise<SwapHistoryItem[]> {
  const provider = params.provider ?? getArcReadProvider();
  const pair = getPairContract(params.pairAddress, provider);
  const logs = await pair.queryFilter(pair.filters.Swap(), params.fromBlock, params.toBlock ?? "latest");

  return logs.filter(isEventLog).map((log) => ({
    pairAddress: params.pairAddress,
    txHash: log.transactionHash,
    logIndex: log.index,
    blockNumber: log.blockNumber,
    sender: String(log.args.sender),
    to: String(log.args.to),
    amount0In: BigInt(log.args.amount0In),
    amount1In: BigInt(log.args.amount1In),
    amount0Out: BigInt(log.args.amount0Out),
    amount1Out: BigInt(log.args.amount1Out),
  }));
}
