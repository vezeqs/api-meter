import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatBytes,
  formatCompact,
  formatDayRange,
  formatDelta,
  formatRate,
} from "../../apps/web/lib/format.ts";

describe("formatCompact", () => {
  it("keeps three significant digits", () => {
    assert.equal(formatCompact(1_842_904), "1.84M");
    assert.equal(formatCompact(1_500), "1.50K");
    assert.equal(formatCompact(2_500_000), "2.50M");
  });

  it("promotes into the next unit instead of printing 1000K", () => {
    assert.equal(formatCompact(999_999), "1.00M");
    assert.equal(formatCompact(999_999_999), "1.00B");
    assert.equal(formatCompact(999_999_999_999), "1.00T");
  });

  it("leaves values under a thousand alone", () => {
    assert.equal(formatCompact(0), "0");
    assert.equal(formatCompact(999), "999");
  });

  it("keeps the sign", () => {
    assert.equal(formatCompact(-1_500), "-1.50K");
  });
});

describe("formatBytes", () => {
  it("uses decimal units", () => {
    assert.equal(formatBytes(500), "500 B");
    assert.equal(formatBytes(6_420_000_000), "6.4 GB");
    assert.equal(formatBytes(25_000_000_000), "25.0 GB");
  });
});

describe("formatRate", () => {
  it("shows two decimals under one percent and one above", () => {
    assert.equal(formatRate(0.0013), "0.13%");
    assert.equal(formatRate(0.0182), "1.8%");
  });
});

describe("formatDelta", () => {
  it("signs the change", () => {
    assert.equal(formatDelta(0.184), "+18.4%");
    assert.equal(formatDelta(-0.05), "-5.0%");
    assert.equal(formatDelta(0), "0.0%");
  });

  it("renders an undefined change as a dash", () => {
    // A change from zero has no percentage. The old fallback claimed +100%.
    assert.equal(formatDelta(Number.NaN), "—");
    assert.equal(formatDelta(Number.POSITIVE_INFINITY), "—");
  });
});

describe("formatDayRange", () => {
  it("renders both ends", () => {
    assert.equal(formatDayRange("2026-10-01", "2026-10-30"), "1 Oct – 30 Oct");
  });
});
