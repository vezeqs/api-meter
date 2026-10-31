import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBillingCycle } from "../../apps/web/lib/data.ts";
import { formatQuotaLabels } from "../../apps/web/lib/format.ts";
import { METERS } from "../../tools/og.mjs";

/**
 * The social card once carried a "Seats 3 of 5" meter — a figure F7 removed
 * from the product because it contradicted the plan record — and a 92%
 * requests meter while the real account is over limit. These assertions pin
 * every row on the card to the billing cycle it advertises.
 */
describe("the Open Graph card", () => {
  const quotas = getBillingCycle().quotas;

  it("shows the same meters as the billing cycle", () => {
    assert.equal(
      METERS.length,
      quotas.length,
      "the card and the cycle show a different number of meters",
    );
    assert.deepEqual(
      METERS.map((meter) => meter.label),
      quotas.map((quota) => quota.label),
    );
  });

  for (const meter of METERS) {
    it(`${meter.label} mirrors the quota`, () => {
      const quota = quotas.find((entry) => entry.label === meter.label);
      assert.ok(quota, `the billing cycle has no "${meter.label}" quota`);

      const labels = formatQuotaLabels(quota);
      assert.equal(meter.value, labels.used, "used figure drifted from the quota");
      assert.equal(meter.limit, labels.limit, "limit figure drifted from the quota");
      assert.equal(
        meter.percent,
        Math.round((quota.used / quota.limit) * 100),
        "percent drifted from the quota",
      );
    });
  }
});
