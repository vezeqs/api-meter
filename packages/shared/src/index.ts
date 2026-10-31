export const APP_NAME = "Production";

export const HEALTH_PATH = "/health";

export type PlanId = "free" | "pro" | "team";

export interface Plan {
  id: PlanId;
  name: string;
  monthlyPriceUsd: number;
  seats: number;
}

export const PLANS: readonly Plan[] = [
  { id: "free", name: "Free", monthlyPriceUsd: 0, seats: 1 },
  { id: "pro", name: "Pro", monthlyPriceUsd: 19, seats: 1 },
  { id: "team", name: "Team", monthlyPriceUsd: 49, seats: 5 },
];

export function findPlan(id: PlanId): Plan | undefined {
  return PLANS.find((plan) => plan.id === id);
}

export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
}
