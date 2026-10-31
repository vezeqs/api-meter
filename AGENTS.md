# AGENTS.md

The manual the next person needs. Every line exists because something broke
without it.

## What this is

Meter is a usage and billing front end for an API product: request volume,
quota, error rate, and spend, so a metered invoice never arrives as a surprise.
It is a demonstration build — every figure comes from a seeded generator, and
nothing talks to a database, a payment provider, or an auth system. It is
deployed as a static export at <https://vezeqs.github.io/api-meter/>.

## Entry points

| Question                                   | Answer lives in                     |
| ------------------------------------------ | ----------------------------------- |
| Where do the numbers come from?            | `apps/web/lib/data.ts`              |
| How is a number written on screen?         | `apps/web/lib/format.ts`            |
| What is the base path, what is the origin? | `apps/web/lib/site.ts`              |
| Why does this page look like this?         | `apps/web/app/globals.css` (tokens) |
| What did the last audit find?              | `docs/audit-*.md` — newest wins     |
| Why is the CI shaped this way?             | `.github/workflows/ci.yml`          |

## Invariants

Rules a change must not break. Each one is enforced; the test column says by
what.

| #   | Invariant                                                                                                                                     | Enforced by                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | A billing figure never moves when the chart window changes. The same account cannot be 30% through its allowance at 7 days and 358% at 90.    | e2e "the quota panel is cycle-scoped"                             |
| 2   | Spend is overage only. The plan fee is separate; charging the whole volume at the overage rate overstates the invoice.                        | unit "charges overage only", e2e "cycle spend bills overage only" |
| 3   | Allowances and rates come from `PLANS`. No literal `2_000_000` anywhere else.                                                                 | unit "takes the requests allowance from the plan"                 |
| 4   | Endpoint totals reconcile with the headline figure within 2%.                                                                                 | unit + e2e "endpoint totals reconcile"                            |
| 5   | Rendering is deterministic: fixed seed, fixed `REFERENCE_DATE`, no `Date.now()` or `Math.random()` during render.                             | hydration — any mismatch is visible immediately                   |
| 6   | Every internal link carries `/api-meter`.                                                                                                     | e2e "links point through the deployment base path"                |
| 7   | A meter never reports `aria-valuenow` above `aria-valuemax`.                                                                                  | e2e "the over-limit meter reports a valid ARIA range"             |
| 8   | No horizontal page overflow at 1440, 768, 390, or 320 px.                                                                                     | e2e "no horizontal page overflow"                                 |
| 9   | Every text colour clears 4.5:1 in light and dark.                                                                                             | e2e axe-core, both themes                                         |
| 10  | Every image the README shows exists and has the expected dimensions.                                                                          | unit `assets.test.ts`                                             |
| 11  | No tool hardcodes the deployment host or the preview port and subpath — and neither does the test harness.                                    | unit `tools.test.ts`                                              |
| 12  | The preview server only answers under the deployment subpath and survives malformed request input (headers included).                         | unit "serves only under the deployment subpath", "malformed Host" |
| 13  | A figure that names a plan, quota, or price is derived from `PLANS` / the billing cycle — never typed. This includes copy, badges, and cards. | unit `copy.test.ts`, unit `og.test.ts`                            |

## Commands

```sh
pnpm verify      # format, lint, typecheck, build, unit, e2e, tool smoke — the proof
pnpm dev         # http://localhost:3000/api-meter/
pnpm test:unit   # fast, no browser, no build
pnpm test:e2e    # needs `pnpm build`, plus a one-time `pnpm exec playwright install chromium`
pnpm test:tools  # smoke-render the card and resolve the capture tool; needs Chromium
pnpm capture     # regenerate docs/ after any visual change
pnpm og          # regenerate apps/web/public/og.png
```

## Sharp edges

Traps that have already produced a bug in this repository. Read this before
touching the area it mentions.

**Scroll containers need `position: relative`.** Table headers contain
absolutely positioned visually-hidden labels. Without a containing block they
anchor to the page and give every table page a horizontal scrollbar. This
looked like a `min-width` bug and was not.

**Billing and analysis are separate scopes.** `getBillingCycle()` owns the
cycle, allowance, overage, and meters. `getUsageSummary(range)` owns volume,
error rate, and endpoints. Feeding one into the other is how the product told
two different stories about the same account.

**`formatCompact` must promote.** `999_999` is `1.00M`, never `1000K`. The unit
is chosen from the raw value, so the rounded value has to be re-checked.

**ARIA meters clamp.** An over-limit meter reports `aria-valuenow ===
aria-valuemax` and carries the overage in `aria-valuetext`. axe-core does not
catch an inverted range.

**`SITE_URL` is the origin; `BASE_PATH` is the subpath.** Concatenating them
by hand once produced `/api-meter/meter`. Use `absoluteUrl()`, and let
`next/link` handle link prefixes.

**Playwright drops the path from `baseURL`.** A route written as `/dashboard`
resolves against the origin, not the subpath, so the suite silently tested the
wrong page. Routes in `tests/e2e` carry `/api-meter` explicitly for this
reason.

**The README's numbers are claims.** They were once wrong by a factor of two.
Measure with the command in the README before changing one.

**`.env.example` lists what is read.** Fourteen variables were once advertised
that nothing consumed — a database, auth, SMTP, Stripe, Sentry. A contributor
reasonably believed all of it existed.

**An assertion over an empty set always passes.** The accessible-name check ran
`querySelectorAll("button")` on the landing page, which has no buttons, so it
asserted `0 === 0` for two releases. Any test that iterates a collection must
first assert the collection is not empty.

**Hydration deletes DOM you inject.** To prove an accessibility test could fail,
injecting an unnamed link into the built HTML looked reasonable. React removes
nodes it did not render during hydration, so the injection was gone before the
assertion ran and the test passed. Change the source and rebuild; editing
`apps/web/out` proves nothing.

**Tools read deployment coordinates from `site-config.mjs`.** `og.mjs` and
`capture.mjs` once pasted the host, so a rename would have left the social card
advertising a dead address. They now import `apps/web/lib/site-config.mjs`,
which `site.ts` re-exports. Keep that module plain ESM: Node tools cannot
import TypeScript, and the `.mjs` extension is what makes the import work
without a bundler.

**`HOST` binds; `CONNECT_HOST` connects.** `capture.mjs` once derived its
client URL from `HOST`, which breaks when the server is bound to `0.0.0.0`.
Keep the bind address and the connect address separate.

**Request paths are untrusted input.** A bare `%` in the path made
`decodeURIComponent` throw out of `serve-export.mjs`'s async handler and kill
the process. Decode inside a guard and answer 404.

**Asserting defaults requires setting them.** The preview-server test asserted
`127.0.0.1` and `/api-meter` while inheriting `HOST`/`BASE_PATH` — the very
overrides `.env.example` documents. Pin every variable the assertion names.

**Test counts drift.** The README carried per-suite counts; they doubled in the
commit after they were written. Counts belong in the dated changelog, not in a
living document.

**Request metadata is untrusted input too.** A bare `%` in the path was fixed to
answer 404 — then `new URL(request.url, "http://" + host)` still threw on a
malformed `Host` header and killed the whole preview server. Parse inside a
guard; answer 400.

**The preview only serves under the mount.** Anything outside `BASE_PATH` is a
404, because GitHub Pages answers 404 there. A server that resolves unprefixed
paths hides the exact bug `next/link` is supposed to prevent.

**One coordinate, one variable.** `NEXT_PUBLIC_BASE_PATH` (documented, drives
the build) and `BASE_PATH` (preview override) once disagreed: the export's
links pointed at one subpath while the server mounted another. Both now derive
from `site-config.mjs`; the literal lives there only.

**`non-scaling-stroke` fixes strokes, not geometry.** A `circle` inside a
`preserveAspectRatio="none"` SVG renders as an ellipse at every viewport
(measured 5×12 px at 1440). Point markers belong in the HTML overlay,
positioned by percentage — the sparkline learned this first.

**A test command must pass on a clean clone.** `pnpm test:unit` resolved
`@production/shared` to gitignored `dist/`; CI masked it because turbo's
`^build` ran first. The `source` export condition points the suite at `src/`.
If a command needs a build, say so — or make it not.

**The preview tests serve a fixture, not the export.** `serve-export.mjs` takes
`EXPORT_ROOT` for that reason, and `tests/unit/tools.test.ts` points it at a
two-file temp directory. Repointing it at `apps/web/out` makes `pnpm test:unit`
require `pnpm build` again — the same clean-clone bug as above, which survived
the third pass because CI builds first.

**Decorative numbers drift.** The OG card typed "1.84M/2.00M" and "Seats 3 of
5" — a meter F7 removed for contradicting the plan record. Any surface that
shows plan or cycle figures derives them or carries a test pinning them to
`PLANS`/`getBillingCycle()`. That includes marketing copy, `ld+json`, and the
version an endpoint reports.

## Definition of done

- [ ] `pnpm verify` passes.
- [ ] New numbers are derived, not typed in.
- [ ] New tests can fail: prove it by breaking the thing once.
- [ ] New controls are reachable and operable by keyboard.
- [ ] Visual changes are followed by `pnpm capture`.
- [ ] New environment variables are added to `.env.example` **and** read somewhere.
- [ ] No secrets, `.env` files, build output, or capture frames staged.
- [ ] `CHANGELOG.md` has an entry under the right heading.

## What not to touch

- **The licence.** MIT; keep the copyright notice.
- **`REFERENCE_DATE` and the PRNG seed.** Changing either reshapes every
  screenshot and every assertion.
- **Unrelated files' formatting.** Prettier decides; do not hand-reflow.
- **The no-dependency rule.** No UI framework, CSS framework, or charting
  library. The restraint is the design.
- **A failing check.** Fix the cause. Never weaken a test, an ESLint rule, or a
  colour to make it pass.
