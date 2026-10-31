import type { Quota } from "@production/shared";

const COMPACT_UNITS = [
  { limit: 1e9, suffix: "B" },
  { limit: 1e6, suffix: "M" },
  { limit: 1e3, suffix: "K" },
] as const;

/** 1842904 -> "1.84M". Keeps three significant digits so columns stay narrow. */
export function formatCompact(value: number): string {
  const absolute = Math.abs(value);

  for (const { limit, suffix } of COMPACT_UNITS) {
    if (absolute >= limit) {
      const scaled = value / limit;
      const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
      return `${scaled.toFixed(digits)}${suffix}`;
    }
  }

  return String(Math.round(value));
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatUsd(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** 0.184 -> "+18.4%". Ratio, not a percentage. */
export function formatDelta(ratio: number): string {
  const percent = ratio * 100;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(1)}%`;
}

export function formatRate(rate: number): string {
  const percent = rate * 100;
  return `${percent.toFixed(percent >= 1 ? 1 : 2)}%`;
}

export function formatBytes(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let scaled = value;
  let unitIndex = 0;

  while (scaled >= 1000 && unitIndex < units.length - 1) {
    scaled /= 1000;
    unitIndex += 1;
  }

  return `${scaled.toFixed(scaled >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "2026-10-30" -> "30 Oct". */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  const monthIndex = Number(month) - 1;
  return `${Number(day)} ${MONTHS[monthIndex] ?? ""}`.trim();
}

/** "2026-10-30" -> "30 Oct 2026". */
export function formatDate(isoDate: string): string {
  const [year] = isoDate.split("-");
  return `${formatDayMonth(isoDate)} ${year}`;
}

/** 84 -> "84 ms", 1210 -> "1.21 s". */
export function formatDuration(milliseconds: number): string {
  if (milliseconds >= 1000) {
    return `${(milliseconds / 1000).toFixed(2)} s`;
  }
  return `${Math.round(milliseconds)} ms`;
}

/** Picks the right unit for a quota's used and limit figures. */
export function formatQuotaLabels(quota: Quota): { used: string; limit: string } {
  switch (quota.unit) {
    case "storage":
      return { used: formatBytes(quota.used), limit: formatBytes(quota.limit) };
    case "seats":
      return { used: formatInteger(quota.used), limit: formatInteger(quota.limit) };
    default:
      return { used: formatCompact(quota.used), limit: formatCompact(quota.limit) };
  }
}
