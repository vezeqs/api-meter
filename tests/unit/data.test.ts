import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findPlan, TIME_RANGES } from "@production/shared";
import { getBillingCycle, getUsageSummary } from "../../apps/web/lib/data.ts";

const plan = findPlan("pro");
assert.ok(plan, "the pro plan must exist");

describe("billing cycle", () => {
  it("is a fixed thirty-day window", () => {
    const cycle = getBillingCycle();
    assert.equal(cycle.days, 30);
    assert.equal(cycle.startDate, "2026-10-01");
    assert.equal(cycle.endDate, "2026-10-30");
  });

  it("is independent of the analysis range", () => {
    // The defect this guards: the quota used to be fed the range total, so the
    // same account read 30% at 7 days and 358% at 90 days.
    const first = getBillingCycle();
    for (const range of TIME_RANGES) {
      getUsageSummary(range);
      const again = getBillingCycle();
      assert.deepEqual(again, first, `cycle changed after reading ${range}`);
    }
  });

  it("takes the requests allowance from the plan, not a literal", () => {
    const cycle = getBillingCycle();
    const requests = cycle.quotas.find((quota) => quota.id === "requests");

    assert.ok(requests);
    assert.equal(requests.limit, plan.includedRequests);
    assert.equal(requests.used, cycle.requests);
  });
});

describe("spend", () => {
  it("charges overage only, never the included volume", () => {
    const cycle = getBillingCycle();
    const expectedOverage = Math.max(0, cycle.requests - plan.includedRequests);
    const expectedUsd = (expectedOverage / 1_000_000) * plan.overagePerMillionUsd;

    assert.equal(cycle.overageRequests, expectedOverage);
    assert.equal(cycle.overageUsd, expectedUsd);
  });

  it("never exceeds what the whole volume would cost", () => {
    const cycle = getBillingCycle();
    const naive = (cycle.requests / 1_000_000) * plan.overagePerMillionUsd;

    assert.ok(cycle.overageUsd <= naive);
  });
});

describe("analysis summary", () => {
  it("carries no billing fields", () => {
    const summary = getUsageSummary("30d");

    assert.equal("quotas" in summary, false);
    assert.equal("costUsd" in summary, false);
    assert.equal("costUsd" in summary.deltas, false);
  });

  it("reconciles endpoints with the headline figure at every range", () => {
    for (const range of TIME_RANGES) {
      const summary = getUsageSummary(range);
      const endpointTotal = summary.endpoints.reduce((total, entry) => total + entry.requests, 0);
      const drift = Math.abs(endpointTotal - summary.requests) / summary.requests;

      assert.ok(summary.requests > 0, `${range} produced no requests`);
      assert.ok(drift < 0.02, `${range} drifts ${(drift * 100).toFixed(2)}% from the total`);
    }
  });

  it("returns the requested number of days", () => {
    assert.equal(getUsageSummary("7d").daily.length, 7);
    assert.equal(getUsageSummary("30d").daily.length, 30);
    assert.equal(getUsageSummary("90d").daily.length, 90);
  });
});
