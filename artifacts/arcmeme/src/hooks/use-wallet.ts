import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, formatUnits, type Eip1193Provider } from "ethers";
import { formatBalance } from "@/lib/utils";

// Arc Network uses native USDC as the gas token (18 native decimals)
const ARC_TESTNET = {
  chainId: "0x4cef52",
  chainName: "Arc Network Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

export type WalletState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | {
      status: "connected";
      address: string;
      chainId: string;
      isArcTestnet: boolean;
      usdcBalance: string;
    }
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

function isOnArcTestnet(chainId: string) {
  return chainId.toLowerCase() === ARC_TESTNET.chainId.toLowerCase();
}

async function fetchUsdcBalance(address: string): Promise<string> {
  const eth = getEthereum();
  if (!eth) return "0.000";
  try {
    const provider = new BrowserProvider(eth);
    const rawBalance = await provider.getBalance(address);
    return formatBalance(formatUnits(rawBalance, 18));
  } catch {
    return "0.000";
  }
}

export function useWallet() {
  const [state, setState] = useState<WalletState>(() => {
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem("arcmeme.wallet_connected");
      const address = window.localStorage.getItem("arcmeme.wallet_address");
      if (cached === "true" && address) {
        return {
          status: "connected",
          address,
          chainId: "0x4cef52",
          isArcTestnet: true,
          usdcBalance: "—",
        };
      }
    }
    return { status: "disconnected" };
  });

  const getShortAddress = (address: string) =>
    address.slice(0, 6) + "..." + address.slice(-4);

  const updateConnectedState = useCallback(async () => {
    const eth = getRawEthereum();
    if (!eth) return;
    try {
      const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
      if (!accounts || accounts.length === 0) {
        setState({ status: "disconnected" });
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("arcmeme.wallet_connected");
          window.localStorage.removeItem("arcmeme.wallet_address");
        }
        return;
      }
      const provider = new BrowserProvider(getEthereum()!);
      const network = await provider.getNetwork();
      const chainId = "0x" + network.chainId.toString(16);
      const onArc = isOnArcTestnet(chainId);
      const usdcBalance = onArc ? await fetchUsdcBalance(accounts[0]) : "0.000";

      setState({
        status: "connected",
        address: accounts[0],
        chainId,
        isArcTestnet: onArc,
        usdcBalance,
      });

      if (typeof window !== "undefined") {
        window.localStorage.setItem("arcmeme.wallet_connected", "true");
        window.localStorage.setItem("arcmeme.wallet_address", accounts[0]);
      }
    } catch {
      setState({ status: "disconnected" });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("arcmeme.wallet_connected");
        window.localStorage.removeItem("arcmeme.wallet_address");
      }
    }
  }, []);

  // Periodically refresh balance when connected on Arc Testnet
  useEffect(() => {
    if (state.status !== "connected" || !state.isArcTestnet) return;
    const address = state.address;
    const interval = setInterval(async () => {
      const fresh = await fetchUsdcBalance(address);
      setState((prev) =>
        prev.status === "connected" ? { ...prev, usdcBalance: fresh } : prev
      );
    }, 15000);
    return () => clearInterval(interval);
  }, [state.status === "connected" && state.isArcTestnet, state.status === "connected" ? state.address : null]);

  useEffect(() => {
    const eth = getRawEthereum();
    if (!eth) return;

    updateConnectedState();

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (!accs || accs.length === 0) {
        setState({ status: "disconnected" });
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("arcmeme.wallet_connected");
          window.localStorage.removeItem("arcmeme.wallet_address");
        }
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
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("arcmeme.wallet_connected");
          window.localStorage.removeItem("arcmeme.wallet_address");
        }
      } else {
        setState({ status: "error", message: "Failed to connect wallet." });
      }
    }
  }, [updateConnectedState]);

  const disconnect = useCallback(() => {
    setState({ status: "disconnected" });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("arcmeme.wallet_connected");
      window.localStorage.removeItem("arcmeme.wallet_address");
    }
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
    refresh: updateConnectedState,
    getShortAddress,
    isMetaMaskAvailable: getRawEthereum() !== null,
  };
}
