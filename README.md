# Production

A SaaS application built with Next.js, TypeScript, and a pnpm workspace.

This repository is a scaffold. The structure, tooling, and checks are in place;
the product itself has not been built yet.

## Layout

```
apps/
  web/        Next.js app (App Router, React 19)
  api/        Fastify service, ESM, compiled with tsc
packages/
  shared/     Types and constants shared by both apps
```

`packages/shared` builds to `dist/` and is consumed by both apps through the
pnpm workspace, so a change to a shared type is caught by `pnpm typecheck` in
every package that imports it.

## Requirements

- Node 24 (see `.nvmrc`)
- pnpm 10.34.8 (pinned in `packageManager`)

If pnpm is not on your `PATH`, run `corepack enable pnpm`, or use
`corepack pnpm` in place of `pnpm`.

## Setup

```sh
pnpm install
cp .env.example .env
```

Fill in `.env` with real values. Never commit it; only `.env.example` is
tracked.

## Commands

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `pnpm dev`          | Run every app in watch mode               |
| `pnpm build`        | Build all packages in dependency order    |
| `pnpm lint`         | ESLint across the workspace               |
| `pnpm typecheck`    | `tsc --noEmit` in every package           |
| `pnpm test`         | Run tests (no test runner configured yet) |
| `pnpm format`       | Rewrite files with Prettier               |
| `pnpm format:check` | Verify formatting without writing         |
| `pnpm clean`        | Remove build output                       |

## Local ports

| Service | Port | URL                          |
| ------- | ---- | ---------------------------- |
| Web     | 3000 | http://localhost:3000        |
| API     | 4000 | http://localhost:4000/health |

## Before a pull request

```sh
pnpm format:check && pnpm lint && pnpm typecheck && pnpm build
```

CI runs the same four checks plus an API smoke test on every pull request.

## License

MIT. See [LICENSE](LICENSE).
