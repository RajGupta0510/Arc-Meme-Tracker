import { useState, useEffect } from "react";
import type { Eip1193Provider } from "ethers";

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string; // Base64 SVG data URI
  rdns: string; // Reverse domain name identifier, e.g. "io.metamask"
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: Eip1193Provider;
}

export interface EIP6963AnnounceProviderEvent extends Event {
  detail: EIP6963ProviderDetail;
}

/**
 * Custom hook to dynamically discover EIP-6963 injected wallet providers.
 * Dispatches a request for providers and listens for announcements.
 */
export function useEIP6963() {
  const [providers, setProviders] = useState<EIP6963ProviderDetail[]>([]);

  useEffect(() => {
    const handleAnnounce = (event: Event) => {
      const announceEvent = event as EIP6963AnnounceProviderEvent;
      if (!announceEvent.detail || !announceEvent.detail.info) return;

      setProviders((prev) => {
        // Avoid duplicate provider entries based on their unique UUID
        if (prev.some((p) => p.info.uuid === announceEvent.detail.info.uuid)) {
          return prev;
        }
        return [...prev, announceEvent.detail];
      });
    };

    window.addEventListener("eip6963:announceProvider", handleAnnounce as EventListener);

    // Dispatch the request event to discover already-injected providers
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    return () => {
      window.removeEventListener("eip6963:announceProvider", handleAnnounce as EventListener);
    };
  }, []);

  return providers;
}
