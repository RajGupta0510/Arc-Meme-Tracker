import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, formatUnits, type Eip1193Provider } from "ethers";
import { formatBalance } from "@/lib/utils";

// Arc Network has two active testnet chain revisions: the new one (18 decimals) and the old one (6 decimals)
const ARC_TESTNET_NEW = {
  chainId: "0x4cef52",
  chainName: "Arc Network Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

const ARC_TESTNET_OLD = {
  chainId: "0x4e454153",
  chainName: "Arc Network Testnet (Old)",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: ["https://testnet-rpc.arcnetwork.io"],
  blockExplorerUrls: ["https://testnet-explorer.arcnetwork.io"],
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

// Module-level state to track active provider and synchronize all hook instances
let activeRdns: string | null = typeof window !== "undefined" ? window.localStorage.getItem("arcmeme.wallet_rdns") : null;
let activeProvider: any = null;
const providerAnnounceListeners = new Set<() => void>();

// Cache discovered EIP-6963 providers globally
const discoveredProviders = new Map<string, any>();

if (typeof window !== "undefined") {
  const handleAnnounce = (event: any) => {
    const detail = event.detail;
    if (!detail || !detail.info) return;

    discoveredProviders.set(detail.info.rdns, detail.provider);

    // If this matches the previously connected wallet session, restore it
    if (activeRdns && detail.info.rdns === activeRdns) {
      activeProvider = detail.provider;
      providerAnnounceListeners.forEach((l) => l());
    }
  };

  window.addEventListener("eip6963:announceProvider", handleAnnounce as EventListener);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function getEthereum(): Eip1193Provider | null {
  if (activeProvider) return activeProvider;
  if (typeof window !== "undefined" && window.ethereum !== undefined) {
    return window.ethereum as unknown as Eip1193Provider;
  }
  return null;
}

function getRawEthereum() {
  if (activeProvider) return activeProvider;
  if (typeof window !== "undefined" && window.ethereum !== undefined) {
    return window.ethereum;
  }
  return null;
}

function isOnArcTestnet(chainId: string) {
  return chainId.toLowerCase() === ARC_TESTNET_NEW.chainId.toLowerCase();
}

async function fetchUsdcBalance(address: string, chainId: string): Promise<string> {
  const eth = getEthereum();
  if (!eth) return "0.000";
  try {
    const provider = new BrowserProvider(eth);
    const rawBalance = await provider.getBalance(address);
    const isOld = chainId.toLowerCase() === ARC_TESTNET_OLD.chainId.toLowerCase();
    const decimals = isOld ? 6 : 18;
    return formatBalance(formatUnits(rawBalance, decimals));
  } catch (err) {
    console.error("[useWallet] fetchUsdcBalance failed:", err);
    return "0.000";
  }
}

export function useWallet() {
  const [trigger, setTrigger] = useState(0);
  const [state, setState] = useState<WalletState>(() => {
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem("arcmeme.wallet_connected");
      const address = window.localStorage.getItem("arcmeme.wallet_address");
      const chainId = window.localStorage.getItem("arcmeme.wallet_chain_id") || ARC_TESTNET_NEW.chainId;
      if (cached === "true" && address) {
        const onArc = isOnArcTestnet(chainId);
        return {
          status: "connected",
          address,
          chainId,
          isArcTestnet: onArc,
          usdcBalance: "—",
        };
      }
    }
    return { status: "disconnected" };
  });

  // Subscribe to EIP-6963 provider announcements to re-sync if the provider loaded late
  useEffect(() => {
    const handleUpdate = () => {
      setTrigger((prev) => prev + 1);
      updateConnectedState();
    };
    providerAnnounceListeners.add(handleUpdate);
    return () => {
      providerAnnounceListeners.delete(handleUpdate);
    };
  }, []);

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
          window.localStorage.removeItem("arcmeme.wallet_rdns");
        }
        return;
      }
      const provider = new BrowserProvider(getEthereum()!);
      const network = await provider.getNetwork();
      const chainId = "0x" + network.chainId.toString(16);
      const onArc = isOnArcTestnet(chainId);
      const usdcBalance = onArc ? await fetchUsdcBalance(accounts[0], chainId) : "0.000";

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
        window.localStorage.setItem("arcmeme.wallet_chain_id", chainId);
      }
    } catch {
      setState({ status: "disconnected" });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("arcmeme.wallet_connected");
        window.localStorage.removeItem("arcmeme.wallet_address");
        window.localStorage.removeItem("arcmeme.wallet_chain_id");
        window.localStorage.removeItem("arcmeme.wallet_rdns");
      }
    }
  }, []);

  // Periodically refresh balance when connected on Arc Testnet
  useEffect(() => {
    if (state.status !== "connected" || !state.isArcTestnet) return;
    const address = state.address;
    const interval = setInterval(async () => {
      const fresh = await fetchUsdcBalance(address, state.chainId);
      setState((prev) =>
        prev.status === "connected" ? { ...prev, usdcBalance: fresh } : prev
      );
    }, 15000);
    return () => clearInterval(interval);
  }, [state.status === "connected" && state.isArcTestnet, state.status === "connected" ? state.address : null, state.status === "connected" ? state.chainId : null]);

  // Handle provider events for the active provider
  const currentEth = getRawEthereum();
  useEffect(() => {
    if (!currentEth) return;

    updateConnectedState();

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (!accs || accs.length === 0) {
        setState({ status: "disconnected" });
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("arcmeme.wallet_connected");
          window.localStorage.removeItem("arcmeme.wallet_address");
          window.localStorage.removeItem("arcmeme.wallet_rdns");
        }
      } else {
        updateConnectedState();
      }
    };

    const handleChainChanged = () => {
      updateConnectedState();
    };

    currentEth.on("accountsChanged", handleAccountsChanged);
    currentEth.on("chainChanged", handleChainChanged);

    return () => {
      currentEth.removeListener("accountsChanged", handleAccountsChanged);
      currentEth.removeListener("chainChanged", handleChainChanged);
    };
  }, [updateConnectedState, currentEth]);

  const connect = useCallback(async (providerDetail?: any) => {
    if (providerDetail) {
      activeRdns = providerDetail.info.rdns;
      activeProvider = providerDetail.provider;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("arcmeme.wallet_rdns", providerDetail.info.rdns);
      }
      providerAnnounceListeners.forEach((l) => l());
    } else {
      const eth = getRawEthereum();
      if (!eth) {
        setState({
          status: "error",
          message: "No wallet provider detected.",
        });
        return;
      }
    }

    setState({ status: "connecting" });
    try {
      const eth = getRawEthereum();
      await eth.request({ method: "eth_requestAccounts" });
      await updateConnectedState();
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code === 4001) {
        setState({ status: "disconnected" });
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("arcmeme.wallet_connected");
          window.localStorage.removeItem("arcmeme.wallet_address");
          window.localStorage.removeItem("arcmeme.wallet_rdns");
        }
      } else {
        setState({ status: "error", message: "Failed to connect wallet." });
      }
    }
  }, [updateConnectedState]);

  const disconnect = useCallback(() => {
    setState({ status: "disconnected" });
    activeRdns = null;
    activeProvider = null;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("arcmeme.wallet_connected");
      window.localStorage.removeItem("arcmeme.wallet_address");
      window.localStorage.removeItem("arcmeme.wallet_chain_id");
      window.localStorage.removeItem("arcmeme.wallet_rdns");
    }
    providerAnnounceListeners.forEach((l) => l());
  }, []);

  const switchToArcTestnet = useCallback(async () => {
    const eth = getRawEthereum();
    if (!eth) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_TESTNET_NEW.chainId }],
      });
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [ARC_TESTNET_NEW],
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
    activeRdns,
  };
}
