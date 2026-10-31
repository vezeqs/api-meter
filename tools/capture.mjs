#!/usr/bin/env node
/**
 * Captures the README assets from the real build:
 *   docs/landing.png, docs/dashboard.png, docs/keys.png,
 *   docs/dashboard-mobile.png, docs/demo.gif
 *
 * Screenshots come from the exported site served exactly as GitHub Pages will
 * serve it, so what the README shows is what the deployment looks like.
 */
import { spawn, execFileSync } from "node:child_process";
import { mkdir, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DOCS = join(ROOT, "docs");
const FRAMES = join(DOCS, ".frames");
const BASE = "http://127.0.0.1:4321/api-meter";

async function waitForServer(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function main() {
  await mkdir(DOCS, { recursive: true });
  await rm(FRAMES, { recursive: true, force: true });
  await mkdir(FRAMES, { recursive: true });

  let server = null;
  if (!(await waitForServer(`${BASE}/`))) {
    server = spawn(process.execPath, [join(ROOT, "tools/serve-export.mjs")], {
      cwd: ROOT,
      stdio: "ignore",
    });

    if (!(await waitForServer(`${BASE}/`))) {
      throw new Error("the static server did not start");
    }
  }

  const browser = await chromium.launch();

  try {
    // ---- still frames ----
    const desktop = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });

    await desktop.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await desktop.screenshot({ path: join(DOCS, "landing.png") });

    await desktop.goto(`${BASE}/dashboard/`, { waitUntil: "networkidle" });
    await desktop.screenshot({ path: join(DOCS, "dashboard.png") });

    await desktop.goto(`${BASE}/dashboard/keys/`, { waitUntil: "networkidle" });
    await desktop.screenshot({ path: join(DOCS, "keys.png") });
    await desktop.close();

    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    await mobile.goto(`${BASE}/dashboard/`, { waitUntil: "networkidle" });
    await mobile.screenshot({ path: join(DOCS, "dashboard-mobile.png") });
    await mobile.close();

    const dark = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
    });

    await dark.goto(`${BASE}/dashboard/`, { waitUntil: "networkidle" });
    await dark.screenshot({ path: join(DOCS, "dashboard-dark.png") });
    await dark.close();

    // ---- animated frames ----
    const stage = await browser.newPage({
      viewport: { width: 1180, height: 760 },
      deviceScaleFactor: 1,
    });

    await stage.goto(`${BASE}/dashboard/`, { waitUntil: "networkidle" });

    let frame = 0;
    const capture = async () => {
      frame += 1;
      await stage.screenshot({
        path: join(FRAMES, `frame-${String(frame).padStart(3, "0")}.png`),
      });
    };

    const plot = stage.getByRole("group", { name: /Daily request volume/ });
    const box = await plot.boundingBox();

    if (box) {
      const steps = 16;
      for (let step = 0; step <= steps; step += 1) {
        await stage.mouse.move(box.x + (box.width * step) / steps, box.y + box.height * 0.5, {
          steps: 2,
        });
        await capture();
      }
    }

    await stage.getByRole("button", { name: "90 days" }).click();
    await stage.waitForTimeout(120);
    await capture();
    await capture();

    const requestsHeader = stage.getByRole("button", { name: "Requests" });
    await requestsHeader.click();
    await stage.waitForTimeout(120);
    await capture();
    await capture();

    await stage.getByRole("button", { name: "30 days" }).click();
    await stage.waitForTimeout(120);
    await capture();
    await capture();

    await stage.close();
  } finally {
    await browser.close();
    if (server) server.kill();
  }

  const frames = (await readdir(FRAMES)).filter((name) => name.endsWith(".png")).sort();
  process.stdout.write(`captured ${frames.length} frames\n`);

  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      "9",
      "-i",
      join(FRAMES, "frame-%03d.png"),
      "-vf",
      "scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
      "-loop",
      "0",
      join(DOCS, "demo.gif"),
    ],
    { stdio: "inherit" },
  );

  await rm(FRAMES, { recursive: true, force: true });
  process.stdout.write("wrote docs/demo.gif\n");
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
