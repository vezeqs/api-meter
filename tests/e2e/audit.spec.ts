import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Routes carry the deployment subpath explicitly. Playwright resolves a
 * leading slash against the origin, so baking the base path into the route is
 * the only way the same suite can target both the local export and the live
 * GitHub Pages URL.
 */
const ROUTES = ["/api-meter/", "/api-meter/dashboard/", "/api-meter/dashboard/keys/"] as const;
const WIDTHS = [1440, 768, 390, 320] as const;

test.describe("console health", () => {
  for (const route of ROUTES) {
    test(`no console errors or page exceptions on ${route}`, async ({ page }) => {
      const problems: string[] = [];

      page.on("console", (message) => {
        if (message.type() === "error") problems.push(`console: ${message.text()}`);
      });
      page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

      await page.goto(route);
      await page.waitForLoadState("networkidle");

      expect(problems).toEqual([]);
    });
  }
});

test.describe("layout stability", () => {
  for (const route of ROUTES) {
    test(`no horizontal page overflow on ${route}`, async ({ page }) => {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await page.waitForLoadState("networkidle");

        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          const scroller = document.scrollingElement;
          const before = scroller?.scrollLeft ?? 0;

          if (scroller) scroller.scrollLeft = 99_999;
          const reachable = scroller?.scrollLeft ?? 0;
          if (scroller) scroller.scrollLeft = before;

          return {
            width: root.scrollWidth - root.clientWidth,
            reachable,
          };
        });

        expect(overflow.width, `${route} overflows at ${width}px`).toBeLessThanOrEqual(1);
        expect(overflow.reachable, `${route} can scroll sideways at ${width}px`).toBe(0);
      }
    });
  }
});

test.describe("document structure", () => {
  for (const route of ROUTES) {
    test(`one h1 and a skip link on ${route}`, async ({ page }) => {
      await page.goto(route);

      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByRole("link", { name: "Skip to content" })).toHaveCount(1);
    });

    test(`every interactive element has an accessible name on ${route}`, async ({ page }) => {
      await page.goto(route);

      const result = await page.evaluate(() => {
        const selector = "button, a[href], input, select, textarea";
        const elements = Array.from(document.querySelectorAll(selector));

        const nameOf = (element: Element): string => {
          const label = element.getAttribute("aria-label");
          if (label && label.trim()) return label.trim();

          const labelledBy = element.getAttribute("aria-labelledby");
          if (labelledBy) {
            const text = labelledBy
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent ?? "")
              .join(" ")
              .trim();
            if (text) return text;
          }

          const id = element.getAttribute("id");
          if (id) {
            const explicit = document.querySelector(`label[for="${CSS.escape(id)}"]`);
            if (explicit?.textContent?.trim()) return explicit.textContent.trim();
          }

          const own = (element.textContent ?? "").trim();
          if (own) return own;

          return (element.getAttribute("title") ?? "").trim();
        };

        return {
          total: elements.length,
          unnamed: elements
            .filter((element) => nameOf(element).length === 0)
            .map((element) => element.outerHTML.slice(0, 80)),
        };
      });

      // A page with no controls would otherwise pass this vacuously.
      expect(result.total, `${route} has nothing interactive to check`).toBeGreaterThan(0);
      expect(result.unnamed).toEqual([]);
    });

    test(`links point through the deployment base path on ${route}`, async ({ page }) => {
      await page.goto(route);

      const internal = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href^='/']")).map(
          (anchor) => anchor.getAttribute("href") ?? "",
        ),
      );

      for (const href of internal) {
        expect(href, `${href} is missing the base path`).toMatch(/^\/api-meter(\/|$)/);
      }
    });
  }
});

test.describe("search engine handling", () => {
  test("landing page is indexable and canonical", async ({ page }) => {
    await page.goto("/api-meter/");

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://vezeqs.github.io/api-meter/",
    );
  });

  test("dashboard is excluded from the index", async ({ page }) => {
    await page.goto("/api-meter/dashboard/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("structured data parses as JSON", async ({ page }) => {
    await page.goto("/api-meter/");

    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed["@type"]).toBe("SoftwareApplication");
    expect(parsed.name).toBe("Meter");
  });

  test("sitemap is served and absolute", async ({ request }) => {
    const response = await request.get("/api-meter/sitemap.xml");
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("<loc>https://vezeqs.github.io/api-meter/</loc>");
  });

  test("robots.txt blocks the dashboard under the base path", async ({ request }) => {
    const response = await request.get("/api-meter/robots.txt");
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("Disallow: /api-meter/dashboard");
    expect(body).toContain("Sitemap: https://vezeqs.github.io/api-meter/sitemap.xml");
  });
});

test.describe("accessibility", () => {
  for (const route of ROUTES) {
    test(`no axe violations on ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const summary = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target.join(" ")),
      }));

      expect(summary).toEqual([]);
    });

    test(`no axe violations in dark mode on ${route}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const summary = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target.join(" ")),
      }));

      expect(summary).toEqual([]);
    });
  }
});

test.describe("routing", () => {
  test("unknown paths return the exported 404 page", async ({ page }) => {
    const response = await page.goto("/api-meter/does-not-exist");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("nothing at this address");
  });

  test("the landing page leads to the dashboard", async ({ page }) => {
    await page.goto("/api-meter/");
    await page.getByRole("link", { name: "Open the dashboard" }).click();

    await expect(page).toHaveURL(/\/api-meter\/dashboard\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
  });
});
