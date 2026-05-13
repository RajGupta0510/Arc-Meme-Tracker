import { useState, useCallback } from "react";
import { BrowserProvider, ContractFactory, type Eip1193Provider, type InterfaceAbi } from "ethers";
import { MEME_TOKEN_ABI, MEME_TOKEN_BYTECODE } from "@/lib/erc20-artifact";

export const ARC_TESTNET_CHAIN_ID = "0x4E454153";
export const ARC_EXPLORER = "https://testnet-explorer.arcnetwork.io";

const ARC_TESTNET_PARAMS = {
  chainId: ARC_TESTNET_CHAIN_ID,
  chainName: "Arc Network Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: ["https://testnet-rpc.arcnetwork.io"],
  blockExplorerUrls: [ARC_EXPLORER],
};

export type DeployStatus =
  | { status: "idle" }
  | { status: "switching-network" }
  | { status: "confirming" }
  | { status: "deploying"; txHash: string }
  | { status: "success"; contractAddress: string; txHash: string }
  | { status: "error"; message: string };

export function useDeployToken() {
  const [deployStatus, setDeployStatus] = useState<DeployStatus>({ status: "idle" });

  const deploy = useCallback(
    async (
      name: string,
      symbol: string,
      totalSupply: number
    ): Promise<string | null> => {
      const eth = (window as { ethereum?: unknown }).ethereum;
      if (!eth) {
        setDeployStatus({
          status: "error",
          message: "MetaMask not found. Please install MetaMask to deploy.",
        });
        return null;
      }

      try {
        // Step 1: switch to Arc Testnet
        setDeployStatus({ status: "switching-network" });
        try {
          await (eth as { request: (args: unknown) => Promise<unknown> }).request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: ARC_TESTNET_CHAIN_ID }],
          });
        } catch (switchErr: unknown) {
          if ((switchErr as { code?: number }).code === 4902) {
            await (eth as { request: (args: unknown) => Promise<unknown> }).request({
              method: "wallet_addEthereumChain",
              params: [ARC_TESTNET_PARAMS],
            });
          } else {
            throw switchErr;
          }
        }

        // Step 2: ask MetaMask to sign the deploy tx
        setDeployStatus({ status: "confirming" });
        const provider = new BrowserProvider(eth as Eip1193Provider);
        const signer = await provider.getSigner();
        const factory = new ContractFactory(
          MEME_TOKEN_ABI as unknown as InterfaceAbi,
          MEME_TOKEN_BYTECODE,
          signer
        );

        const contract = await factory.deploy(name, symbol, BigInt(totalSupply));
        const txHash = contract.deploymentTransaction()?.hash ?? "";

        // Step 3: wait for the tx to be mined
        setDeployStatus({ status: "deploying", txHash });
        await contract.waitForDeployment();
        const contractAddress = await contract.getAddress();

        setDeployStatus({ status: "success", contractAddress, txHash });
        return contractAddress;
      } catch (err: unknown) {
        const code = (err as { code?: number }).code;
        const msg = (err as { message?: string }).message ?? "Deployment failed.";

        if (code === 4001) {
          setDeployStatus({ status: "error", message: "Transaction rejected in MetaMask." });
        } else {
          setDeployStatus({ status: "error", message: msg.slice(0, 200) });
        }
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => setDeployStatus({ status: "idle" }), []);

  return { deployStatus, deploy, reset };
}
