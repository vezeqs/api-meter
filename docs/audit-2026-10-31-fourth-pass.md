# Audit — 2026-10-31 (fourth pass)

Verification pass over a repository that already carries three audits. The
previous passes are not repeated here; this pass looked for defects that the
third pass introduced or missed.

Baseline on a fresh clone, before any change:

```
$ pnpm install --frozen-lockfile
Done in 765ms using pnpm v10.34.8
$ pnpm test:unit
  ✖ answers a malformed percent-escape with 404 and keeps serving (61.4ms)
  ✖ answers a malformed Host header with 400 and keeps serving (44.2ms)
  ✖ serves only under the deployment subpath (44.7ms)
  ✖ mounts the site's own base path when BASE_PATH is unset (45.2ms)
```

Four of the 61 tests fail. `pnpm build` then `pnpm test:unit` → `ℹ pass 61`,
which isolates the cause.

| #   | Finding                                                                 | Severity | Status                                             |
| --- | ----------------------------------------------------------------------- | -------- | -------------------------------------------------- |
| F1  | `pnpm test:unit` fails on a clean clone; the preview tests need a build | Medium   | fixed, `pnpm test:unit` with `apps/web/out` absent |

## F1 — `pnpm test:unit` needs `pnpm build` after all (Medium)

**Claim:** the command table says `pnpm test:unit` is "Data and formatting
tests, no browser", and `AGENTS.md` invariant: "A test command must pass on a
clean clone. … If a command needs a build, say so — or make it not."
**Evidence:** on a fresh clone with no `apps/web/out` (gitignored build output),
four tests in `tests/unit/tools.test.ts` fail with `404 !== 200` at
`tools.test.ts:206`. `tools/serve-export.mjs` hardcodes its root to
`../apps/web/out/`, so every 200 assertion in the preview-server suite depends
on a build that does not exist yet. The three 404 assertions passed trivially
because nothing was being served at all.
`pnpm build` then `pnpm test:unit` → 61/61 pass, which confirms the cause.
**Cause:** the preview tests exercise the server's mount rules but are fed the
real export, which is build output.
**Fix:** `serve-export.mjs` accepts `EXPORT_ROOT` (default unchanged: the real
export, which is what `pnpm preview` and Playwright use). The unit suite creates
a two-file fixture — `index.html` and `404.html` — and serves that, so the
command no longer depends on a build.
**Status:** fixed. With `apps/web/out` moved away:
`ℹ pass 61, fail 0`. The default path was re-checked manually:
`/api-meter/` → 200, `/` → 404, `/index.html` → 404.

This is the same class of bug the third pass fixed for `@production/shared`:
CI runs `build` before the tests, so the dependency is invisible there. The
third pass fixed the shared package and did not check the other suite that
starts a process.

## Verified, no finding

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` — clean.
- Every image the README references exists and has the dimensions the asset
  test pins.
- `.env.example` advertises three variables, all read somewhere
  (`NEXT_PUBLIC_SITE_URL` 1, `NEXT_PUBLIC_BASE_PATH` 6, `API_PORT` 1).
- The README's "count it yourself" command works: 3369 lines across
  `apps/web/{app,components,lib}`.
- `apps/api` derives its reported version from `package.json`, so the 1.0.5 bump
  needs no code change.

## Not run

The Playwright suite was not run locally: Chromium is not installed in this
environment, and `playwright install` plus system dependencies is outside the
scope of this pass. CI runs it, and this change does not touch the app, the
export, or the preview server's default root.
