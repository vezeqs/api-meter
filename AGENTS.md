# AGENTS.md

Operating instructions for AI coding agents working in this repository. Read
this before changing anything.

## What this repository is

Meter is a usage and billing front end for an API product: request volume,
quota, error rate, and spend. It is a pnpm workspace with Turborepo. Next.js
serves the product and is exported as static files for GitHub Pages; a Fastify
service handles work that does not belong in a request handler;
`packages/shared` holds the types both depend on.

The dashboard runs on generated data with a fixed seed. It is a demonstration
build, not a production service. Do not present it as one, and do not add copy
that implies real customer data.

## Layout

| Path                           | What lives there                                                 |
| ------------------------------ | ---------------------------------------------------------------- |
| `apps/web/app`                 | Routes. `page.tsx` is the landing page, `dashboard/` is the app. |
| `apps/web/components`          | Shared UI. Each component owns a CSS module beside it.           |
| `apps/web/lib`                 | Data generation, formatting, and site constants.                 |
| `apps/web/public`              | Static assets, including `og.png` and `.nojekyll`.               |
| `apps/api`                     | Fastify service. ESM, built with `tsc` to `dist/`.               |
| `packages/shared/src/index.ts` | Types and constants. Everything exported is API.                 |
| `tests/e2e`                    | Playwright audit and behaviour suites.                           |
| `tools`                        | Static server, screenshot capture, Open Graph generation.        |
| `docs`                         | Screenshots and the demo GIF used by the README.                 |

`packages/shared` is prebuilt, not transpiled by Next.js. It must be built
before the apps can resolve it. Turborepo handles the order through
`dependsOn: ["^build"]`, so build with `pnpm build` rather than building one app
from a clean tree.

## House rules

- TypeScript everywhere, strict mode. No `any` and no `@ts-ignore` without a
  comment explaining why the type system cannot express the case.
- Type-only imports use `import type`. The `consistent-type-imports` rule
  enforces this.
- `verbatimModuleSyntax` is on. Relative imports in `apps/api` and
  `packages/shared` need their `.js` extension. `apps/web` uses bundler
  resolution and does not.
- ESM only. `apps/api` and `packages/shared` are `"type": "module"`.
- No UI framework, CSS framework, or charting library. The visual language is
  hand-written CSS Modules and inline SVG. Keep it that way; the restraint is
  the design.
- Use the design tokens in `apps/web/app/globals.css`. Do not introduce a new
  colour, radius, or font without replacing an existing one.
- Every colour must meet WCAG AA against the surface it sits on, in both
  themes. `--ink-3` is the lightest text colour allowed, and only at 11px or
  larger with a monospace face.
- Server secrets never reach the client. Anything prefixed `NEXT_PUBLIC_` is
  public.
- Every new environment variable gets a placeholder in `.env.example`.
- Pin dependency versions exactly. The lockfile is committed.
- Prefer the standard library and existing dependencies over a new package.
  Justify every addition.

## Deployment constraints

The site is a static export served from a subpath. This shapes the code:

- `output: "export"` in `next.config.ts`. No server components with request
  data, no route handlers, no middleware, no dynamic routes without
  `generateStaticParams`.
- `BASE_PATH` is `/meter` by default. Every internal link goes through
  `next/link` or `lib/site.ts` so the prefix is applied once.
- `SITE_URL` is the origin only. `BASE_PATH` is the subpath. Concatenating them
  is `absoluteUrl`'s job; do not do it by hand.
- Anything read from `window`, `navigator`, or `crypto` belongs in a client
  component and must not run during the prerender.

## Testing

```sh
pnpm build && pnpm test
```

The suite runs against `apps/web/out` served from `/meter`, which is why a
build is required first. It checks console health, horizontal overflow at four
widths, document structure, base-path correctness, sitemap and robots content,
axe-core under WCAG 2.1 AA in both themes, and the behaviour of every
interactive control.

If you change the data layer, keep the reconciliation test passing: the
per-endpoint totals must sum to the headline figure within two percent.

## Common mistakes

- Hardcoding `/meter` in a link or asset path instead of using `next/link` or
  `absoluteUrl`.
- Putting `position: absolute` content inside a horizontally scrolling
  container without making that container a containing block. The
  visually-hidden labels will anchor to the page and extend its scroll width.
- Changing the seed or the shape of `lib/data.ts` and breaking the totals.
- Editing `packages/shared/src/index.ts` and forgetting that consumers need a
  rebuild before they see the change.
- Adding a relative import in `apps/api` without the `.js` extension.
- Committing `.env`, `.next`, `out`, `dist`, `node_modules`, or capture frames.
- Weakening a check or an ESLint rule to make a failure go away.

## Regenerating assets

```sh
pnpm build
pnpm capture   # docs/landing.png, dashboard.png, keys.png, dashboard-mobile.png, demo.gif
pnpm og        # apps/web/public/og.png
```

Re-run both after any visual change. A README screenshot that no longer matches
the product is worse than no screenshot.

## Definition of done

- [ ] `pnpm verify` passes.
- [ ] New UI meets WCAG AA in light and dark themes.
- [ ] No horizontal overflow at 1440, 768, 390, or 320 pixels.
- [ ] Screenshots and the GIF regenerated if anything visual changed.
- [ ] New environment variables documented in `.env.example`.
- [ ] No secrets, tokens, or generated output in the diff.

## Working in this repository

- Do not reformat files you were not asked to touch.
- Do not change the license. The code is MIT; keep the copyright notice.
- Do not force-push, rewrite published history, or commit directly to `main`
  without being asked.
- If a check fails, fix the cause. Do not suppress the check.
