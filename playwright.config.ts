import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 4321);
const BASE_PATH = "/api-meter";

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
