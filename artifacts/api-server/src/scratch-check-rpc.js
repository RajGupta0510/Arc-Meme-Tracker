import { JsonRpcProvider, formatUnits } from "ethers";

const RPC_URL = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;

const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID);

async function test() {
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log("Current block number:", blockNumber);

    // Let's query the native balance of the trader address we saw in the DB: 0xef0642c9d173db4be17eb19e8d6c74eb86d1f2bc
    const traderAddress = "0xef0642c9d173db4be17eb19e8d6c74eb86d1f2bc";
    const balance = await provider.getBalance(traderAddress);
    console.log("Raw native balance of trader in wei:", balance.toString());
    console.log("Formatted with 18 decimals:", formatUnits(balance, 18));
    console.log("Formatted with 6 decimals:", formatUnits(balance, 6));

    // Let's query WUSDC balance of the trader address
    // WUSDC address from ApexiSwap is 0x911b4000D3422F482F4062a913885f7b035382Df
    const wusdcAddress = "0x911b4000D3422F482F4062a913885f7b035382Df";
    const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
    
    // Let's create contract
    const { Contract } = await import("ethers");
    const wusdcContract = new Contract(wusdcAddress, abi, provider);
    const decimals = await wusdcContract.decimals();
    console.log("WUSDC Decimals:", decimals);
    const wusdcBalance = await wusdcContract.balanceOf(traderAddress);
    console.log("WUSDC raw balance of trader:", wusdcBalance.toString());
    console.log("WUSDC formatted:", formatUnits(wusdcBalance, decimals));
  } catch (err) {
    console.error("Error during RPC test:", err);
  }
}

test();
