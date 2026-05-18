import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + "B";
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(1) + "K";
  return value.toFixed(2);
}

export function formatBalance(value: number | string): string {
  const number = typeof value === "number" ? value : Number(value.replace(/,/g, ""));
  if (!Number.isFinite(number)) return "0.000";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    useGrouping: false,
  }).format(number);
}

export function formatAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return address.slice(0, 8) + "..." + address.slice(-4);
}
