import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/**
 * F6 removed a duplicated allowance literal; the same pattern survived in
 * marketing copy, structured data, a plan badge, and the API's version reply.
 * These scans fail if a hand-typed plan figure or version comes back. The
 * style matches the source scans in tools.test.ts.
 */
describe("plan figures are derived, not typed", () => {
  const landing = read("apps/web/app/page.tsx");
  const rootLayout = read("apps/web/app/layout.tsx");
  const rail = read("apps/web/app/dashboard/layout.tsx");
  const api = read("apps/api/src/index.ts");

  it("the landing prices the overage rate from the plan", () => {
    assert.match(landing, /overagePerMillionUsd/);
    assert.doesNotMatch(
      landing,
      /twelve dollars|\$\d+ per million/i,
      "the overage rate belongs to PLANS, not to copy",
    );
  });

  it("the structured-data offers come from the plan table", () => {
    assert.match(rootLayout, /PLANS\.map/);
    assert.doesNotMatch(
      rootLayout,
      /price: "\d/,
      "the schema.org offers must not type prices by hand",
    );
  });

  it("the plan badge is not a literal", () => {
    assert.doesNotMatch(rail, /[A-Z][a-z]+ · [\d.]+[KM]? req/, "the rail badge typed the plan");
    assert.match(rail, /findPlan/);
  });

  it("the health endpoint does not type its version", () => {
    assert.doesNotMatch(api, /version: "\d+\.\d+\.\d+"/);
    assert.match(api, /package\.json/, "version should come from package.json");
  });
});
