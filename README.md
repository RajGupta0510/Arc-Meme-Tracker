# ArcMeme Tracker & Market OS

ArcMeme Market OS is a next-generation decentralized liquidity aggregator, meme coin launchpad, and automated copytrading terminal built on top of the high-speed **Arc Network Testnet**. It combines instant token launching via custom Automated Market Makers (AMM) with advanced trading widgets and automated, non-custodial copytrading systems leveraging Account Abstraction.

---

## 🚀 Key Features

* **EIP-6963 Multi-Wallet Integration:** Dynamic discovery and connection for all installed browser wallet extensions (MetaMask, Phantom, SubWallet, OKX Wallet, Rabby Wallet, etc.) using the EIP-6963 standard. Features a custom dark glassmorphic selection dialog, mobile deep-linking redirections, and one-click automatic network switching/adding for the Arc Network Testnet.
* **Instant Token Launchpad:** Easily initialize custom ERC-20 meme tokens with custom symbols, total supply, and logo colors. Upon launch, a dedicated Constant Product AMM pool is automatically deployed.
* **Dynamic AMM Pools:** All meme tokens trade against liquid, custom Constant Product ($x \times y = k$) pairs using Wrapped USDC (WUSDC) as the base reserve asset.
* **Account Abstraction (AA) Smart Wallets:** Users can deploy deterministic smart contract wallets directly from the dashboard, secure funds inside their own contract, and manage WUSDC balances dedicated to copytrading.
* **Smart Money Arena Copytrading:** Replicate on-chain purchases made by high-performance wallets or whales. Replicate trade sizes automatically with precise allocation limits, customized slippage control, and emergency pause/disarm mechanisms.
* **Live Telemetry & Indexing:** A fast background indexer continuously feeds blockchain state to the interface, updating live candlestick charts (using lightweight-charts), trading widgets, transaction logs, and sentiment metrics.
* **Leaderboard & Academy:** Discover top-performing traders sorted by win rate and PnL, read comprehensive developer docs, and learn about the protocol mechanics.

---

## 📁 Repository Structure

This repository is managed as a **pnpm Monorepo** and is structured as follows:

```
├── artifacts/                  # Application Workspaces
│   ├── api-server/            # Express 5 Backend (REST APIs, swap indexing, seeding)
│   ├── arcmeme/               # React + Vite + Tailwind CSS Frontend (Trade Terminal)
│   └── mockup-sandbox/        # Local testing sandbox & mockup preview environment
├── lib/                        # Shared Packages & Configurations
│   ├── api-client-react/      # Generated React Query API hooks (via Orval)
│   ├── api-spec/              # OpenAPI 3.1.0 specification (openapi.yaml)
│   ├── api-zod/               # Zod schemas generated from OpenAPI spec
│   └── db/                    # Drizzle ORM schema, migrations, and PostgreSQL client
├── scripts/                    # Shared preinstall, TypeScript build, and utility scripts
├── package.json                # Root package configuration
├── pnpm-workspace.yaml         # PNPM workspaces config and shared dependency catalog
└── tsconfig.base.json          # Shared TypeScript base configuration
```

---

## 🛠️ Technology Stack

* **Package Manager:** `pnpm` workspaces
* **Runtime:** Node.js 24, TypeScript 5.9
* **Frontend:** React 19, Vite 7, Tailwind CSS 4, Framer Motion, TanStack React Query, Lucide icons, lightweight-charts (TradingView), wouter
* **Backend:** Express 5, Pino (structured logging), esbuild (bundling), tsx
* **Database:** PostgreSQL + Drizzle ORM
* **API Codegen:** Orval (compiling OpenAPI spec to TypeScript client hooks and Zod validators)

---

## ⚙️ Getting Started & Run Scripts

### 1. Prerequisites
Ensure you have the following installed:
* [Node.js](https://nodejs.org/) (v24 or higher recommended)
* [pnpm](https://pnpm.io/installation)
* A running **PostgreSQL** instance

### 2. Environment Variables
Create or set the following environment variables. In the backend environment (`artifacts/api-server`), a `.env` file or process environment variables must define:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/arcmeme"
PORT="5000"
```

### 3. Installation
Install all workspaces dependencies from the root directory:
```bash
pnpm install
```

### 4. Database Setup
Push the Drizzle schema to your PostgreSQL database (dev environment):
```bash
pnpm --filter @workspace/db run push
```

### 5. Code Generation
Regenerate frontend API hooks and Zod schemas whenever the OpenAPI spec (`lib/api-spec/openapi.yaml`) changes:
```bash
pnpm --filter @workspace/api-spec run codegen
```

### 6. Running the Applications
Start the API backend and Vite frontend concurrently or individually:

* **Start API Server:**
  ```bash
  pnpm --filter @workspace/api-server run dev
  ```
  *(Launches Express server on port 5000, runs self-healing, and schedules the 30-second swap indexer)*

* **Start Frontend App:**
  ```bash
  pnpm --filter @workspace/arcmeme run dev
  ```
  *(Launches Vite dev server on `http://localhost:5173`)*

* **Full Typecheck:**
  ```bash
  pnpm run typecheck
  ```

* **Production Build:**
  ```bash
  pnpm run build
  ```

---

## 🔒 Security & Supply Chain Safety
This project enforces a **minimum package release age** of 1 day (1440 minutes) in `pnpm-workspace.yaml` to defend against supply-chain attacks. Do not disable this setting. If you need to override it for a trusted dependency (e.g. from Microsoft, Meta, etc.), add it to the `minimumReleaseAgeExclude` list.
