#!/usr/bin/env node
/**
 * Renders apps/web/public/og.png at 1200x630 from the same design tokens the
 * site uses, so the social card cannot drift from the product's look.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUTPUT = join(ROOT, "apps/web/public/og.png");

const METERS = [
  { label: "Requests this cycle", percent: 92, value: "1.84M", limit: "2.00M" },
  { label: "Event storage", percent: 26, value: "6.4 GB", limit: "25.0 GB" },
  { label: "Seats", percent: 60, value: "3", limit: "5" },
];

const bars = METERS.map(
  (meter) => `
    <div class="meter">
      <div class="row">
        <span class="name">${meter.label}</span>
        <span class="pct">${meter.percent}%</span>
      </div>
      <div class="track"><div class="fill" style="width:${meter.percent}%"></div></div>
      <div class="row foot"><span>${meter.value}</span><span>${meter.limit}</span></div>
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
      <span>vezeqs.github.io/meter</span>
    </div>
  </body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

await page.setContent(html, { waitUntil: "load" });
await mkdir(dirname(OUTPUT), { recursive: true });
await page.screenshot({ path: OUTPUT });

await browser.close();
process.stdout.write(`wrote ${OUTPUT}\n`);
