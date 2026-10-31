/**
 * Deployment coordinates. GitHub Pages serves project sites from a subpath,
 * so the base path has to be known at build time and applied to both links
 * and static assets.
 *
 * SITE_URL is the origin only. BASE_PATH is the subpath, with no trailing
 * slash. Everything else is derived so the two can never double up.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vezeqs.github.io";

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/api-meter";

export function absoluteUrl(pathname: string): string {
  const suffix = pathname === "/" ? "/" : pathname;
  return `${SITE_URL}${BASE_PATH}${suffix}`;
}
