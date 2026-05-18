# ArcMeme Real Trading Prototype

This note captures the first non-invasive prototype for moving ArcMeme from simulated token stats to on-chain TOKEN/USDC trading on Arc Testnet.

## Arc AMM Options

Arc Testnet is EVM-compatible and supports normal JSON-RPC reads/writes. The best documented AMM/router option found for Arc Testnet is ApexiSwap, which publishes Uniswap V2-style router/factory/WUSDC contracts:

- ApexiSwap router: `0x437b1aBf6e5a69548849b15EC35f83A73Fa1E28F`
- ApexiSwap factory: `0x2B865487A1008D2694C1D367c761f00a564aCECb`
- ApexiSwap WUSDC: `0x911b4000D3422F482F4062a913885f7b035382Df`
- Unit Flow router: `0x4AA8c7Ac458479d9A4FA5c1481e03061ac76824A`
- Achswap router: `0xB92428D440c335546b69138F7fAF689F5ba8D436`

The prototype constants and helper functions live in `src/lib/arc-amm.ts`.

## TOKEN/USDC Pool Creation

An ERC20 token is not tradeable immediately after deployment. After launch, ArcMeme needs a market creation step:

1. Deploy the meme ERC20.
2. Create or find the TOKEN/WUSDC pair through the selected factory.
3. Wrap native Arc USDC into the router's WUSDC when needed.
4. Approve the router to spend the launched token and WUSDC.
5. Call `addLiquidity(token, WUSDC, tokenAmount, wusdcAmount, minToken, minWusdc, to, deadline)`.
6. Store the returned/created `pairAddress` and AMM id in the backend token record.

The current token launcher only does step 1 and metadata persistence. Steps 2-6 should be added as an explicit "seed liquidity" flow rather than hidden inside metadata save.

## Approve Flow

Every ERC20 spend by a router needs allowance:

- Selling TOKEN requires `TOKEN.approve(router, amount)`.
- Adding liquidity requires approval for both TOKEN and WUSDC.
- Buying with native USDC through ApexiSwap's `swapExactETHForTokens...` path does not require a USDC ERC20 allowance, because native USDC is sent as transaction value and wrapped by the router flow.

Arc also exposes native USDC through an ERC20 interface at `0x3600000000000000000000000000000000000000`, but current ApexiSwap docs use router-specific WUSDC contracts for AMM paths.

## Swap Execution

For the first ArcMeme trading implementation, use ApexiSwap as the primary route:

- Buy: `swapExactETHForTokensSupportingFeeOnTransferTokens(amountOutMin, [WUSDC, TOKEN], user, deadline, { value })`
- Sell: approve TOKEN, then `swapExactTokensForETHSupportingFeeOnTransferTokens(amountIn, amountOutMin, [TOKEN, WUSDC], user, deadline)`

The UI needs slippage controls before this is connected to the existing trade button. The minimum output should be calculated from reserves or `getAmountsOut`, then reduced by the user's slippage tolerance.

## Reserves And Price

For Uniswap V2-style pools:

- Pair reserves come from `pair.getReserves()`.
- `pair.token0()` and `pair.token1()` determine which reserve belongs to TOKEN vs WUSDC.
- TOKEN price in USDC is `quoteReserve / baseReserve`, normalized by token decimals.
- Quote output uses the constant product formula:

```ts
amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
```

The prototype exposes `readPairReserves`, `normalizeReserves`, `calculatePoolPrice`, and `calculateAmountOut`.

## Event Indexing

Frontend reserve polling is acceptable for a prototype, but production live markets need backend indexing:

1. Store `pairAddress`, `ammId`, `baseToken`, `quoteToken`, `createdBlock`.
2. Poll Arc RPC logs for each pair's `Swap`, `Mint`, `Burn`, and `Sync` events.
3. Store swap rows keyed by `transactionHash + logIndex`.
4. Aggregate 1m/5m candles into a chart table.
5. Update token `price`, `volume24h`, `liquidity`, `txCount`, and `change24h` from indexed data.
6. Expose API endpoints for token market state and transaction history.

The Graph supports Arc Testnet as `arc-testnet`, so a subgraph is also viable once the pool schema settles. For early local development, a lightweight backend poller with SQLite is faster to iterate.

## Backend Schema Additions Needed

The token table should gain market fields before the UI uses real swaps:

- `marketType`: `unlisted | amm_pool | bonding_curve`
- `ammId`
- `routerAddress`
- `factoryAddress`
- `pairAddress`
- `quoteTokenAddress`
- `quoteTokenSymbol`
- `liquidityUsd`
- `lastIndexedBlock`
- `lastIndexedAt`

Add a `trades` table for history:

- `id`
- `tokenId`
- `pairAddress`
- `txHash`
- `logIndex`
- `blockNumber`
- `timestamp`
- `side`
- `amountToken`
- `amountQuote`
- `priceQuote`
- `trader`

Add a `candles` table for charts:

- `tokenId`
- `pairAddress`
- `interval`
- `bucketStart`
- `open`
- `high`
- `low`
- `close`
- `volume`

## Recommended Next Implementation Order

1. Add DB fields for market state and pair address.
2. Add a "Create liquidity pool" action after token deployment.
3. Persist pair address and launch block.
4. Replace random chart generation with indexed swap candles.
5. Replace token card stats with indexed price/volume/liquidity.
6. Connect the buy/sell button to ApexiSwap swap functions with slippage protection.
7. Add transaction history from indexed `Swap` events.

