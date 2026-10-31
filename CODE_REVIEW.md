# Code review

A senior review of this repository, written before the fixes in the same
release. Every finding below was reproduced, not inferred. Each one links to
the change that resolves it.

Scope: the whole tree at commit `6dc9bc6`.

Severity reflects user-visible impact. "Critical" would mean data loss or a
security hole; nothing here reaches that bar.

---

## 1. The quota panel is scoped to a billing cycle but fed the analysis window — High

`getUsageSummary(range)` computes `requests` for the selected range and passes
it to `buildQuotas`, which labels the result "Requests this cycle" against a
2,000,000 limit.

Measured:

| Range   | Requests  | Quota reads                  |
| ------- | --------- | ---------------------------- |
| 7 days  | 610,465   | 610,465 / 2,000,000 (30%)    |
| 30 days | 2,502,826 | 2,502,826 / 2,000,000 (125%) |
| 90 days | 7,158,253 | 7,158,253 / 2,000,000 (358%) |

The same account is 30% through its allowance at one setting and 358% over it
at another. A billing-cycle quota cannot depend on how the user slices the
chart. This is a category error: analysis scope and billing scope are different
questions.

**Fix:** split the model. `getUsageSummary(range)` keeps volume, errors,
endpoints, and deltas. A new `getBillingCycle()` owns the 30-day cycle,
allowance, overage, and quotas, and is the only source for them. The range
selector no longer touches billing.

## 2. Spend ignores the included allowance and contradicts the published price — High

`DailyUsage.costUsd` is `requests / 1,000,000 * 12` for every request. The
landing page states the opposite: _"Metered at twelve dollars per million
requests beyond the included allowance."_

For the 30-day cycle the dashboard showed **$30.03**. The Pro plan includes
2,000,000 requests, so the correct figure is 502,826 over the allowance at
$12/M = **$6.03**. The interface was overstating the bill by a factor of five
while the marketing copy described a different product.

This is the most damaging finding: a billing tool that misstates the bill has
no reason to exist.

**Fix:** overage is `max(0, requests − includedRequests)`; spend is
`overage / 1e6 * overagePerMillionUsd`. Both come from the plan record, not a
loose constant.

## 3. The README's size claim is false — High (credibility)

> The dashboard is roughly 1,400 lines of TypeScript and CSS.

Measured: **3,172** lines across `apps/web/app`, `apps/web/components`, and
`apps/web/lib`. Off by more than a factor of two.

A wrong number in the first screen of a README is worse than no number. Either
keep it true or drop it.

**Fix:** state the measured figure and pin it to a command.

## 4. `formatCompact` rolls over into an impossible unit — Medium

```js
formatCompact(999_999); // "1000K"   — should be "1.00M"
formatCompact(999_999_999); // "1000M"   — should be "1.00B"
```

The function selects a unit from the _raw_ value, then rounds the scaled value
up past the next threshold. A table showing `1000K` next to `1.00M` in the same
column looks broken.

**Fix:** promote when the rounded scaled value reaches 1000, and clamp the
precision so the output stays three significant digits.

## 5. `role="meter"` receives `aria-valuenow` above `aria-valuemax` — Medium

`QuotaMeter` passes `aria-valuenow={used}` and `aria-valuemax={limit}` without
clamping. At 125% the accessible values are `valuenow=2502826`,
`valuemax=2000000` — an invalid range. Assistive technology may announce
"2502826 percent" or nothing at all.

axe-core does not flag this, which is why the existing accessibility suite
missed it.

**Fix:** keep `aria-valuemax` at the limit, clamp `aria-valuenow`, and carry
the real story in `aria-valuetext` ("2.50M of 2.00M, 125 percent, over limit").

## 6. The quota limit is duplicated instead of derived — Medium

`buildQuotas` hardcodes `limit: 2_000_000`, which is also
`PLANS.pro.includedRequests`. Change the pricing table and the meter silently
lies.

**Fix:** read the limit from `findPlan(CURRENT_PLAN_ID)`.

## 7. The seats quota contradicts the plan — Medium

The account is on `Pro`, which has `seats: 1`. The quota panel showed
**"Seats 3 of 5"**. One of the two is wrong, and nothing in the code notices.

**Fix:** the third meter is about usage, so make it usage — webhook deliveries,
421,000 of 500,000. Drop `"seats"` from the `Quota` unit union, which then has
no producer.

## 8. `sitemap.xml` ships a frozen `lastModified` — Medium

```ts
lastModified: "2026-10-30",
```

Every deploy claims the page last changed on that date, forever. Crawlers use
`lastmod` to schedule re-crawls; a constant makes the signal worthless and
eventually dishonest.

**Fix:** emit the build timestamp. The route is `force-static`, so it is
computed once per build.

## 9. `.env.example` advertises integrations that do not exist — Medium

The file lists 17 variables. The application reads three:
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BASE_PATH`, and `API_PORT`.

`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `SMTP_*`, `STRIPE_*`, `SENTRY_DSN`,
and `NEXT_PUBLIC_APP_URL` are read by nothing. A contributor copying this file
reasonably concludes there is a database, an auth system, email, payments, and
error reporting.

**Fix:** keep only what is read, and say plainly that adding an integration
means adding its variables here.

## 10. `turbo.json` declares a `test` task nothing implements — Low

No workspace package defines a `test` script, and the root `test` bypasses
turbo. The task entry is inert and misleads anyone reading the pipeline.

**Fix:** remove the task.

## 11. `revoke()` contains a self-assignment — Low

```ts
{ ...key, status: "revoked" as const, lastUsedAt: key.lastUsedAt }
```

The final property assigns a value to itself. Dead code that suggests an
intention that was never implemented.

**Fix:** delete it.

## 12. Revoked keys remain revealable and copyable — Low

`status` is rendered, but the Reveal and Copy buttons stay enabled. A revoked
secret is not a usable secret; offering to copy it invites the user to paste a
dead key into production.

**Fix:** disable both actions when the key is revoked.

## 13. The copy confirmation timer is never cleared — Low

`copyKey` schedules `window.setTimeout` and never clears it. React 18 no longer
warns, so it is invisible — but the callback still runs after unmount.

**Fix:** hold the timer in a ref and clear it on unmount and before rescheduling.

## 14. The chart keeps an out-of-range selection when the window shrinks — Low

Select day 90, switch to 7 days, and `activeIndex` stays 89. `points[89]` is
undefined, so the tooltip and crosshair silently vanish and the keyboard
position becomes undefined.

**Fix:** clamp the index against the current series length when rendering.

## 15. `apps/api` is not consumed by anything — Informational

Nothing imports `@production/api`, and the static export cannot call it at
runtime. It is built and smoke-tested in CI, so it is not broken — just not
yet part of the product.

**Decision:** retained deliberately as the backend skeleton, and labelled as
such in the README rather than presented as a working integration. If the
project stays static-only, this is the first thing to delete.

---

## Not findings

Three things that look wrong and are not, recorded so the next reviewer does
not re-litigate them:

- **`position: relative` on the table scrollers.** Load-bearing. The header
  cells contain absolutely positioned visually-hidden labels; without a
  containing block they anchor to the page and extend its scroll width.
- **The fixed `REFERENCE_DATE`.** Deliberate. A moving "today" makes the
  prerendered HTML disagree with the client render on hydration.
- **No UI, CSS, or charting dependency.** Deliberate. The restraint is the
  design, and the bundle stays small.

---

## What changed as a result

| #          | Fix                                                                                           | Where                                     |
| ---------- | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1, 2, 6, 7 | Billing split from analysis; overage-only spend; plan-derived limits; usage-based third meter | `packages/shared`, `apps/web/lib/data.ts` |
| 3          | Corrected claim, pinned to a command                                                          | `README.md`                               |
| 4          | Unit rollover with tests                                                                      | `apps/web/lib/format.ts`                  |
| 5          | Clamped meter semantics                                                                       | `apps/web/components/quota-meter.tsx`     |
| 8          | Build-time `lastmod`                                                                          | `apps/web/app/sitemap.ts`                 |
| 9          | Trimmed to variables that exist                                                               | `.env.example`                            |
| 10         | Removed inert task                                                                            | `turbo.json`                              |
| 11, 12, 13 | Dead code, revoked-key actions, timer cleanup                                                 | `apps/web/app/dashboard/keys/page.tsx`    |
| 14         | Index clamped to the series                                                                   | `apps/web/components/usage-chart.tsx`     |

Regression cover was added for the two billing defects and the formatting
rollover, at both the unit and end-to-end level, so they cannot return
silently.
