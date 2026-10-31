import { expect, test } from "@playwright/test";
import { BASE_PATH } from "../../apps/web/lib/site-config.mjs";

const DASHBOARD = `${BASE_PATH}/dashboard/`;
const KEYS = `${BASE_PATH}/dashboard/keys/`;

async function readNumericColumn(
  page: import("@playwright/test").Page,
  rowSelector: string,
  cellIndex: number,
): Promise<number[]> {
  const rows = page.locator(rowSelector);
  const count = await rows.count();
  const values: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const text = await rows.nth(index).locator("td").nth(cellIndex).innerText();
    values.push(Number(text.replace(/[^0-9]/g, "")));
  }

  return values;
}

function isMonotonic(values: number[], direction: "asc" | "desc"): boolean {
  return values.every((value, index) => {
    if (index === 0) return true;
    const previous = values[index - 1] ?? value;
    return direction === "asc" ? previous <= value : previous >= value;
  });
}

function parseCompact(text: string): number {
  const match = /([\d.]+)\s*([KMB])?/.exec(text.replace(/,/g, ""));
  if (!match) return Number.NaN;

  const value = Number(match[1]);
  const suffix = match[2];

  if (suffix === "K") return value * 1e3;
  if (suffix === "M") return value * 1e6;
  if (suffix === "B") return value * 1e9;
  return value;
}

test.describe("overview", () => {
  test("endpoint totals reconcile with the headline figure", async ({ page }) => {
    await page.goto(DASHBOARD);

    for (const range of ["7 days", "30 days", "90 days"]) {
      await page.getByRole("button", { name: range }).click();

      const headline = parseCompact(
        await page.locator('[data-stat="Requests"] [data-value]').innerText(),
      );

      const rows = page.locator('section[aria-labelledby="endpoints-heading"] tbody tr');
      const count = await rows.count();
      let tableTotal = 0;

      for (let index = 0; index < count; index += 1) {
        const text = await rows.nth(index).locator("td").nth(0).innerText();
        tableTotal += Number(text.replace(/[^0-9]/g, ""));
      }

      expect(headline).toBeGreaterThan(0);
      expect(
        Math.abs(tableTotal - headline) / headline,
        `${range}: endpoints sum to ${tableTotal} but the headline says ${headline}`,
      ).toBeLessThan(0.02);
    }
  });

  test("the reporting period changes every figure", async ({ page }) => {
    await page.goto(DASHBOARD);

    const requests = page.locator('[data-stat="Requests"] [data-value]');
    const thirtyDays = await requests.innerText();

    await page.getByRole("button", { name: "7 days" }).click();
    const sevenDays = await requests.innerText();

    await page.getByRole("button", { name: "90 days" }).click();
    const ninetyDays = await requests.innerText();

    expect(sevenDays).not.toBe(thirtyDays);
    expect(ninetyDays).not.toBe(thirtyDays);
    expect(sevenDays).not.toBe(ninetyDays);

    await expect(page.getByRole("button", { name: "90 days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("the chart exposes values to the keyboard", async ({ page }) => {
    await page.goto(DASHBOARD);

    const plot = page.getByRole("group", { name: /Daily request volume/ });
    const announcement = page.locator('p[aria-live="polite"]');

    await plot.focus();
    await page.keyboard.press("End");

    await expect(announcement).toContainText("requests");

    const endText = await announcement.innerText();
    await page.keyboard.press("Home");
    await expect(announcement).not.toHaveText(endText);
  });

  test("hovering the chart shows a tooltip", async ({ page }) => {
    await page.goto(DASHBOARD);

    const plot = page.getByRole("group", { name: /Daily request volume/ });
    const box = await plot.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(
      (box?.x ?? 0) + (box?.width ?? 0) * 0.5,
      (box?.y ?? 0) + (box?.height ?? 0) * 0.5,
    );

    const announcement = page.locator('p[aria-live="polite"]');
    await expect(announcement).toContainText("requests");
  });

  test("the chart marker stays circular at any viewport", async ({ page }) => {
    // The plot's SVG stretches with preserveAspectRatio="none": a <circle> in
    // it rendered as a tall ellipse at every size. The marker must live in the
    // HTML overlay so it stays round.
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(DASHBOARD);

      const plot = page.getByRole("group", { name: /Daily request volume/ });
      const box = await plot.boundingBox();
      await page.mouse.move(
        (box?.x ?? 0) + (box?.width ?? 0) * 0.5,
        (box?.y ?? 0) + (box?.height ?? 0) * 0.5,
      );

      const marker = page.locator("[data-chart-marker]");
      await expect(marker).toBeVisible();

      const rect = await marker.boundingBox();
      expect(rect, `no marker box at ${width}px`).not.toBeNull();
      const skew = Math.abs((rect?.width ?? 0) - (rect?.height ?? 1)) / (rect?.height ?? 1);
      expect(skew, `marker is an ellipse at ${width}px`).toBeLessThanOrEqual(0.1);
    }
  });

  test("the endpoint table sorts in both directions", async ({ page }) => {
    await page.goto(DASHBOARD);

    const table = page.getByRole("region", { name: "Endpoints" });
    const requestsHeader = table.getByRole("button", { name: "Requests" });

    await requestsHeader.click();
    await expect(table.locator('th[aria-sort="ascending"]')).toHaveCount(1);

    const ascending = await readNumericColumn(
      page,
      'section[aria-labelledby="endpoints-heading"] tbody tr',
      0,
    );
    expect(isMonotonic(ascending, "asc")).toBe(true);

    await requestsHeader.click();
    await expect(table.locator('th[aria-sort="descending"]')).toHaveCount(1);

    const descending = await readNumericColumn(
      page,
      'section[aria-labelledby="endpoints-heading"] tbody tr',
      0,
    );
    expect(isMonotonic(descending, "desc")).toBe(true);
  });

  test("the endpoint filter narrows the table and reports emptiness", async ({ page }) => {
    await page.goto(DASHBOARD);

    const filter = page.getByLabel("Filter endpoints");
    const rows = page.locator('section[aria-labelledby="endpoints-heading"] tbody tr');

    await filter.fill("webhooks");
    await expect(rows).toHaveCount(1);

    await filter.fill("nothing-matches-this");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("No endpoints match");

    await filter.fill("");
    await expect(rows.first()).not.toContainText("No endpoints match");
  });
});

test.describe("api keys", () => {
  test("revealing a key shows the full secret and hides it again", async ({ page }) => {
    await page.goto(KEYS);

    const secret = page.locator("code").first();
    await expect(secret).toContainText("•");

    await page.getByRole("button", { name: "Reveal key for Production" }).click();
    await expect(secret).not.toContainText("•");
    await expect(secret).toContainText("mk_live_");

    await page.getByRole("button", { name: "Hide key for Production" }).click();
    await expect(secret).toContainText("•");
  });

  test("copying a key writes the secret to the clipboard", async ({ page }) => {
    await page.goto(KEYS);

    await page.getByRole("button", { name: "Copy key for Production" }).click();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toMatch(/^mk_live_[0-9a-f]+$/);
  });

  test("revoking requires a confirmation step", async ({ page }) => {
    await page.goto(KEYS);

    const row = page.getByRole("row").filter({ hasText: "Production" });

    await page.getByRole("button", { name: "Revoke key for Production" }).click();
    await expect(row.getByRole("button", { name: "Confirm" })).toBeVisible();

    await row.getByRole("button", { name: "Confirm" }).click();
    await expect(row.getByText("revoked")).toBeVisible();
  });

  test("creating a key adds it to the table in full", async ({ page }) => {
    await page.goto(KEYS);

    const before = await page.getByRole("row").count();

    await page.getByLabel("New key name").fill("Billing worker");
    await page.getByRole("button", { name: "Create key" }).click();

    await expect(page.getByRole("row")).toHaveCount(before + 1);

    const row = page.getByRole("row").filter({ hasText: "Billing worker" });
    await expect(row).toBeVisible();
    await expect(row.locator("code")).toContainText("mk_live_");
    await expect(row.locator("code")).not.toContainText("•");
  });

  test("the create button stays disabled until a name is entered", async ({ page }) => {
    await page.goto(KEYS);

    const submit = page.getByRole("button", { name: "Create key" });
    await expect(submit).toBeDisabled();

    await page.getByLabel("New key name").fill("x");
    await expect(submit).toBeEnabled();
  });
});

test.describe("billing invariants", () => {
  test("the quota panel is cycle-scoped and ignores the chart window", async ({ page }) => {
    await page.goto(DASHBOARD);

    const meter = page.getByRole("meter", { name: "Requests this cycle" });
    const before = await meter.getAttribute("aria-valuetext");
    expect(before).toBeTruthy();

    for (const range of ["7 days", "90 days"]) {
      await page.getByRole("button", { name: range }).click();
      expect(await meter.getAttribute("aria-valuetext"), `quota moved at ${range}`).toBe(before);
    }
  });

  test("the over-limit meter reports a valid ARIA range", async ({ page }) => {
    await page.goto(DASHBOARD);

    const meter = page.getByRole("meter", { name: "Requests this cycle" });
    const now = Number(await meter.getAttribute("aria-valuenow"));
    const max = Number(await meter.getAttribute("aria-valuemax"));

    expect(now).toBeLessThanOrEqual(max);
    await expect(meter).toHaveAttribute("aria-valuetext", /over limit/);
  });

  test("cycle spend bills overage only, not the included volume", async ({ page }) => {
    await page.goto(DASHBOARD);

    const requests = parseCompact(
      await page.locator('[data-stat="Requests"] [data-value]').innerText(),
    );
    const spend = Number(
      (await page.locator('[data-stat="Cycle spend"] [data-value]').innerText()).replace(
        /[^0-9.]/g,
        "",
      ),
    );

    const wholeVolumeAtOverageRate = (requests / 1e6) * 12;

    expect(spend).toBeGreaterThan(0);
    expect(spend).toBeLessThan(wholeVolumeAtOverageRate * 0.9);
  });

  test("a revoked key cannot be revealed or copied", async ({ page }) => {
    await page.goto(KEYS);

    const row = page.getByRole("row").filter({ hasText: "Legacy importer" });

    await expect(
      row.getByRole("button", { name: /Reveal key for Legacy importer/ }),
    ).toBeDisabled();
    await expect(row.getByRole("button", { name: /Copy key for Legacy importer/ })).toBeDisabled();
  });
});

test.describe("announcements", () => {
  test("each created key is announced with its own name", async ({ page }) => {
    await page.goto(KEYS);

    const announcement = page.locator('p[aria-live="polite"]');

    await page.getByLabel("New key name").fill("Billing worker");
    await page.getByRole("button", { name: "Create key" }).click();
    const first = await announcement.innerText();

    await page.getByLabel("New key name").fill("Reporting worker");
    await page.getByRole("button", { name: "Create key" }).click();
    const second = await announcement.innerText();

    expect(first).toContain("Billing worker");
    expect(second).toContain("Reporting worker");
    expect(second, "a second creation must change the live region").not.toBe(first);

    // A repeat name must still announce; the key's prefix keeps the text unique.
    await page.getByLabel("New key name").fill("Billing worker");
    await page.getByRole("button", { name: "Create key" }).click();
    const third = await announcement.innerText();

    expect(third).toContain("Billing worker");
    expect(third, "a same-named creation must still announce").not.toBe(first);
  });
});

test.describe("endpoint ordering", () => {
  test("sorting by endpoint fully orders duplicate paths", async ({ page }) => {
    await page.goto(DASHBOARD);

    const table = page.getByRole("region", { name: "Endpoints" });
    await table.getByRole("button", { name: "Endpoint" }).click();
    await expect(table.locator('th[aria-sort="ascending"]')).toHaveCount(1);

    const rows = page.locator('section[aria-labelledby="endpoints-heading"] tbody tr');
    const count = await rows.count();
    const pairs: Array<{ path: string; method: string }> = [];

    for (let index = 0; index < count; index += 1) {
      const cell = rows.nth(index).locator("th").first();
      const method = await cell.locator("span").first().innerText();
      const path = await cell.locator("span").nth(1).innerText();
      pairs.push({ path, method });
    }

    // Two endpoints share /v1/events. Without a tie-break their order would
    // depend on whatever order the rows happened to arrive in.
    const shared = pairs.filter((pair) => pair.path === "/v1/events");
    expect(shared.length).toBe(2);

    const ordered = [...pairs].sort(
      (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
    );
    expect(pairs).toEqual(ordered);
  });
});
