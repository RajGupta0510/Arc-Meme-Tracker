import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, type Eip1193Provider } from "ethers";

const ARC_TESTNET = {
  chainId: "0x4E454153",
  chainName: "Arc Network Testnet",
  nativeCurrency: { name: "ARC", symbol: "ARC", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.arcnetwork.io"],
  blockExplorerUrls: ["https://testnet-explorer.arcnetwork.io"],
};

export type WalletState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected"; address: string; chainId: string; isArcTestnet: boolean }
  | { status: "error"; message: string };

function getEthereum(): Eip1193Provider | null {
  if (typeof window !== "undefined" && window.ethereum !== undefined) {
    return window.ethereum as unknown as Eip1193Provider;
  }
  return null;
}

function getRawEthereum() {
  if (typeof window !== "undefined" && window.ethereum !== undefined) {
    return window.ethereum;
  }
  return null;
}

function isArcTestnet(chainId: string) {
  return chainId.toLowerCase() === ARC_TESTNET.chainId.toLowerCase();
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({ status: "disconnected" });

  const getShortAddress = (address: string) =>
    address.slice(0, 6) + "..." + address.slice(-4);

  const updateConnectedState = useCallback(async () => {
    const eth = getRawEthereum();
    if (!eth) return;
    try {
      const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
      if (!accounts || accounts.length === 0) {
        setState({ status: "disconnected" });
        return;
      }
      const provider = new BrowserProvider(getEthereum()!);
      const network = await provider.getNetwork();
      const chainId = "0x" + network.chainId.toString(16);
      setState({
        status: "connected",
        address: accounts[0],
        chainId,
        isArcTestnet: isArcTestnet(chainId),
      });
    } catch {
      setState({ status: "disconnected" });
    }
  }, []);

  useEffect(() => {
    const eth = getRawEthereum();
    if (!eth) return;

    updateConnectedState();

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (!accs || accs.length === 0) {
        setState({ status: "disconnected" });
      } else {
        updateConnectedState();
      }
    };

    const handleChainChanged = () => {
      updateConnectedState();
    };

    eth.on("accountsChanged", handleAccountsChanged);
    eth.on("chainChanged", handleChainChanged);

    return () => {
      eth.removeListener("accountsChanged", handleAccountsChanged);
      eth.removeListener("chainChanged", handleChainChanged);
    };
  }, [updateConnectedState]);

  const connect = useCallback(async () => {
    const eth = getRawEthereum();
    if (!eth) {
      setState({
        status: "error",
        message: "MetaMask not detected. Please install the MetaMask extension.",
      });
      return;
    }

    setState({ status: "connecting" });
    try {
      await eth.request({ method: "eth_requestAccounts" });
      await updateConnectedState();
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code === 4001) {
        setState({ status: "disconnected" });
      } else {
        setState({ status: "error", message: "Failed to connect wallet." });
      }
    }
  }, [updateConnectedState]);

  const disconnect = useCallback(() => {
    setState({ status: "disconnected" });
  }, []);

  const switchToArcTestnet = useCallback(async () => {
    const eth = getRawEthereum();
    if (!eth) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_TESTNET.chainId }],
      });
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [ARC_TESTNET],
        });
      }
    }
  }, []);

  return {
    state,
    connect,
    disconnect,
    switchToArcTestnet,
    getShortAddress,
    isMetaMaskAvailable: getRawEthereum() !== null,
  };
}
