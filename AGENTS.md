# AGENTS.md

Operating instructions for anyone — human or agent — changing this repository.
Read it before the first edit. It is short on purpose; every line here exists
because something broke without it.

## What this is

Meter is a usage and billing front end for an API product. It answers four
questions: how much have I used, how much is left, is anything failing, and
what will it cost.

It is a **demonstration build**. Every figure comes from a seeded generator in
`apps/web/lib/data.ts`. Nothing is collected from a real service, and nothing
here talks to a database, a payment provider, or an auth system. Do not write
copy or code that implies otherwise.

Deployed at <https://vezeqs.github.io/api-meter/> as a static export.

## Commands

| Command          | Use it when                                                |
| ---------------- | ---------------------------------------------------------- |
| `pnpm verify`    | Before every commit. Format, lint, typecheck, build, test. |
| `pnpm dev`       | Iterating on UI. Serves at `/api-meter`.                   |
| `pnpm test:unit` | Fast feedback on data and formatting. No browser.          |
| `pnpm test:e2e`  | Needs `pnpm build` first. Audits the real export.          |
| `pnpm preview`   | Serve the built export the way GitHub Pages does.          |
| `pnpm capture`   | Any visual change. Regenerates `docs/`.                    |
| `pnpm og`        | After changing brand copy or the Open Graph card.          |

`pnpm build` is a prerequisite for the end-to-end suite because it runs against
`apps/web/out`, not a dev server.

## Layout

```
apps/web/app          routes; page.tsx is the landing page, dashboard/ is the app
apps/web/components   one component per file, CSS module beside it
apps/web/lib          data.ts (seeded data), format.ts (presentation), site.ts (URLs)
apps/web/public       og.png, .nojekyll
apps/api              Fastify service — skeleton, not yet consumed by the web app
packages/shared       types and constants; the only cross-package contract
tests/unit            node:test, no browser, no build
tests/e2e             Playwright against the exported site
tools/                static server, screenshot capture, OG renderer
docs/                 screenshots and the demo GIF used by the README
```

## Invariants

These are the rules that are not obvious from reading one file. Breaking one
produces a bug that the tests will catch, or worse, one they will not.

**Billing and analysis are different scopes.** `getBillingCycle()` owns the
30-day cycle, the allowance, the overage, and the quota meters.
`getUsageSummary(range)` owns volume, error rate, endpoints, and deltas. The
range selector must never influence a billing figure — the same account cannot
be 30% through its allowance at 7 days and 358% at 90 days. This was a real
bug; see `CODE_REVIEW.md`.

**Spend is overage only.** The plan fee is billed separately. Charging the full
volume at the overage rate overstates the invoice by 5x in this dataset.

**Limits come from the plan.** `PLANS` in `packages/shared` is the single
source for included requests and overage rates. A literal `2_000_000` anywhere
else will drift the moment pricing changes.

**The data is deterministic.** `REFERENCE_DATE` is fixed and every series comes
from `mulberry32` with a constant seed. Never call `Date.now()` or
`Math.random()` during render — the page is prerendered, so the client would
compute different values and hydration would mismatch.

**One origin, one subpath.** `SITE_URL` is the origin; `BASE_PATH` is
`/api-meter`. `absoluteUrl()` joins them. Never concatenate by hand, and never
hardcode `/api-meter` in a link — `next/link` applies it.

**The site is a static export.** No server components with request data, no
route handlers, no middleware, no `dynamic = "force-dynamic"`.

**Scroll containers need `position: relative`.** The table headers contain
absolutely positioned visually-hidden labels. Without a containing block they
anchor to the page and give every table page a horizontal scrollbar.

**Colour is a contract.** Use the tokens in `globals.css`. Every text colour
must clear 4.5:1 against its surface in both themes; the accessibility suite
enforces this, and `--ink-3` is the lightest value that passes.

## Change checklist

- [ ] `pnpm verify` passes.
- [ ] Any new number on screen is derived, not typed in.
- [ ] Any new interactive control is reachable and operable by keyboard.
- [ ] Any visual change is followed by `pnpm capture`.
- [ ] Any new environment variable is added to `.env.example` **and** is
      actually read somewhere.
- [ ] No secrets, `.env` files, build output, or capture frames staged.

## Symptom to cause

| Symptom                                         | Cause                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Horizontal scrollbar on a table page            | An absolutely positioned element escaped its scroll container. Add `position: relative`. |
| Quota percentage moves with the range selector  | A billing value is being fed from `getUsageSummary`.                                     |
| Links 404 on GitHub Pages, work locally         | A path bypassed `next/link` or `absoluteUrl`.                                            |
| Text flickers or React logs a hydration warning | Non-deterministic value during render.                                                   |
| `tsc` fails on a fresh clone                    | `packages/shared` has not been built. Run `pnpm build`.                                  |
| Table column looks misaligned                   | A non-monospace figure, or a missing `.num` class.                                       |
| `1000K` in a column                             | `formatCompact` regressed; it must promote to `1.00M`.                                   |

## Style

- TypeScript strict. No `any`, no `@ts-ignore` without a written reason.
- `import type` for types; `verbatimModuleSyntax` is on.
- ESM only in `apps/api` and `packages/shared`; relative imports need `.js`.
- No UI framework, CSS framework, or charting library. The restraint is the
  design. Hand-written CSS Modules and inline SVG only.
- Numbers use the `num` class: tabular figures, monospace, aligned.

## Release

1. Update `CHANGELOG.md`: move `Unreleased` under a version and a date.
2. `pnpm verify`.
3. Commit, then `git tag -a vX.Y.Z -m "..."`.
4. Push the branch, then the tag.
5. The deploy workflow publishes `apps/web/out` to Pages on every push to
   `main`.

## Do not

- Reformat files you were not asked to touch.
- Weaken a test, an ESLint rule, or a colour to make a failure disappear.
- Add a dependency without saying what it replaces.
- Present this demo as a production service.
- Change the licence. It is MIT; keep the copyright notice.
- Force-push or rewrite published history.
