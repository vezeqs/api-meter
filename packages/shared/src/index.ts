export const APP_NAME = "Meter";

export const APP_TAGLINE = "Usage and billing for API products.";

export const HEALTH_PATH = "/health";

export type PlanId = "free" | "pro" | "team";

export interface Plan {
  id: PlanId;
  name: string;
  monthlyPriceUsd: number;
  seats: number;
  includedRequests: number;
  overagePerMillionUsd: number;
}

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPriceUsd: 0,
    seats: 1,
    includedRequests: 100_000,
    overagePerMillionUsd: 0,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPriceUsd: 49,
    seats: 1,
    includedRequests: 2_000_000,
    overagePerMillionUsd: 12,
  },
  {
    id: "team",
    name: "Team",
    monthlyPriceUsd: 199,
    seats: 5,
    includedRequests: 10_000_000,
    overagePerMillionUsd: 9,
  },
];

export function findPlan(id: PlanId): Plan | undefined {
  return PLANS.find((plan) => plan.id === id);
}

export type TimeRange = "7d" | "30d" | "90d";

export const TIME_RANGES: readonly TimeRange[] = ["7d", "30d", "90d"];

export const TIME_RANGE_DAYS: Record<TimeRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export interface DailyUsage {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  requests: number;
  errors: number;
  costUsd: number;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointStat {
  id: string;
  method: HttpMethod;
  path: string;
  requests: number;
  errorRate: number;
  p95Ms: number;
  /** Requests per day, oldest first. Length matches the selected range. */
  series: number[];
}

export type ApiKeyStatus = "active" | "revoked";

export interface ApiKey {
  id: string;
  name: string;
  /** Visible prefix, e.g. "mk_live_9f2a". */
  prefix: string;
  /** Full key material. Only ever shown once in a real system. */
  secret: string;
  createdAt: string;
  lastUsedAt: string | null;
  scopes: readonly string[];
  status: ApiKeyStatus;
}

export interface Quota {
  id: string;
  label: string;
  used: number;
  limit: number;
  unit: "requests" | "storage" | "seats";
}

export interface UsageSummary {
  range: TimeRange;
  requests: number;
  errors: number;
  costUsd: number;
  daily: DailyUsage[];
  endpoints: EndpointStat[];
  quotas: Quota[];
  /** Change against the previous period of equal length, as a ratio. */
  deltas: {
    requests: number;
    errorRate: number;
    costUsd: number;
  };
}

export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
}
