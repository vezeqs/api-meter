#!/usr/bin/env node
/**
 * Renders apps/web/public/og.png at 1200x630 from the same design tokens the
 * site uses, so the social card cannot drift from the product's look.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BASE_PATH, SITE_URL } from "../apps/web/lib/site-config.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUTPUT = process.env.OG_OUTPUT ?? join(ROOT, "apps/web/public/og.png");

// Same coordinates the site uses, so the card cannot advertise a dead address.
const DISPLAY_URL = `${SITE_URL.replace(/^https?:\/\//, "")}${BASE_PATH}`;

/**
 * The same three quotas the product renders — the card advertises the real
 * account, so the requests meter is over limit like the dashboard's.
 * tests/unit/og.test.ts pins every row to getBillingCycle().quotas.
 */
export const METERS = [
  { label: "Requests this cycle", percent: 125, value: "2.50M", limit: "2.00M" },
  { label: "Event storage", percent: 26, value: "6.4 GB", limit: "25.0 GB" },
  { label: "Webhook deliveries", percent: 84, value: "421K", limit: "500K" },
];

const bars = METERS.map(
  (meter) => `
    <div class="meter">
      <div class="row">
        <span class="name">${meter.label}</span>
        <span class="pct">${meter.percent}%</span>
      </div>
      <div class="track"><div class="fill" style="width:${Math.min(meter.percent, 100)}%"></div></div>
      <div class="row foot"><span>${meter.value}${meter.percent > 100 ? " · over limit" : ""}</span><span>${meter.limit}</span></div>
    </div>`,
).join("");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; margin: 0; }
      body {
        width: 1200px;
        height: 630px;
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 40px;
        padding: 64px 72px;
        background: #f7f6f2;
        color: #14140f;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: ui-monospace, "SF Mono", Menlo, monospace;
        font-size: 17px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        font-weight: 500;
      }
      .mark { width: 14px; height: 14px; background: #a8431c; }
      .hero { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 56px; align-items: center; }
      h1 {
        font-size: 66px;
        line-height: 1.02;
        letter-spacing: -0.035em;
        font-weight: 600;
        max-width: 13ch;
      }
      .panel { border: 1px solid #e0ded6; background: #ffffff; padding: 24px; display: grid; gap: 18px; }
      .meter { display: grid; gap: 7px; }
      .row { display: flex; justify-content: space-between; align-items: baseline; font-size: 14px; }
      .name { color: #5a5a52; }
      .pct { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
      .track {
        position: relative;
        height: 11px;
        background: #f0efe9;
        border: 1px solid #e0ded6;
        overflow: hidden;
      }
      .fill { position: absolute; inset: 0 auto 0 0; background: #14140f; }
      .meter:first-child .fill { background: #a8431c; }
      .foot {
        font-family: ui-monospace, "SF Mono", Menlo, monospace;
        font-size: 11px;
        color: #63635c;
      }
      .footer {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        border-top: 1px solid #e0ded6;
        padding-top: 20px;
        font-family: ui-monospace, "SF Mono", Menlo, monospace;
        font-size: 13px;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: #63635c;
      }
    </style>
  </head>
  <body>
    <div class="brand"><span class="mark"></span>Meter</div>
    <div class="hero">
      <h1>Know what your API costs before the invoice does.</h1>
      <div class="panel">${bars}</div>
    </div>
    <div class="footer">
      <span>Usage and billing for API products</span>
      <span>${DISPLAY_URL}</span>
    </div>
  </body>
</html>`;

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

    await page.setContent(html, { waitUntil: "load" });
    await mkdir(dirname(OUTPUT), { recursive: true });
    await page.screenshot({ path: OUTPUT });
    await page.close();
  } finally {
    await browser.close();
  }

  process.stdout.write(`wrote ${OUTPUT}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exit(1);
  });
}
