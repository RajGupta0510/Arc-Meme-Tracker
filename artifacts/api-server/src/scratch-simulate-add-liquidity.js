import { JsonRpcProvider, Contract, parseUnits } from "ethers";

const RPC_URL = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;

const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID);

async function test() {
  try {
    const traderAddress = "0xef0642c9d173db4be17eb19e8d6c74eb86d1f2bc";
    const tokenAddress = "0x253232FE8d9432a2B1b23bDD74a7e8aBf575Bf6e";
    const wusdcAddress = "0x911b4000D3422F482F4062a913885f7b035382Df";
    const routerAddress = "0x437b1aBf6e5a69548849b15EC35f83A73Fa1E28F";

    const routerAbi = [
      "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB, uint256 liquidity)"
    ];

    const erc20Abi = [
      "function allowance(address, address) view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];

    const tokenContract = new Contract(tokenAddress, erc20Abi, provider);
    const wusdcContract = new Contract(wusdcAddress, [...erc20Abi, "function deposit() payable"], provider);
    const routerContract = new Contract(routerAddress, routerAbi, provider);

    const tokenCode = await provider.getCode(tokenAddress);
    console.log("Token contract code length:", tokenCode.length);
    if (tokenCode === "0x") {
      console.log("CRITICAL: Token contract is NOT deployed on this chain!");
      return;
    }
    const tokenDecimals = Number(await tokenContract.decimals());
    const wusdcDecimals = Number(await wusdcContract.decimals());

    console.log("Token decimals:", tokenDecimals);
    console.log("WUSDC decimals:", wusdcDecimals);

    const tokenBalance = await tokenContract.balanceOf(traderAddress);
    const wusdcBalance = await wusdcContract.balanceOf(traderAddress);
    const nativeBalance = await provider.getBalance(traderAddress);

    console.log("Token Balance:", tokenBalance.toString());
    console.log("WUSDC Balance:", wusdcBalance.toString());
    console.log("Native balance:", nativeBalance.toString());

    const tokenAllowance = await tokenContract.allowance(traderAddress, routerAddress);
    const wusdcAllowance = await wusdcContract.allowance(traderAddress, routerAddress);

    console.log("Token router allowance:", tokenAllowance.toString());
    console.log("WUSDC router allowance:", wusdcAllowance.toString());

    // Params
    const amountADesired = parseUnits("200", tokenDecimals);
    const amountBDesired = 197062499444932620956n; // The exact value from the UI
    const amountAMin = amountADesired * 99n / 100n;
    const amountBMin = amountBDesired * 99n / 100n;
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    console.log("Simulating deposit call on WUSDC...");
    const depositTx = await wusdcContract.deposit.populateTransaction({ value: parseUnits("1", 18) });

    // Estimate gas as the trader
    try {
      const gasDeposit = await provider.estimateGas({
        ...depositTx,
        from: traderAddress
      });
      console.log("Deposit gas estimation succeeded:", gasDeposit.toString());
    } catch (gasErr) {
      console.error("Deposit gas estimation failed:");
      console.dir(gasErr, { depth: null });
    }

    console.log("Simulating addLiquidity call...");
    const simulated = await routerContract.addLiquidity.populateTransaction(
      tokenAddress,
      wusdcAddress,
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      traderAddress,
      deadline
    );

    // Estimate gas as the trader
    try {
      const gas = await provider.estimateGas({
        ...simulated,
        from: traderAddress
      });
      console.log("Gas estimation succeeded:", gas.toString());
    } catch (gasErr) {
      console.error("Gas estimation failed:");
      console.dir(gasErr, { depth: null });
    }

  } catch (err) {
    console.error("Error during test:", err);
  }
}

test();
