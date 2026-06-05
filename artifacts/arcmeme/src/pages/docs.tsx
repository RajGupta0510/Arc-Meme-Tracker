import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  HelpCircle, 
  PlusCircle, 
  Activity, 
  WalletCards, 
  TrendingUp, 
  Layers, 
  ArrowRight,
  Shield,
  Zap,
  Info
} from "lucide-react";

type DocSection = "overview" | "launching" | "trading_lp" | "copytrading";

export function DocsPage() {
  const [activeSection, setActiveSection] = useState<DocSection>("overview");

  const sections: { id: DocSection; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Protocol Overview", icon: <BookOpen className="h-4 w-4" /> },
    { id: "launching", label: "Token Launching", icon: <PlusCircle className="h-4 w-4" /> },
    { id: "trading_lp", label: "Trading & Liquidity", icon: <Activity className="h-4 w-4" /> },
    { id: "copytrading", label: "Arena Copytrading", icon: <WalletCards className="h-4 w-4" /> },
  ];

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 bg-background relative overflow-hidden font-mono text-xs">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 text-primary text-[10px] uppercase tracking-widest mb-1">
            <BookOpen className="h-4 w-4 animate-pulse" />
            ArcMeme Academy
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight font-sans bg-gradient-to-r from-white via-primary to-primary bg-clip-text text-transparent">
            DOCUMENTATION & TUTORIALS
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl mt-1 font-mono">
            Learn how the ArcMeme Terminal, AMM pools, Account Abstraction wallets, and copytrading infrastructure operate.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-card/40 border border-primary/20 backdrop-blur-md px-4 py-2.5 rounded-lg text-primary shadow-[0_0_20px_rgba(34,197,94,0.06)]">
          <HelpCircle className="h-4 w-4 text-primary" />
          <div>
            <div className="text-muted-foreground text-[8px] uppercase">READ TIME</div>
            <div className="font-bold">~6 MINS READ</div>
          </div>
        </div>
      </div>

      {/* Documentation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 relative z-10">
        {/* Navigation Sidebar */}
        <aside className="flex flex-col gap-1.5 lg:sticky lg:top-24">
          <div className="mb-2 text-[9px] uppercase tracking-widest text-muted-foreground font-bold pl-2">Documentation Stack</div>
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-3 rounded border px-3 py-2.5 text-left transition-all duration-300 relative ${
                activeSection === sec.id
                  ? "border-l-2 border-l-primary border-y-primary/20 border-r-primary/20 bg-primary/12 text-primary font-bold shadow-sm"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground"
              }`}
            >
              {sec.icon}
              <span className="font-semibold">{sec.label}</span>
            </button>
          ))}
        </aside>

        {/* Content Section */}
        <main className="min-w-0">
          <Card className="glass-panel border-border bg-card/45 backdrop-blur-md p-6 space-y-6">
            
            {activeSection === "overview" && (
              <div className="space-y-6 leading-relaxed">
                <div>
                  <h2 className="text-base font-extrabold uppercase text-primary border-b border-border/40 pb-2 mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    What is ArcMeme Market OS?
                  </h2>
                  <p className="text-muted-foreground">
                    ArcMeme Market OS is a next-generation decentralized liquidity aggregator and token launchpad built on top of the high-speed <strong className="text-foreground">Arc Network Testnet</strong>. It combines instant token launching via custom Automated Market Makers (AMM) with advanced trading widgets and automated, non-custodial copytrading systems leveraging Account Abstraction.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-border/40 rounded p-4 bg-black/25">
                    <h3 className="font-bold text-[var(--accent-neon)] mb-2 uppercase flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" />
                      Dynamic AMM Pools
                    </h3>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Instead of traditional order books, all meme tokens launched on ArcMeme trade against liquid, custom Constant Product (x * y = k) Automated Market Maker pairs backed by Wrapped USD Coin (WUSDC) as the base asset.
                    </p>
                  </div>

                  <div className="border border-border/40 rounded p-4 bg-black/25">
                    <h3 className="font-bold text-[var(--accent-neon)] mb-2 uppercase flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      Account Abstraction
                    </h3>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Users deploy deterministic smart contract wallets directly from the Portfolio OS dashboard. These contract wallets hold WUSDC balances and execute automated mirrored copytrades triggered by blockchain activity.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-foreground mb-2 uppercase">How the Protocol Coordinates</h3>
                  <div className="border border-border/40 rounded p-4 bg-card/20 font-mono text-[10px] space-y-2.5">
                    <div className="flex items-start gap-3">
                      <span className="text-primary font-bold">[1]</span>
                      <div>
                        <strong className="text-foreground">Token Creation:</strong> Creator initializes the token metadata (ticker, logo color, supply) and triggers the contract factory.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-primary font-bold">[2]</span>
                      <div>
                        <strong className="text-foreground">AMM Deployment:</strong> The factory deploys the ERC20 token, establishes a trading pair with WUSDC on the router, and supplies initial liquidity.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-primary font-bold">[3]</span>
                      <div>
                        <strong className="text-foreground">Live Telemetry Indexing:</strong> Node indexers relay pool reserves to the ArcMeme interface, syncing live candlestick charts, price flip widgets, and transaction logs.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "launching" && (
              <div className="space-y-6 leading-relaxed">
                <div>
                  <h2 className="text-base font-extrabold uppercase text-primary border-b border-border/40 pb-2 mb-3 flex items-center gap-2">
                    <PlusCircle className="h-4 w-4 text-primary" />
                    Launching Custom Meme Tokens
                  </h2>
                  <p className="text-muted-foreground">
                    ArcMeme features a fully decentralized token launch system. Creating a token launches its ERC20 contract and registers it into the active AMM pools, making it immediately tradeable by the community.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-foreground uppercase">Launch Step-by-Step Tutorial</h3>
                  
                  <div className="space-y-3">
                    <div className="flex gap-4 items-start border-l border-border/30 pl-4 py-1 relative">
                      <div className="absolute left-[-5px] top-2.5 h-2.5 w-2.5 rounded-full bg-primary" />
                      <div>
                        <div className="font-bold text-foreground uppercase text-[11px]">Step 1: Set Token Metadata</div>
                        <p className="text-muted-foreground text-[11px] mt-0.5">
                          Navigate to the <strong className="text-foreground">Launch</strong> tab. Enter your token symbol (e.g. $DOGE), name (e.g. Dogecoin), and select a representative logo color or color overlay.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start border-l border-border/30 pl-4 py-1 relative">
                      <div className="absolute left-[-5px] top-2.5 h-2.5 w-2.5 rounded-full bg-primary" />
                      <div>
                        <div className="font-bold text-foreground uppercase text-[11px]">Step 2: Configure Supply & Liquidity</div>
                        <p className="text-muted-foreground text-[11px] mt-0.5">
                          Choose the Total Supply of your token and set the initial liquidity sizing. A percentage of the supply is locked into the dynamic AMM pair.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start border-l border-border/30 pl-4 py-1 relative">
                      <div className="absolute left-[-5px] top-2.5 h-2.5 w-2.5 rounded-full bg-primary" />
                      <div>
                        <div className="font-bold text-foreground uppercase text-[11px]">Step 3: Fund & Deploy Pair</div>
                        <p className="text-muted-foreground text-[11px] mt-0.5">
                          Review the deployment gas costs. Click "Launch Token" and authorize the transaction inside your MetaMask extension. The launch factory executes bytecode setup on the Arc Network.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start border-l border-border/30 pl-4 py-1 relative">
                      <div className="absolute left-[-5px] top-2.5 h-2.5 w-2.5 rounded-full bg-primary" />
                      <div>
                        <div className="font-bold text-foreground uppercase text-[11px]">Step 4: Liquidity Lock & Pool Activation</div>
                        <p className="text-muted-foreground text-[11px] mt-0.5">
                          Once confirmed, the pair is initialized. The system locks the LP tokens in escrow, registers the pool contract address, and lists it immediately on the Market Discovery Terminal table.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded p-4 mt-2">
                  <div className="flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-primary uppercase text-[10px]">Security Note:</strong>
                      <p className="text-muted-foreground text-[10px] mt-0.5 leading-normal">
                        To prevent rugpulls, LP tokens are escrowed automatically by the contract router. Creators cannot drain the liquidity pools of WUSDC base assets, assuring safe trading conditions for buyers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "trading_lp" && (
              <div className="space-y-6 leading-relaxed">
                <div>
                  <h2 className="text-base font-extrabold uppercase text-primary border-b border-border/40 pb-2 mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Trading and Liquidity Provisioning
                  </h2>
                  <p className="text-muted-foreground">
                    ArcMeme enables seamless instant token swaps and custom LP contributions. Swap execution calculates asset reserves in real-time, enforcing slippage limits.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-border/40 rounded p-4 bg-black/25 space-y-2">
                    <h3 className="font-bold text-foreground uppercase flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" /> Swap Executions
                    </h3>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Select any token on the terminal to access its detail dashboard. Use the Buy/Sell swap pane to enter USDC parameters. Swaps execute through the Arc AMM Router using:
                      <code className="block mt-1 bg-black/40 p-1.5 rounded text-[10px] text-[var(--accent-neon)] select-all font-semibold">
                        dy = (y * dx) / (x + dx)
                      </code>
                    </p>
                  </div>

                  <div className="border border-border/40 rounded p-4 bg-black/25 space-y-2">
                    <h3 className="font-bold text-foreground uppercase flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-blue-400" /> LP Provisioning
                    </h3>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Supply liquidity to Earn LP rewards! Enter equal ratios of WUSDC and the target meme token in the Liquidity Tab. The router mints LP shares representing your ownership of the reserve pool, earning transaction fees.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-foreground mb-2 uppercase">Custom Slippage Controls</h3>
                  <p className="text-muted-foreground">
                    High volatility is normal for newly launched meme tokens. Adjust your slippage limits (e.g. 0.5%, 1.0%, 3.0%) in the swap settings drawer before clicking swap. If price impact during transaction execution exceeds the slippage percentage, the smart contract automatically rolls back the transaction to save your capital.
                  </p>
                </div>
              </div>
            )}

            {activeSection === "copytrading" && (
              <div className="space-y-6 leading-relaxed">
                <div>
                  <h2 className="text-base font-extrabold uppercase text-primary border-b border-border/40 pb-2 mb-3 flex items-center gap-2">
                    <WalletCards className="h-4 w-4 text-primary" />
                    Smart Money Arena Copytrading
                  </h2>
                  <p className="text-muted-foreground">
                    The Smart Money Copytrading Arena allows users to automatically replicate on-chain token purchases made by high-performance smart money addresses, whales, or elite traders.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-foreground uppercase">Setting Up Automated Copytrading</h3>
                  
                  <div className="border border-border/40 rounded p-4 bg-black/25 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <span className="bg-primary/20 text-primary border border-primary/30 h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                      <div>
                        <strong className="text-foreground uppercase text-[11px]">Deploy Smart Contract Account (AA)</strong>
                        <p className="text-muted-foreground text-[11px] mt-0.5">
                          Go to the <strong className="text-foreground">Portfolio</strong> dashboard. Click "Deploy Smart Wallet" and authorize the AA contract deployment in MetaMask. This creates your deterministic, gas-efficient trade executor contract.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="bg-primary/20 text-primary border border-primary/30 h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                      <div>
                        <strong className="text-foreground uppercase text-[11px]">Fund Smart Wallet with USDC</strong>
                        <p className="text-muted-foreground text-[11px] mt-0.5">
                          Deposit WUSDC from your MetaMask account directly into the Smart Wallet Console. These funds are locked securely inside your personal smart contract, designated exclusively for copytrade execution.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="bg-primary/20 text-primary border border-primary/30 h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                      <div>
                        <strong className="text-foreground uppercase text-[11px]">Bookmark and Track Target Address</strong>
                        <p className="text-muted-foreground text-[11px] mt-0.5">
                          Go to the <strong className="text-foreground">Leaderboard</strong> to view wallets sorted by win rate and PnL. Click "Track" on an address, or manually add a target wallet in the Portfolio registry. Configure your custom transaction size allocation limit (e.g. max $25 USDC per trade) and Slippage limit.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="bg-primary/20 text-primary border border-primary/30 h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0">4</span>
                      <div>
                        <strong className="text-foreground uppercase text-[11px]">Automatic Swap Mirroring</strong>
                        <p className="text-muted-foreground text-[11px] mt-0.5">
                          When your target wallet executes a buy/sell trade on Arc Testnet, the copytrade relayers register the event, trigger your AA contract wallet, and automatically mirror the execution based on your limits. All actions log directly into your console.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-border/40 rounded p-4 bg-card/20 space-y-1">
                    <h4 className="font-bold text-foreground text-[11px] uppercase">Risk Sizing</h4>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      You specify exactly how much USDC to allocate per target. Relayers will never deploy more than this specified threshold, keeping your funds safe.
                    </p>
                  </div>

                  <div className="border border-border/40 rounded p-4 bg-card/20 space-y-1">
                    <h4 className="font-bold text-foreground text-[11px] uppercase">Emergency Disarm</h4>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      You can instantly deactivate copytrade tracking for any wallet directly from the Portfolio console, stopping further transaction mirroring immediately.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </Card>
        </main>
      </div>
    </div>
  );
}
