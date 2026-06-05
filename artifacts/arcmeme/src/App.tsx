import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppSidebar } from "@/components/app-sidebar";
import { Navbar } from "@/components/navbar";
import { HomePage } from "@/pages/home";
import { TokenDetailPage } from "@/pages/token-detail";
import { LaunchPage } from "@/pages/launch";
import { PortfolioPage } from "@/pages/portfolio";
import { LeaderboardPage } from "@/pages/leaderboard";
import { WalletDetailPage } from "@/pages/wallet-detail";
import { DocsPage } from "@/pages/docs";
import { useEffect } from "react";
import { GlobalAiCopilot } from "@/components/global-ai-copilot";
import { ParticleBackground } from "@/components/particle-background";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/token/:id" component={TokenDetailPage} />
      <Route path="/launch" component={LaunchPage} />
      <Route path="/portfolio" component={PortfolioPage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route path="/wallet/:address" component={WalletDetailPage} />
      <Route path="/docs" component={DocsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // Force dark mode
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <div className="min-h-screen bg-background text-foreground flex font-sans selection:bg-primary/30 relative overflow-hidden">
            {/* Cyber Terminal Scanlines and Particles */}
            <div className="scanlines" />
            <ParticleBackground />

            {/* Ambient Background Gradient Shapes */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
              <div className="absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] min-w-[320px] rounded-full bg-primary/4 blur-[120px] animate-slow-pulse" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] min-w-[350px] rounded-full bg-chart-2/4 blur-[140px] animate-slow-pulse-reverse" />
              <div className="absolute top-[35%] left-[55%] -translate-x-1/2 -translate-y-1/2 w-[35vw] h-[35vw] min-w-[280px] rounded-full bg-chart-4/3 blur-[130px] opacity-60 animate-slow-pulse" />
            </div>

            <div className="relative z-10 flex flex-1 w-full min-h-screen">
              <AppSidebar />
              <div className="min-w-0 flex-1 flex flex-col lg:pl-64">
                <Navbar />
                <main className="flex-1 flex flex-col relative">
                  <Router />
                </main>
              </div>
            </div>
          </div>
          <GlobalAiCopilot />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
