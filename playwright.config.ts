import { defineConfig } from "@playwright/test";
import { BASE_PATH as SITE_BASE_PATH } from "./apps/web/lib/site-config.mjs";

const PORT = Number(process.env.PORT ?? 4321);

// The mount must match what serve-export uses: the documented site base path,
// with BASE_PATH kept as the shared explicit override.
const BASE_PATH = process.env.BASE_PATH ?? SITE_BASE_PATH;

/**
 * The origin only. Routes in the suite carry the deployment subpath, so the
 * same tests run against the local export and against the live site when
 * PLAYWRIGHT_ORIGIN is set.
 */
const ORIGIN = process.env.PLAYWRIGHT_ORIGIN ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: process.env.PLAYWRIGHT_ORIGIN
    ? undefined
    : {
        command: "node tools/serve-export.mjs",
        url: `http://127.0.0.1:${PORT}${BASE_PATH}/`,
        reuseExistingServer: !process.env.CI,
        stdout: "ignore",
        stderr: "pipe",
        timeout: 30_000,
      },
});
