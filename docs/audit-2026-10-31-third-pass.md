# Audit — 2026-10-31 (third pass)

Scope: the tree at `f80e33d`, audited independently of the first two passes
(`docs/audit-2026-10-30.md`, `docs/audit-2026-10-31.md`). Method: read every
claim against behaviour, reproduce each suspicion with a command, fix the
cause, cover it with a test.

Fourteen findings. One breaks a documented promise on a clean checkout. Four
more are the same defect classes the earlier passes removed, alive in places
the fixes never reached: an untrusted-input crash in the same handler the
`%`-fix touched, decorative quota numbers in the social card, duplicated plan
literals in marketing copy and structured data, and a stretched-SVG ellipse one
component over from the component that documents why it cannot be done.

## Baseline

```sh
$ pnpm verify
✓ format:check   All matched files use Prettier code style!
✓ lint           Tasks: 4 successful
✓ typecheck      Tasks: 4 successful
✓ build          Tasks: 3 successful
✓ test           49 unit passed, 45 e2e passed, 2 tools passed
```

Green, as before both earlier passes. Every defect below shipped through it.

---

## F22 — The preview server dies on a malformed `Host` header (Medium)

**Claim:** `pnpm preview` serves the export until it is stopped.

**Evidence:**

```sh
$ node tools/serve-export.mjs &
$ curl -s -o /dev/null -w "%{http_code}\n" -H "Host: a b" http://127.0.0.1:4321/
000
$ curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4321/api-meter/
000   # connection refused — the process is gone
```

`createServer`'s handler runs `new URL(request.url, "http://" + host)` with the
client-supplied `Host` header. `http://a b` is not a valid base, `new URL`
throws inside the async handler, and the unhandled rejection kills the
process. The same defect class as the bare-`%` path crash fixed in `f80e33d`,
two statements earlier in the same handler: the path was untrusted input, and
so is the header.

**Cause:** untrusted request fields reach a throwing parser unguarded.

**Fix:** build the URL inside a guard and answer 400.

**Status:** fixed — `tests/unit/tools.test.ts` → "answers a malformed Host
header with 400 and keeps serving", verified by a raw-socket request (Node's
`fetch` cannot send an illegal `Host`).

## F23 — The preview server serves outside the mount (Low)

**Claim:** the tool "serves apps/web/out the way GitHub Pages serves a project
site: the app is mounted under a subpath".

**Evidence:**

```sh
$ node tools/serve-export.mjs &
$ curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4321/index.html
200
$ curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4321/dashboard/
200
```

GitHub Pages returns 404 outside the project subpath. Serving the export at
the root means an unprefixed internal link — a `href="/dashboard"` that forgot
`next/link` — resolves happily in the local preview and in the Playwright
suite while 404ing in production. The mimic stops mimicking exactly where the
suite is trying to catch a class of bugs.

**Cause:** `resolveFile` strips the prefix when present and serves whatever is
left when absent; there is no outside-the-mount branch.

**Fix:** return null for any path that is not `PREFIX` or under `PREFIX/`.

**Status:** fixed — `tests/unit/tools.test.ts` → "serves only under the
deployment subpath".

## F24 — The documented base-path override and the preview disagree (Medium)

**Claim:** `.env.example` documents `NEXT_PUBLIC_BASE_PATH` as the coordinate
that decides the deployment subpath.

**Evidence:** two different variable names control one coordinate.

```sh
$ grep -rn "process.env" tools/ apps/web/lib/ apps/web/next.config.ts
site-config.mjs:  NEXT_PUBLIC_BASE_PATH ?? "/api-meter"   # the site + docs
next.config.ts:   NEXT_PUBLIC_BASE_PATH ?? "/api-meter"   # the build
serve-export.mjs: BASE_PATH ?? "/api-meter"               # the preview

$ BASE_PATH=/meter NEXT_PUBLIC_BASE_PATH=/ignored node tools/serve-export.mjs &
serving …/out/ at http://127.0.0.1:4321/meter/   # followed the undocumented var
```

Setting the documented variable — `NEXT_PUBLIC_BASE_PATH=/other pnpm build` —
produces an export whose links point to `/other`, served by a preview still
mounted at `/api-meter`. Every link 404s with no error anywhere. The override
that works (`BASE_PATH`) is the one nothing documents; `playwright.config.ts`
meanwhile pastes the literal `/api-meter`, the exact thing `tools.test.ts`
polices in `tools/*.mjs` — one directory over, outside the scan.

**Cause:** each tool invented its own spelling instead of reading the shared
config module the F18 fix created.

**Fix:** `serve-export.mjs` and `playwright.config.ts` both derive the default
from `apps/web/lib/site-config.mjs` (`BASE_PATH` stays as an explicit
override), and the hardcode scan in `tools.test.ts` covers
`playwright.config.ts`.

**Status:** fixed — `tests/unit/tools.test.ts` → "playwright.config.ts does
not hardcode the deployment subpath"; the preview now follows the documented
variable, verified manually with `NEXT_PUBLIC_BASE_PATH=/other`.

## F25 — The OG card shows quotas the product disowns (Medium)

**Claim:** `tools/og.mjs` renders the card "from the same design tokens the
site uses" so it cannot drift from the product.

**Evidence:**

```js
// tools/og.mjs
const METERS = [
  { label: "Requests this cycle", percent: 92, value: "1.84M", limit: "2.00M" },
  { label: "Event storage", percent: 26, value: "6.4 GB", limit: "25.0 GB" },
  { label: "Seats", percent: 60, value: "3", limit: "5" },
];
```

The product renders "Requests this cycle" at 125% — `2.50M of 2.00M`, over
limit, the dramatic centre of the page. The card invents a comfortable 92%
under-limit account. And it renders a "Seats 3 of 5" meter that F7 deleted
from the product precisely because it contradicted the plan record —
`PLANS.pro.seats` is `1`, `PLANS.team.seats` is `5`; "3 of 5" matches no plan
that exists. The URL was fixed in F18 so the card cannot advertise a dead
address; the numbers were left advertising a fictitious account.

**Cause:** decorative constants where derived figures belonged — F7's cause,
in a file the F7 fix never touched.

**Fix:** the card carries the real quotas. `METERS` is exported for testing,
values corrected to the billing cycle's actual figures (requests `2.50M of
2.00M` at 125% with the fill clamped, storage `6.4 GB of 25.0 GB` at 26%,
webhooks `421K of 500K` at 84%), and the render is put behind the same
main-guard `capture.mjs` uses so the table can be imported without launching a
browser.

**Status:** fixed — `tests/unit/og.test.ts` (new) → "the card mirrors the
billing cycle" compares every row of `METERS` against
`getBillingCycle().quotas` formatted by `formatQuotaLabels`, so a drifted
figure fails the suite.

## F26 — Pricing literals duplicated outside `PLANS` (Medium)

**Claim:** the pricing table is the source of truth for plan figures.

**Evidence:** three surfaces type plan data by hand.

```sh
$ grep -n "twelve dollars" apps/web/app/page.tsx
  Metered at twelve dollars per million requests beyond the included allowance.
$ grep -n 'price: "' apps/web/app/layout.tsx
  price: "0" / "49" / "199"        # STRUCTURED_DATA offers
$ grep -n "Pro · 2M req" apps/web/app/dashboard/layout.tsx
  Pro · 2M req                     # plan badge, typed
```

Change `PLANS.pro.overagePerMillionUsd` to 14 and the landing copy still says
twelve, the `SoftwareApplication` offers still quote 0/49/199, and the rail
still says "Pro · 2M req". F6 removed this exact pattern from the quota meter
("change the pricing table and the meter silently lies"); these three
instances were outside its blast radius.

**Cause:** literals where lookups belonged.

**Fix:** all three derive from `PLANS` — the landing copy and the JSON-LD
offers from `PLANS` itself, the rail badge from `findPlan(CURRENT_PLAN_ID)`
via the billing cycle's plan id, formatted by `formatCompact` so the allowance
reads `2.00M` like everywhere else.

**Status:** fixed — `tests/unit/copy.test.ts` (new) scans the three sources
and fails if a pricing literal reappears (`/twelve dollars/`, `price: "\d"`,
a hardcoded plan badge), the same source-scanning style as `tools.test.ts`.

## F27 — `pnpm test:unit` fails on a clean checkout (High)

**Claim:** `AGENTS.md` documents `pnpm test:unit` as "fast, no browser, no
build".

**Evidence:**

```sh
$ git ls-files packages/shared/ | grep -c dist
0                                     # dist/ is gitignored — a clone has none
$ rm -rf packages/shared/dist
$ pnpm test:unit
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '…/node_modules/@production/shared/dist/index.js'
    imported from …/tests/unit/data.test.ts
✖ tests 42  ✔ pass 41  ✖ fail 1
```

The unit suite imports `apps/web/lib/data.ts`, which imports
`@production/shared`, which resolves to `dist/index.js` — a build artifact a
fresh clone does not have. CI never sees this because `turbo run lint` and
`typecheck` declare `dependsOn: ["^build"]` and build `dist` as a side effect
before `test:unit` runs. A contributor running the documented fast path gets a
module-resolution crash, not test results.

**Cause:** the test command secretly required a build step it never declared.

**Fix:** `packages/shared/package.json` gains a `"source"` export condition
pointing at `src/index.ts` — Node 24 strips its types natively — and
`test:unit` runs `node --conditions=source --test`. The suite now needs
exactly what the docs claim: nothing.

**Status:** fixed — verified by `rm -rf packages/shared/dist && pnpm
test:unit` (all 49 pass). The clean-clone path is also what makes the
regression visible, so no further guard is needed: if the condition breaks,
every data and format test fails at once.

> Postscript (fourth pass, same day): F22–F24's preview-server tests then
> served `apps/web/out`, so `pnpm test:unit` still needed a build and CI's
> unit step failed on the merge commit. The fourth pass
> (`docs/audit-2026-10-31-fourth-pass.md`) records and fixes it.

## F28 — The chart's crosshair dot is an ellipse (Medium)

**Claim:** the sparkline's own comment — "a dot becomes an ellipse on a narrow
screen. Only the line is drawn here" — states the rule for every shape inside
a `preserveAspectRatio="none"` SVG.

**Evidence:** measured the rendered marker while hovering the chart:

```
viewport 1440px: svg=729x208  dot=5.1x11.9  (w/h = 0.43)
viewport 390px:  svg=324x160  dot=3.1x9.5   (w/h = 0.33)
```

`usage-chart.tsx` draws the active point as `<circle r={2.5}>`. The viewBox is
1000×100 stretched into a much wider-than-tall box, so the "dot" is a vertical
sliver at every viewport — `vectorEffect="non-scaling-stroke"` only fixes
stroke width, not geometry. The `markLast` dot was removed from the sparkline
in `b2b288c` for becoming a visible ellipse at 390 px; the chart's crosshair
dot is that ellipse at every size.

**Cause:** geometry inside a non-uniformly scaled SVG; the rule was documented
in one component and broken in the next.

**Fix:** the marker moves out of the stretched SVG into the HTML overlay
layer, positioned by the same percentages the tooltip uses, so it renders as a
true circle at any aspect. The crosshair line stays in the SVG — a vertical
line at constant `x` does not distort.

**Status:** fixed — `tests/e2e/dashboard.spec.ts` → "the chart marker stays
circular", which hovers the plot and asserts the marker's rendered
bounding box is within 10% of square.

## F29 — `.env.example` omits `BASE_PATH` (Low)

**Claim:** the file lists "only variables that something actually reads", and
the AGENTS.md sharp edge says the preview-server test pins "the very overrides
`.env.example` documents" — naming `BASE_PATH`.

**Evidence:**

```sh
$ grep -c BASE_PATH .env.example
0
$ grep -n "BASE_PATH" tools/serve-export.mjs
const PREFIX = process.env.BASE_PATH ?? "/api-meter";
```

The override the preview server actually honours is the one the documented
contract does not list. (`PLAYWRIGHT_ORIGIN` was considered for the same
section and left out: it is a test-harness override documented in the README
at the point of use, not app or tool configuration.)

**Fix:** list `BASE_PATH` in the tool-overrides section.

**Status:** fixed — `.env.example`.

## F30 — The base-path link check can pass over an empty set (Low)

**Claim:** "links point through the deployment base path" holds on all three
routes.

**Evidence:**

```ts
const internal = await page.evaluate(() =>
  Array.from(document.querySelectorAll("a[href^='/']"))…);
for (const href of internal) { expect(href).toMatch(/^\/api-meter(\/|$)/); }
```

If a route ever renders zero root-relative anchors, the loop asserts nothing
and passes — the F16 shape in the same spec file the F16 fix landed in. Today
every route has qualifying links, so it is a latent hole rather than a live
false pass.

**Fix:** assert `internal.length > 0` before the loop, the same guard the
accessible-name check now carries.

**Status:** fixed — `tests/e2e/audit.spec.ts`.

## F31 — The health endpoint reports a typed version (Low)

**Evidence:**

```ts
// apps/api/src/index.ts
version: "1.0.3",
```

`package.json` also says `1.0.3`. Two hand-maintained copies of the same fact;
the next tag bumps one and the endpoint lies about the other. F21 removed
hand-typed counts from the README for exactly this failure mode.

**Fix:** read `version` from `apps/api/package.json` through `createRequire`,
which resolves identically from `src/` (dev) and `dist/` (built).

**Status:** fixed — `tests/unit/copy.test.ts` asserts the source contains no
version literal.

## F32 — The keys copy contradicts the reveal control (Low)

**Claim:** the page says "A secret is written once and never returned again",
and the header sub-line says "A key is shown in full once, at creation."

**Evidence:** the Reveal button re-shows the full secret of every active key,
as often as you like — including the four seeded keys that were never
"created" in this session. The demo cannot honour a write-once secret model
because the secrets ship in the bundle; the copy promises behaviour the screen
itself disproves.

**Fix:** state what the UI does — created keys are shown once; existing keys
can be revealed again.

**Status:** fixed — copy in `app/dashboard/keys/page.tsx`; prose, verified by
reading the rendered text (asserting on marketing-grade copy is more brittle
than the claim is worth — same call as F20).

## F33 — `capture.mjs` can orphan the preview server (Low)

**Evidence:** the spawned server is killed in a `finally` that begins after
`chromium.launch()`:

```ts
server = spawn(…);
…
const browser = await chromium.launch();   // throws → main rejects,
try { … } finally { server.kill(); }       // this finally never runs
```

A launch failure leaves the static server bound to the port; the next
`pnpm capture` finds it healthy via `waitForServer` and photographs whatever
build it happens to be serving — silently stale proof, the artefact this
repository cares most about. Related: `waitForServer` accepts any HTTP 200
on the expected URL, so an unrelated service occupying the port is captured as
"the site".

**Fix:** the launch moves inside the `try`, and the readiness probe requires
the served page to identify itself (contains the app's `Meter —` title) — a
foreign 200 stops the run with an error naming the port.

**Status:** fixed — verified manually by pointing `CONNECT_HOST`/`PORT` at a
foreign server (`python3 -m http.server` behind an `api-meter/` directory),
which now aborts with "something else is already serving on :4321" instead of
capturing it.

## F34 — `AGENTS.md` and the README point at the wrong audit (Low)

**Claim:** the AGENTS.md entry table answers "What did the last audit find?"

**Evidence:**

```md
| What did the last audit find? | `docs/audit-2026-10-30.md` |
$ ls docs/audit-*.md
audit-2026-10-30.md audit-2026-10-31.md
```

The last audit is the second pass; the manual points at the first, and the
README's "Code review" section mentions only the fifteen-finding pass. The
link goes stale on every audit — including this one.

**Fix:** the row names the dated series (`docs/audit-*.md`, newest date wins)
rather than a file that ages out, and the README names the series.

**Status:** fixed — `AGENTS.md`, `README.md`.

## F35 — `next.config.ts` misstates its own default (Nit)

**Evidence:** the comment says `NEXT_PUBLIC_BASE_PATH` "is empty for local
development" while the code defaults to `"/api-meter"` — which is why `pnpm
dev` serves at `localhost:3000/api-meter/` as the README correctly says. The
comment describes a default that does not exist.

**Status:** fixed — the comment now states the real default (the deployed
subpath) and why. Corrected while this pass was already editing the file's
claims; the "never fix unasked" line refers to style nits, not a comment that
misstates code.

---

## Not findings

Checked and dismissed, recorded so the next pass does not re-open them:

- **Directory traversal in `serve-export.mjs`.** Suspected: the escape check
  is `candidate.startsWith(ROOT)`, and `ROOT` looks like it ends in `out`
  with no separator — which would admit `…/apps/web/out-leaked.txt`.
  Disproved twice: `path.normalize` keeps the trailing slash (so the boundary
  is `out/`), and the URL parser resolves `%2e%2e`-style segments before the
  handler sees them. Probes `/%2e%2e/x`, `/%2e%2e%2fx`, `/..%2fx`, and a real
  `apps/web/out-leaked.txt` all answered 404.
- **Symlink following.** `stat`/`readFile` follow symlinks, so a symlink
  inside `out/` pointing at `~/.ssh` would be served. `out/` is generated
  output, gitignored, and contains no symlinks; introducing one requires
  write access to the build tree already.
- **`readNumericColumn` in `dashboard.spec.ts` strips non-digits.** It would
  misparse a compact cell ("2.50M" → 250). The Requests column renders
  `formatInteger` today, so the assertion is correct as written; flagged so a
  future formatting change is not mistaken for a sort regression.
- **`formatCompact` above `1e15` prints `1000T`.** The top unit has no
  promotion target. Unreachable — the data layer tops out at millions — and
  the fix would be speculative.
- **`PLAYWRIGHT_ORIGIN` not in `.env.example`.** Intentional: it is a
  test-harness variable documented in the README next to the command that
  uses it, not application configuration.
- **`apps/api` is unconsumed.** Carried over from F15 as an accepted
  decision.
- **A `Host:`-less HTTP/1.1 request gets a 400.** Node's HTTP parser itself
  emits it before the handler runs — correct behaviour, not the server's.

## Summary

| #   | Finding                                       | Severity | Status          |
| --- | --------------------------------------------- | -------- | --------------- |
| F22 | Malformed `Host` kills the preview server     | Medium   | fixed, 1 test   |
| F23 | Preview serves outside the mount              | Low      | fixed, 1 test   |
| F24 | Documented vs actual base-path override       | Medium   | fixed, 1 test   |
| F25 | OG card shows fabricated quotas               | Medium   | fixed, 1 test   |
| F26 | Pricing literals outside `PLANS`              | Medium   | fixed, 1 test   |
| F27 | `pnpm test:unit` needs a build it never says  | High     | fixed, verified |
| F28 | Crosshair dot is an ellipse                   | Medium   | fixed, 1 test   |
| F29 | `.env.example` omits `BASE_PATH`              | Low      | fixed           |
| F30 | Base-path link check can pass on an empty set | Low      | fixed, 1 test   |
| F31 | Health endpoint reports a typed version       | Low      | fixed, 1 test   |
| F32 | Keys copy contradicts the reveal control      | Low      | fixed, prose    |
| F33 | `capture.mjs` can orphan the preview server   | Low      | fixed           |
| F34 | `AGENTS.md`/README point at the wrong audit   | Low      | fixed           |
| F35 | `next.config.ts` misstates its default        | Nit      | fixed, comment  |

## After

```sh
$ pnpm verify
✓ format:check   All matched files use Prettier code style!
✓ lint           Tasks: 4 successful
✓ typecheck      Tasks: 4 successful
✓ build          Tasks: 3 successful
✓ test           61 unit passed, 46 e2e passed, 2 tools passed
```

The delta over the baseline is the new coverage: nine unit tests (the OG pin,
the copy scan, the three server regression tests, the harness scan) and one
e2e test (the circular marker). `apps/web/public/og.png` and the `docs/`
captures were regenerated from this tree; the audit is the third file in the dated
series the README and `AGENTS.md` now point at.
