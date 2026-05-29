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

export function formatPrice(price: number | string): string {
  const num = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(num) || num === 0) return "0.00";
  if (num >= 1) {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  if (num >= 0.0001) {
    return num.toFixed(6);
  }
  const str = num.toFixed(12);
  const match = str.match(/^0\.(0+)/);
  if (match) {
    const zeroCount = match[1].length;
    const precision = Math.min(zeroCount + 4, 12);
    return num.toFixed(precision);
  }
  return num.toFixed(10);
}
