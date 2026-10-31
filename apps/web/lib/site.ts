/**
 * Deployment coordinates. GitHub Pages serves project sites from a subpath,
 * so the base path has to be known at build time and applied to both links
 * and static assets.
 *
 * SITE_URL is the origin only. BASE_PATH is the subpath, with no trailing
 * slash. Everything else is derived so the two can never double up.
 *
 * The constants live in `site-config.mjs` because the Node tools in `tools/`
 * cannot import TypeScript. This module re-exports them for the app.
 */
import { BASE_PATH, SITE_URL } from "./site-config.mjs";

export { BASE_PATH, SITE_URL };

export function absoluteUrl(pathname: string): string {
  const suffix = pathname === "/" ? "/" : pathname;
  return `${SITE_URL}${BASE_PATH}${suffix}`;
}
