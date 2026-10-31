# AGENTS.md

Operating instructions for AI coding agents working in this repository. Read
this before changing anything.

## What this repository is

A SaaS application built as a pnpm workspace with Turborepo. Next.js serves the
product; a Fastify service handles work that does not belong in a request
handler; `packages/shared` holds the types and constants both depend on.

The scaffold is complete and verified. The product is not built yet, so most
directories are intentionally thin. Do not invent architecture that has not
been asked for.

## Layout

| Path                           | What lives there                                               |
| ------------------------------ | -------------------------------------------------------------- |
| `apps/web`                     | Next.js App Router. Pages, layouts, route handlers, UI.        |
| `apps/api`                     | Fastify service. ESM, built with `tsc` to `dist/`.             |
| `packages/shared`              | Types and constants imported by both apps.                     |
| `packages/shared/src/index.ts` | The package's public surface. Everything exported here is API. |

`packages/shared` is prebuilt, not transpiled by Next.js. It must be built
before `apps/web` and `apps/api` can resolve it. Turborepo handles the order
through `dependsOn: ["^build"]`, so always build with `pnpm build` rather than
building a single app from a clean tree.

## House rules

- TypeScript everywhere, strict mode. No `any` and no `@ts-ignore` without a
  comment explaining why the type system cannot express the case.
- Type-only imports use `import type`. The `consistent-type-imports` rule
  enforces this.
- `verbatimModuleSyntax` is on. Every relative import in `apps/api` and
  `packages/shared` needs its `.js` extension, even though the source is
  `.ts`. `apps/web` uses bundler resolution and does not.
- ESM only. `apps/api` and `packages/shared` are `"type": "module"`. Do not add
  CommonJS files.
- Server secrets never reach the client. Anything read by a client component
  must be `NEXT_PUBLIC_` and is public by definition.
- Every new environment variable gets a placeholder in `.env.example` in the
  same commit.
- Pin dependency versions exactly. The lockfile is committed; do not delete or
  regenerate it casually.
- Prefer the standard library and existing dependencies over a new package.
  Justify every addition in the pull request.

## Security

- Never commit `.env`, credentials, tokens, private keys, or customer data.
  `.gitignore` covers the common cases; do not weaken it.
- Validate and parse untrusted input at the boundary. Do not pass request
  bodies straight into a database, a template, or a shell.
- Do not log request bodies, tokens, or personal data. Fastify's logger is on;
  keep it that way.
- Authorize on the server. Hiding a button is not access control.
- Do not add analytics, trackers, or third-party scripts that collect user
  data without being asked.

## Verification

Run all four before reporting work as done:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

To exercise the API locally:

```sh
pnpm build
node apps/api/dist/index.js &
curl -sf http://127.0.0.1:4000/health
kill %1
```

To exercise the web app:

```sh
pnpm build
pnpm --filter @production/web start
```

The expected response from `/health` is
`{"status":"ok","service":"api","version":"0.1.0"}`.

## Common mistakes

- Editing `packages/shared/src/index.ts` and forgetting that consumers need a
  rebuild before they see the change.
- Adding a relative import in `apps/api` without the `.js` extension.
- Putting a server-only value behind `NEXT_PUBLIC_` and shipping it to the
  browser.
- Adding a dependency to the root `package.json` when it belongs to one app.
- Committing `.env`, `.next`, `dist`, or `node_modules`.
- Weakening a check or an ESLint rule to make a failure go away. Fix the
  cause.

## Definition of done

- [ ] `pnpm format:check` passes.
- [ ] `pnpm lint` passes with no new warnings.
- [ ] `pnpm typecheck` passes in every package.
- [ ] `pnpm build` passes.
- [ ] New environment variables are documented in `.env.example`.
- [ ] No secrets, tokens, or generated output in the diff.
- [ ] The pull request explains why the change is needed.

## Working in this repository

- Do not reformat files you were not asked to touch.
- Do not change the license. The code is MIT; keep the copyright notice.
- Do not force-push, rewrite published history, or commit directly to `main`
  without being asked.
- If a check fails, fix the cause. Do not suppress the check.
