# Contributing

## Setup

```sh
pnpm install
cp .env.example .env
```

Node 24 and pnpm 10.34.8 are required. `.nvmrc` pins the Node version; the
`packageManager` field pins pnpm.

## Branches

`main` is always deployable. Work on a branch and open a pull request:

```sh
git switch -c feat/short-description
```

Use `feat/`, `fix/`, `chore/`, or `docs/` as the prefix.

## Commits

Write the subject in the imperative mood, under 72 characters, with no trailing
period. Use the body to explain why the change is needed, not what the diff
already shows.

```
Add seat limits to the billing model

Team plans allowed unlimited seats, which let a single account
provision more than the plan pays for.
```

## Before a pull request

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

CI runs the same checks plus an API smoke test. A pull request that fails them
is not ready for review.

## Adding a dependency

Pin an exact version. Prefer a version published at least a week ago. Add it to
the package that uses it, not to the root, unless it is genuinely shared
tooling. Say in the pull request why the dependency is needed and what it
replaces.

## Adding an environment variable

1. Add it to `.env.example` with a safe placeholder.
2. Read it through a single config module, not scattered across the codebase.
3. Never prefix a server secret with `NEXT_PUBLIC_`.

## Code style

Prettier and ESLint decide formatting. Do not hand-format around them. Types
are strict; prefer fixing the type over casting.

## Reporting a security issue

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).
