/**
 * Deployment coordinates shared by the Next app and the Node tools.
 *
 * This file is plain ESM on purpose. `tools/*.mjs` run directly under Node and
 * must not import TypeScript. Keep it free of browser-only imports so the
 * tools can read it without a bundler.
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vezeqs.github.io";

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/api-meter";
