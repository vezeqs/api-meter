import type {
  ApiKey,
  DailyUsage,
  EndpointStat,
  HttpMethod,
  Quota,
  TimeRange,
  UsageSummary,
} from "@production/shared";
import { TIME_RANGE_DAYS } from "@production/shared";

/**
 * The demo is anchored to a fixed date so the build output, the server render,
 * and the client render always agree. A moving "today" would make every
 * prerendered page disagree with itself on hydration.
 */
export const REFERENCE_DATE = "2026-10-30";

const HISTORY_DAYS = 180;
const COST_PER_MILLION_USD = 12;

/** Small, fast, deterministic PRNG. Same seed, same dashboard, every time. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDaysBefore(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const base = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  const shifted = new Date(base - days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

interface SeriesOptions {
  base: number;
  growth: number;
  noise: number;
  weekendDip: boolean;
}

function buildSeries(rand: () => number, days: number, options: SeriesOptions): number[] {
  const { base, growth, noise, weekendDip } = options;
  const out: number[] = [];

  for (let index = 0; index < days; index += 1) {
    const progress = days === 1 ? 0 : index / (days - 1);
    const trend = 1 + growth * progress;
    const weekday = index % 7;
    const weekend = weekendDip && (weekday === 5 || weekday === 6) ? 0.71 : 1;
    const jitter = 1 + (rand() - 0.5) * noise;
    out.push(Math.max(0, Math.round(base * trend * weekend * jitter)));
  }

  return out;
}

const ENDPOINT_SEEDS: ReadonlyArray<{
  method: HttpMethod;
  path: string;
  share: number;
  errorRate: number;
  p95Ms: number;
  growth: number;
}> = [
  { method: "POST", path: "/v1/events", share: 0.34, errorRate: 0.0021, p95Ms: 84, growth: 0.62 },
  { method: "GET", path: "/v1/events", share: 0.21, errorRate: 0.0013, p95Ms: 41, growth: 0.28 },
  { method: "GET", path: "/v1/usage", share: 0.14, errorRate: 0.0004, p95Ms: 63, growth: 0.19 },
  { method: "GET", path: "/v1/customers", share: 0.11, errorRate: 0.0009, p95Ms: 52, growth: 0.11 },
  {
    method: "POST",
    path: "/v1/webhooks/test",
    share: 0.07,
    errorRate: 0.0182,
    p95Ms: 1210,
    growth: -0.14,
  },
  { method: "GET", path: "/v1/invoices", share: 0.06, errorRate: 0.0007, p95Ms: 96, growth: 0.07 },
  { method: "POST", path: "/v1/keys", share: 0.04, errorRate: 0.0031, p95Ms: 138, growth: 0.04 },
  {
    method: "DELETE",
    path: "/v1/keys/:id",
    share: 0.03,
    errorRate: 0.0044,
    p95Ms: 74,
    growth: -0.02,
  },
];

function buildHistory(): DailyUsage[] {
  const rand = mulberry32(0x5eed_1a7e);
  const days = Array.from({ length: HISTORY_DAYS }, (_, index) =>
    isoDaysBefore(REFERENCE_DATE, HISTORY_DAYS - 1 - index),
  );

  const requests = buildSeries(rand, HISTORY_DAYS, {
    base: 61_000,
    growth: 0.58,
    noise: 0.26,
    weekendDip: true,
  });

  const errorRate = buildSeries(rand, HISTORY_DAYS, {
    base: 1.35,
    growth: -0.32,
    noise: 0.5,
    weekendDip: false,
  });

  return days.map((date, index) => {
    const dailyRequests = requests[index] ?? 0;
    const rate = (errorRate[index] ?? 1) / 1000;
    return {
      date,
      requests: dailyRequests,
      errors: Math.round(dailyRequests * rate),
      costUsd: (dailyRequests / 1_000_000) * COST_PER_MILLION_USD,
    };
  });
}

const HISTORY = buildHistory();

function sliceRange(range: TimeRange): DailyUsage[] {
  const days = TIME_RANGE_DAYS[range];
  return HISTORY.slice(HISTORY.length - days);
}

function previousRange(range: TimeRange): DailyUsage[] {
  const days = TIME_RANGE_DAYS[range];
  return HISTORY.slice(HISTORY.length - days * 2, HISTORY.length - days);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function ratio(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 1;
  return (current - previous) / previous;
}

function buildEndpoints(daily: readonly DailyUsage[]): EndpointStat[] {
  const totalRequests = sum(daily.map((entry) => entry.requests));

  return ENDPOINT_SEEDS.map((seed, index) => {
    const rand = mulberry32(0xbeef_0000 + index * 7919);
    const target = Math.round(totalRequests * seed.share);

    const raw = buildSeries(rand, daily.length, {
      base: target / Math.max(1, daily.length),
      growth: seed.growth,
      noise: 0.24,
      weekendDip: true,
    });

    // Rescale so an endpoint's series sums to its share of the period total.
    // Without this the shape would drift from the number printed beside it.
    const rawTotal = sum(raw);
    const scale = rawTotal > 0 ? target / rawTotal : 0;
    const series = raw.map((value) => Math.max(0, Math.round(value * scale)));

    return {
      id: `${seed.method}-${seed.path}`,
      method: seed.method,
      path: seed.path,
      requests: sum(series),
      errorRate: seed.errorRate,
      p95Ms: seed.p95Ms,
      series,
    };
  }).sort((a, b) => b.requests - a.requests);
}

function buildQuotas(totalRequests: number): Quota[] {
  return [
    {
      id: "requests",
      label: "Requests this cycle",
      used: totalRequests,
      limit: 2_000_000,
      unit: "requests",
    },
    {
      id: "storage",
      label: "Event storage",
      used: 6_420_000_000,
      limit: 25_000_000_000,
      unit: "storage",
    },
    { id: "seats", label: "Seats", used: 3, limit: 5, unit: "seats" },
  ];
}

export function getUsageSummary(range: TimeRange): UsageSummary {
  const daily = sliceRange(range);
  const previous = previousRange(range);

  const requests = sum(daily.map((entry) => entry.requests));
  const errors = sum(daily.map((entry) => entry.errors));
  const costUsd = sum(daily.map((entry) => entry.costUsd));

  const previousRequests = sum(previous.map((entry) => entry.requests));
  const previousErrors = sum(previous.map((entry) => entry.errors));

  const errorRate = requests > 0 ? errors / requests : 0;
  const previousErrorRate = previousRequests > 0 ? previousErrors / previousRequests : 0;

  return {
    range,
    requests,
    errors,
    costUsd,
    daily,
    endpoints: buildEndpoints(daily),
    quotas: buildQuotas(requests),
    deltas: {
      requests: ratio(requests, previousRequests),
      errorRate: ratio(errorRate, previousErrorRate),
      costUsd: ratio(costUsd, sum(previous.map((entry) => entry.costUsd))),
    },
  };
}

export const API_KEYS: readonly ApiKey[] = [
  {
    id: "key_prod",
    name: "Production",
    prefix: "mk_live_9f2a",
    secret: "mk_live_9f2a4c1e8b7d3f6a0c5e2b9d4f7a1c8e",
    createdAt: "2025-11-14",
    lastUsedAt: "2026-10-30",
    scopes: ["events:write", "usage:read"],
    status: "active",
  },
  {
    id: "key_staging",
    name: "Staging",
    prefix: "mk_test_3d7c",
    secret: "mk_test_3d7c1b8a5e2f9c4d6a0b3e7f1c8d5a2b",
    createdAt: "2026-02-02",
    lastUsedAt: "2026-10-28",
    scopes: ["events:write", "usage:read", "keys:write"],
    status: "active",
  },
  {
    id: "key_ci",
    name: "CI pipeline",
    prefix: "mk_test_a1b4",
    secret: "mk_test_a1b49e3c6f2d8b5a0e7c4f1d9b6a3e8c",
    createdAt: "2026-04-19",
    lastUsedAt: "2026-09-02",
    scopes: ["usage:read"],
    status: "active",
  },
  {
    id: "key_legacy",
    name: "Legacy importer",
    prefix: "mk_live_0c6e",
    secret: "mk_live_0c6e7a2d5b8f1c4e9a3d6b0f7c2e5a1d",
    createdAt: "2024-08-07",
    lastUsedAt: null,
    scopes: ["events:write"],
    status: "revoked",
  },
];
