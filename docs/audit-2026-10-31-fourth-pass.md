# Audit — 2026-10-31 (fourth pass)

Scope: the two most recent pull requests, [#6](https://github.com/vezeqs/api-meter/pull/6)
(`ca67eaa`, "Third audit pass") and [#5](https://github.com/vezeqs/api-meter/pull/5)
(`5764355`, `actions/configure-pages` 5 → 6). Method: read both diffs against
the checks they shipped with, reproduce the failure on a tree without build
output, fix the cause, and make the proof command test it.

PR #5 is not a finding. Its CI run (`41166283620`) and Deploy run
(`41168182163`) both pass; `configure-pages@v6.0.0` is the Node 24 release,
and the workflow already selects Node 24 from `.nvmrc`. The breakage is PR #6.

Four findings.

## Baseline

CI on the merge commit (`41171316822`) and on the PR branch (`41171310343`)
both fail in `pnpm test:unit` with four 404s from `tests/unit/tools.test.ts`.
Locally, `pnpm verify` is green — because `apps/web/out` exists from an earlier
build.

## F36 — The preview-server tests need a build, so CI's unit step fails (High)

**Claim:** `AGENTS.md` documents `pnpm test:unit` as "fast, no browser, no
build". The third pass's F27 fixed exactly this class of defect.

**Evidence:** CI runs `pnpm test:unit` before `pnpm build`
(`.github/workflows/ci.yml`). The new tests spawn `tools/serve-export.mjs`,
which serves `apps/web/out`; a clean checkout has no such directory, so every
request answers 404.

```sh
$ mv apps/web/out /tmp/api-meter-out-backup
$ pnpm test:unit
...
ℹ tests 61
ℹ pass 57
ℹ fail 4
✖ answers a malformed percent-escape with 404 and keeps serving
  404 !== 200
✖ answers a malformed Host header with 400 and keeps serving
  404 !== 200
✖ serves only under the deployment subpath
  404 !== 200
✖ mounts the site's own base path when BASE_PATH is unset
  404 !== 200
```

The same four failures are in the CI log at `tests/unit/tools.test.ts:122`,
`:139`, `:172`, and `:195`. Restore the directory and the suite passes, which
is why the local `pnpm verify` and the third pass's "After" count did not see
it.

**Cause:** the test fixture was the build output. F27 removed one undeclared
build dependency (`@production/shared/dist`); F22–F24 added another
(`apps/web/out`).

**Fix:** `serve-export.mjs` accepts `EXPORT_ROOT`; the unit suite creates a
minimal export in a temp directory (`index.html`, `404.html`,
`dashboard/index.html`) and points the server at it. The tests now exercise
the server, not whatever build happens to be on disk. `EXPORT_ROOT` is listed
in `.env.example`.

**Status:** fixed — `pnpm test:unit` with `apps/web/out` moved aside passes 61
of 61. The subpath test also asserts the served body is the fixture's, so a
build present on the developer's disk cannot mask an ignored `EXPORT_ROOT`.

## F37 — `pnpm verify` builds before the unit suite, hiding clean-clone failures (Medium)

**Claim:** `pnpm verify` is "the proof".

**Evidence:** the script was `format && lint && typecheck && build && test`,
and `test` starts with `test:unit`. F36 passes locally because `build` creates
the directory the unit tests need. The command that is supposed to prove the
clean-clone promise was the one masking it.

**Cause:** the proof order did not match the claim it was proving.

**Fix:** `verify` runs `test:unit` before `build`. The browser suites still run
after the build.

**Status:** fixed — `package.json`, README and AGENTS command descriptions.

## F38 — 1.0.4 repeats `Changed` and `Fixed`, and its link is undefined (Low)

**Evidence:** `CHANGELOG.md` has two `### Changed` and two `### Fixed` headings
under `[1.0.4]`; the second pair is a partial copy of the first. The
`## [1.0.4]` heading has no `[1.0.4]:` definition, and `[Unreleased]` still
compares from `v1.0.3`, so the released heading renders as literal text.

**Fix:** merged into one section each, keeping every unique entry; added the
`1.0.4` link definition and moved the compare base to `v1.0.4`.

**Status:** fixed — `CHANGELOG.md`.

## F39 — README describes the unit suite as data and formatting only (Low)

**Evidence:** the command table says "Data and formatting tests, no browser".
The suite also scans tools, pins the OG card's meter table, and spawns the
preview server against a fixture. "No browser" is still true; "data and
formatting" is not the whole suite.

**Fix:** describe the suite by what it proves.

**Status:** fixed — README.

## Not findings

- **PR #5 (`configure-pages` 5 → 6).** CI passed (`41166283620`) and Deploy
  passed (`41168182163`). v6.0.0 upgrades the action to Node 24; the workflow
  already selects Node 24 from `.nvmrc`, and the post-#6 deploy ran on the
  current action majors. No change needed.
- **The stale local `apps/web/out`.** Not a defect in the repository; it is the
  reason the failure was invisible locally. The fixture removes the dependency
  rather than the directory.

## After

```sh
$ mv apps/web/out /tmp/api-meter-out-backup
$ pnpm verify
> production@1.0.4 verify … format:check && lint && typecheck && test:unit && build && test:e2e && test:tools
✓ format:check
✓ lint
✓ typecheck
ℹ test:unit  61 pass, 0 fail   (no build output present)
✓ build
✓ test:e2e   46 passed
✓ test:tools 2 pass
```
