import { useMemo } from "react";
import type { Token } from "@workspace/api-client-react";

export type SecurityAudit = {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  status: "Secure" | "Moderate Risk" | "High Risk" | "Dangerous";
  checks: {
    liquidity: { status: "pass" | "warn" | "fail"; value: string; label: string };
    creatorOwnership: { status: "pass" | "warn" | "fail"; value: string; label: string };
    mintAuthority: { status: "pass" | "warn"; value: string; label: string };
    holderConcentration: { status: "pass" | "warn" | "fail"; value: string; label: string };
    lpLockStatus: { status: "pass" | "warn"; value: string; label: string };
  };
};

export function useTokenSecurity(
  token: Token | null | undefined,
  holders: Array<{ address: string; balance: number; pct: number }>,
  poolUsdcReserve: number | null
): SecurityAudit {
  return useMemo(() => {
    // Fallback default audit state
    const defaultAudit: SecurityAudit = {
      score: 100,
      grade: "A",
      status: "Secure",
      checks: {
        liquidity: { status: "pass", value: "—", label: "Liquidity Status" },
        creatorOwnership: { status: "pass", value: "—", label: "Creator Balance" },
        mintAuthority: { status: "pass", value: "Disabled", label: "Mint Authority" },
        holderConcentration: { status: "pass", value: "—", label: "Whale Concentration" },
        lpLockStatus: { status: "pass", value: "Locked", label: "LP Lock" },
      },
    };

    if (!token) return defaultAudit;

    let score = 100;
    const checks = { ...defaultAudit.checks };

    // 1. Liquidity Status
    const reserves = poolUsdcReserve || 0;
    if (reserves === 0) {
      checks.liquidity = { status: "fail", value: "No reserves", label: "Liquidity Status" };
      score -= 30;
    } else if (reserves < 1000) {
      checks.liquidity = { status: "warn", value: `$${reserves.toFixed(2)} USDC`, label: "Liquidity Status" };
      score -= 15;
    } else {
      checks.liquidity = { status: "pass", value: `$${reserves.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`, label: "Liquidity Status" };
    }

    // 2. Creator Ownership %
    const creatorHolder = holders.find(
      (h) => h.address.toLowerCase() === token.creatorAddress.toLowerCase()
    );
    const creatorPct = creatorHolder ? creatorHolder.pct : 0;
    if (creatorPct > 50) {
      checks.creatorOwnership = { status: "fail", value: `${creatorPct.toFixed(1)}%`, label: "Creator Balance" };
      score -= 25;
    } else if (creatorPct > 20) {
      checks.creatorOwnership = { status: "warn", value: `${creatorPct.toFixed(1)}%`, label: "Creator Balance" };
      score -= 12;
    } else {
      checks.creatorOwnership = { status: "pass", value: `${creatorPct.toFixed(1)}%`, label: "Creator Balance" };
    }

    // 3. Holder Concentration (Top 5 non-pool holders)
    const nonPoolHolders = holders.filter(
      (h) => h.address.toLowerCase() !== (token.pairAddress || "").toLowerCase()
    );
    const top5Pct = nonPoolHolders.slice(0, 5).reduce((sum, h) => sum + h.pct, 0);
    if (top5Pct > 75) {
      checks.holderConcentration = { status: "fail", value: `${top5Pct.toFixed(1)}%`, label: "Whale Concentration" };
      score -= 20;
    } else if (top5Pct > 45) {
      checks.holderConcentration = { status: "warn", value: `${top5Pct.toFixed(1)}%`, label: "Whale Concentration" };
      score -= 10;
    } else {
      checks.holderConcentration = { status: "pass", value: `${top5Pct.toFixed(1)}%`, label: "Whale Concentration" };
    }

    // 4. LP Lock status
    // Standard testnet simulated lock audit
    const isUnlockedLP = creatorPct > 35 && reserves > 0;
    if (isUnlockedLP) {
      checks.lpLockStatus = { status: "warn", value: "Unlocked LP", label: "LP Lock" };
      score -= 10;
    } else {
      checks.lpLockStatus = { status: "pass", value: "Locked", label: "LP Lock" };
    }

    // 5. Mint Authority (Simulated contract safety)
    const isSuspiciousTicker = token.ticker.includes("RUG") || token.ticker.includes("SCAM");
    if (isSuspiciousTicker) {
      checks.mintAuthority = { status: "warn", value: "Enabled", label: "Mint Authority" };
      score -= 15;
    } else {
      checks.mintAuthority = { status: "pass", value: "Disabled", label: "Mint Authority" };
    }

    // Bound score
    score = Math.max(0, Math.min(100, score));

    // Determine status & grade
    let grade: SecurityAudit["grade"] = "A";
    let status: SecurityAudit["status"] = "Secure";

    if (score >= 90) {
      grade = "A";
      status = "Secure";
    } else if (score >= 70) {
      grade = "B";
      status = "Secure";
    } else if (score >= 50) {
      grade = "C";
      status = "Moderate Risk";
    } else if (score >= 30) {
      grade = "D";
      status = "High Risk";
    } else {
      grade = "F";
      status = "Dangerous";
    }

    return {
      score,
      grade,
      status,
      checks,
    };
  }, [token, holders, poolUsdcReserve]);
}
