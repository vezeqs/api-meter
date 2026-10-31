# Meter

Usage and billing for API products. Request volume, quota consumption, error
rate, and spend, in one place, so a metered bill never arrives as a surprise.

**[Live preview →](https://vezeqs.github.io/api-meter/)**

![The Meter dashboard: request volume, quota meters, and an endpoint table](docs/demo.gif)

## What this is

A working front end for a metered API product. It reads a request log and turns
it into the four things a customer actually asks about: how much have I used,
how much is left, is anything failing, and what will this cost.

The interface is built as a precision instrument rather than a dashboard of
cards: hairline rules, tabular figures, one accent colour, and a quota bar that
turns at ninety percent instead of after the invoice.

This repository is a demonstration build. Every figure is generated from a
fixed seed in [`apps/web/lib/data.ts`](apps/web/lib/data.ts); nothing is
collected from a real service.

## Screens

| Overview                        | API keys                   |
| ------------------------------- | -------------------------- |
| ![Overview](docs/dashboard.png) | ![API keys](docs/keys.png) |

<img src="docs/dashboard-mobile.png" alt="The dashboard at 390 pixels wide" width="320" />

## What it does

**Request volume.** A daily series per endpoint, with a chart that responds to
the keyboard as well as the pointer. Arrow keys walk the series and announce
each day to assistive technology.

**Quota.** Used against the cycle limit, with tick marks every ten percent. The
bar switches to the accent colour at ninety percent and reports an overage when
the limit is passed.

**Endpoints.** Sortable by any numeric column, filterable by path, with a
sparkline beside each row. The per-endpoint totals reconcile with the headline
figure — there is a test that fails if they drift apart.

**API keys.** Reveal, copy, revoke with confirmation, and create. A new secret
is written in full once, which is what a real system does.

## Stack

|           |                                                |
| --------- | ---------------------------------------------- |
| Framework | Next.js 16, App Router, static export          |
| Language  | TypeScript 6, strict                           |
| UI        | Hand-written CSS Modules, no component library |
| Charts    | Inline SVG, no charting dependency             |
| Tests     | Playwright with axe-core                       |
| Workspace | pnpm + Turborepo                               |

There is no UI framework, no CSS framework, and no charting library. The
dashboard is roughly 1,400 lines of TypeScript and CSS.

## Getting started

Requires Node 24 (see `.nvmrc`) and pnpm 10.34.8 (pinned in `packageManager`).

```sh
pnpm install
pnpm build
pnpm preview
```

Then open <http://127.0.0.1:4321/api-meter/>. `pnpm preview` serves the exported
site from a subpath, the same way GitHub Pages will.

For development with reloading:

```sh
pnpm dev
```

The app is served at <http://localhost:3000/api-meter/>.

## Commands

| Command          | What it does                                           |
| ---------------- | ------------------------------------------------------ |
| `pnpm dev`       | Run the apps in watch mode                             |
| `pnpm build`     | Build every package, export the site to `apps/web/out` |
| `pnpm preview`   | Serve the exported site at a GitHub Pages-like subpath |
| `pnpm test`      | Playwright suite: layout, accessibility, and behaviour |
| `pnpm verify`    | Format, lint, typecheck, build, then test              |
| `pnpm lint`      | ESLint across the workspace                            |
| `pnpm typecheck` | `tsc --noEmit` in every package                        |
| `pnpm format`    | Rewrite files with Prettier                            |
| `pnpm capture`   | Regenerate the screenshots and GIF in `docs/`          |
| `pnpm og`        | Regenerate `apps/web/public/og.png`                    |

## Testing

The suite runs against the exported build served from `/api-meter`, so it exercises
the real deployment shape rather than a root-mounted dev server.

```sh
pnpm build && pnpm test
```

The same suite can be pointed at the deployed site:

```sh
PLAYWRIGHT_ORIGIN=https://vezeqs.github.io pnpm test
```

It covers:

- No console errors or page exceptions on any route
- No horizontal overflow at 1440, 768, 390, and 320 pixels, verified by
  attempting to scroll rather than by comparing widths
- One `h1` and a working skip link per page
- Every button has an accessible name
- No axe-core violations under WCAG 2.1 AA, in light and dark themes
- Endpoint totals reconcile with the headline figure at every time range
- Sorting, filtering, keyboard chart navigation, key reveal, copy, revoke, and
  create

## Deployment

`.github/workflows/deploy.yml` builds the static export and publishes it to
GitHub Pages. The base path and canonical origin are derived from the
repository, so renaming the repo does not break links.

Search engine handling:

- `app/sitemap.ts` and `app/robots.ts` generate `sitemap.xml` and `robots.txt`
  at build time
- The landing page is indexable, with a canonical URL, Open Graph tags, and
  `SoftwareApplication` structured data
- `/dashboard` is excluded with both `noindex` and a `robots.txt` rule

Note that a `robots.txt` under a project subpath is not read by crawlers, which
only fetch it from the host root. The `noindex` meta tag on the dashboard is the
rule that actually takes effect.

## Project structure

```
apps/
  web/        Next.js app, exported to static files
  api/        Fastify service for work that does not belong in a request handler
packages/
  shared/     Types and constants used by both
tests/
  e2e/        Playwright audit and behaviour suites
tools/
  serve-export.mjs   Static server that mimics GitHub Pages
  capture.mjs        Screenshots and the demo GIF
  og.mjs             Open Graph card
```

## License

MIT. See [LICENSE](LICENSE).
