import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEIP6963, type EIP6963ProviderDetail } from "@/hooks/use-eip6963";
import { ArrowUpRight } from "lucide-react";

// --- Vector SVGs for recommended/uninstalled wallets ---
const MetaMaskIcon = () => (
  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 12L18.4 5.3L15.3 10.3L16.4 11.2L22 12Z" fill="#E2761B"/>
    <path d="M2 12L5.6 5.3L8.7 10.3L7.6 11.2L2 12Z" fill="#E4761B"/>
    <path d="M19.7 15.6L18 18.2L12 21.6L6 18.2L4.3 15.6L8 15.3L10.3 16.7L12 15.6L13.7 16.7L16 15.3L19.7 15.6Z" fill="#E4761B"/>
    <path d="M12 2L17.7 5.6L15.3 10.3L12 8L8.7 10.3L6.3 5.6L12 2Z" fill="#E4762B"/>
    <path d="M12 11.6L15.3 10.3L16 15.3L13.7 16.7L12 14.8L10.3 16.7L8 15.3L8.7 10.3L12 11.6Z" fill="#F6851B"/>
    <path d="M12 14.8L13.7 16.7L12 21.6L10.3 16.7L12 14.8Z" fill="#D7C1B1"/>
  </svg>
);

const PhantomIcon = () => (
  <svg className="h-7 w-7 rounded" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#4E44CE"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M12 5C8.13401 5 5 8.13401 5 12C5 14.4754 6.28479 16.6508 8.21989 17.8967C8.59969 18.1413 9.10265 18.0673 9.38714 17.7176L10.5317 16.311C10.7417 16.0528 10.7169 15.6791 10.4764 15.4503C9.07185 14.1143 9 13.0645 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12C15 13.0645 14.9281 14.1143 13.5236 15.4503C13.2831 15.6791 13.2583 16.0528 13.4683 16.311L14.6129 17.7176C14.8974 18.0673 15.4003 18.1413 15.7801 17.8967C17.7152 16.6508 19 14.4754 19 12C19 8.13401 15.866 5 12 5ZM10.5 11C11.0523 11 11.5 10.5523 11.5 10C11.5 9.44772 11.0523 9 10.5 9C9.94772 9 9.5 9.44772 9.5 10C9.5 10.5523 9.94772 11 10.5 11ZM13.5 11C14.0523 11 14.5 10.5523 14.5 10C14.5 9.44772 14.0523 9 13.5 9C12.9477 9 12.5 9.44772 12.5 10C12.5 10.5523 12.9477 11 13.5 11Z" fill="white"/>
  </svg>
);

const OKXIcon = () => (
  <svg className="h-7 w-7 rounded" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#1A1A1A"/>
    <path d="M5 5H9V9H5V5ZM15 5H19V9H15V5ZM5 15H9V19H5V15ZM15 15H19V19H15V15ZM10 10H14V14H10V10Z" fill="white"/>
  </svg>
);

const RabbyIcon = () => (
  <svg className="h-7 w-7 rounded" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#707CFF"/>
    <path d="M12 5C8 5 5.5 8 5.5 12C5.5 16 8 19 12 19C16 19 18.5 16 18.5 12C18.5 8 16 5 12 5ZM10 13.5C9.17157 13.5 8.5 12.8284 8.5 12C8.5 11.1716 9.17157 10.5 10 10.5C10.8284 10.5 11.5 11.1716 11.5 12C11.5 12.8284 10.8284 13.5 10 13.5ZM14 13.5C13.1716 13.5 12.5 12.8284 12.5 12C12.5 11.1716 13.1716 10.5 14 10.5C14.8284 10.5 15.5 11.1716 15.5 12C15.5 12.8284 14.8284 13.5 14 13.5Z" fill="white"/>
  </svg>
);

const SubWalletIcon = () => (
  <svg className="h-7 w-7 rounded" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#00A2FF"/>
    <path d="M6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12ZM10.5 9.5V11H13.5V12H10.5V13.5H13.5V14.5H9.5V8.5H13.5V9.5H10.5Z" fill="white"/>
  </svg>
);

const CoinbaseIcon = () => (
  <svg className="h-7 w-7 rounded" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#0052FF"/>
    <rect x="7" y="7" width="10" height="10" rx="2" fill="white"/>
  </svg>
);

interface RecommendedWallet {
  name: string;
  rdns: string;
  icon: React.ReactNode;
  downloadUrl: string;
}

const RECOMMENDED_LIST: RecommendedWallet[] = [
  {
    name: "SubWallet",
    rdns: "app.subwallet",
    icon: <SubWalletIcon />,
    downloadUrl: "https://www.subwallet.app/",
  },
  {
    name: "Phantom",
    rdns: "app.phantom",
    icon: <PhantomIcon />,
    downloadUrl: "https://phantom.app/download",
  },
  {
    name: "MetaMask",
    rdns: "io.metamask",
    icon: <MetaMaskIcon />,
    downloadUrl: "https://metamask.io/download/",
  },
  {
    name: "OKX Wallet",
    rdns: "com.okex.wallet",
    icon: <OKXIcon />,
    downloadUrl: "https://www.okx.com/web3",
  },
  {
    name: "Rabby Wallet",
    rdns: "io.rabby",
    icon: <RabbyIcon />,
    downloadUrl: "https://rabby.io/",
  },
];

const MORE_LIST: RecommendedWallet[] = [
  {
    name: "Coinbase Wallet",
    rdns: "com.coinbase.wallet",
    icon: <CoinbaseIcon />,
    downloadUrl: "https://www.coinbase.com/wallet/download",
  },
];

interface WalletConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (providerDetail?: EIP6963ProviderDetail) => Promise<void>;
  activeRdns: string | null;
}

export function WalletConnectModal({
  open,
  onOpenChange,
  onConnect,
  activeRdns,
}: WalletConnectModalProps) {
  const installedProviders = useEIP6963();

  // Helper to check device type
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Formulates deep links for mobile execution
  const getMobileDeepLink = (rdns: string): string => {
    if (typeof window === "undefined") return "#";
    const currentUrl = window.location.href;
    const cleanUrl = currentUrl.replace(/^https?:\/\//, "");
    const encodedUrl = encodeURIComponent(currentUrl);

    switch (rdns) {
      case "io.metamask":
        return `metamask://dapp/${cleanUrl}`;
      case "app.phantom":
        return `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodeURIComponent(window.location.origin)}`;
      case "com.okex.wallet":
        return `okx://wallet/dapp/details?dappUrl=${encodedUrl}`;
      case "com.coinbase.wallet":
        return `https://go.cb-w.com/dapp?cb_url=${encodedUrl}`;
      default:
        // Default deep link fallback
        return `metamask://dapp/${cleanUrl}`;
    }
  };

  const handleWalletSelect = async (detail: EIP6963ProviderDetail) => {
    onOpenChange(false);
    await onConnect(detail);
  };

  const handleRecommendedSelect = (wallet: RecommendedWallet) => {
    onOpenChange(false);
    if (isMobile) {
      window.location.href = getMobileDeepLink(wallet.rdns);
    } else {
      window.open(wallet.downloadUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Filter recommended wallets to exclude those that are already installed
  const filteredRecommended = RECOMMENDED_LIST.filter(
    (rec) => !installedProviders.some((inst) => inst.info.rdns === rec.rdns)
  );

  const filteredMore = MORE_LIST.filter(
    (rec) => !installedProviders.some((inst) => inst.info.rdns === rec.rdns)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] bg-[#121214]/95 border border-white/10 rounded-2xl p-0 overflow-hidden font-sans text-white z-[200] shadow-[0_24px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <DialogHeader className="pt-6 px-6">
          <DialogTitle className="text-center text-lg font-bold tracking-tight text-white/90">
            Connect a Wallet
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-5 max-h-[500px] overflow-y-auto hide-scrollbar">
          {/* --- INSTALLED SECTION --- */}
          {installedProviders.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-primary tracking-widest uppercase px-1">
                Installed
              </span>
              <div className="space-y-1">
                {installedProviders.map((detail) => {
                  const isCurrent = activeRdns === detail.info.rdns;
                  return (
                    <button
                      key={detail.info.uuid}
                      onClick={() => handleWalletSelect(detail)}
                      className="w-full flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 p-3.5 rounded-xl transition-all duration-200 text-left outline-none group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={detail.info.icon}
                          alt={detail.info.name}
                          className="h-7 w-7 rounded object-contain"
                        />
                        <div>
                          <span className="font-semibold text-white/90 group-hover:text-white transition-colors text-sm">
                            {detail.info.name}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] text-primary block font-semibold mt-0.5 tracking-wider uppercase">
                              Connected
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-white/40 group-hover:text-primary transition-colors group-hover:translate-x-0.5 group-hover:-translate-y-0.5 duration-200" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* --- RECOMMENDED SECTION --- */}
          {filteredRecommended.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-white/40 tracking-widest uppercase px-1">
                Recommended
              </span>
              <div className="space-y-1">
                {filteredRecommended.map((wallet) => (
                  <button
                    key={wallet.rdns}
                    onClick={() => handleRecommendedSelect(wallet)}
                    className="w-full flex items-center justify-between bg-white/[0.01] hover:bg-white/[0.05] border border-white/[0.03] hover:border-white/10 p-3.5 rounded-xl transition-all duration-200 text-left outline-none group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 flex items-center justify-center shrink-0">
                        {wallet.icon}
                      </div>
                      <div>
                        <span className="font-semibold text-white/80 group-hover:text-white transition-colors text-sm">
                          {wallet.name}
                        </span>
                        <span className="text-[9px] text-white/40 block mt-0.5">
                          {isMobile ? "Open in Wallet Browser" : "Get extension"}
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-white/20 group-hover:text-white transition-colors group-hover:translate-x-0.5 group-hover:-translate-y-0.5 duration-200" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* --- MORE WALLETS SECTION --- */}
          {filteredMore.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-white/40 tracking-widest uppercase px-1">
                More Wallets
              </span>
              <div className="space-y-1">
                {filteredMore.map((wallet) => (
                  <button
                    key={wallet.rdns}
                    onClick={() => handleRecommendedSelect(wallet)}
                    className="w-full flex items-center justify-between bg-white/[0.01] hover:bg-white/[0.05] border border-white/[0.03] hover:border-white/10 p-3.5 rounded-xl transition-all duration-200 text-left outline-none group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 flex items-center justify-center shrink-0">
                        {wallet.icon}
                      </div>
                      <div>
                        <span className="font-semibold text-white/80 group-hover:text-white transition-colors text-sm">
                          {wallet.name}
                        </span>
                        <span className="text-[9px] text-white/40 block mt-0.5">
                          {isMobile ? "Open in Wallet Browser" : "Get extension"}
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-white/20 group-hover:text-white transition-colors group-hover:translate-x-0.5 group-hover:-translate-y-0.5 duration-200" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* --- FOOTER --- */}
        <div className="bg-white/[0.02] border-t border-white/5 py-4 px-6 text-center text-xs text-white/50">
          New to Ethereum wallets?{" "}
          <a
            href="https://ethereum.org/en/wallets/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-semibold"
          >
            Learn More
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
