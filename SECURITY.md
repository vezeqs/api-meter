# Security Policy

## Reporting a vulnerability

Report suspected vulnerabilities privately through GitHub Security Advisories:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability**.

Do not open a public issue, and do not include exploit details in a pull
request. Include the affected version, the steps to reproduce, and the impact
you believe the issue has.

This project is maintained on a best-effort basis. There is no on-call rotation
and no guaranteed response window; expect a reply when one can be given. Once a
fix is ready, it ships with a security advisory crediting the reporter unless
anonymity is requested.

## Supported versions

Only the latest release is supported. This is a demonstration build with no
production deployment, so the realistic attack surface is the static site and
the pipeline that builds it.

## Handling secrets

- `.env` files are ignored by git. Only `.env.example` is tracked, and it holds
  placeholders, never real values.
- If a secret is committed, treat it as compromised. Rotate it first, then
  remove it from history. Deleting the commit is not enough.
- Server secrets must never be exposed to the browser. Anything prefixed with
  `NEXT_PUBLIC_` is public.

## Scope

In scope:

- Authentication and session handling
- Authorization bypasses
- Injection into queries, templates, or shells
- Exposure of secrets or personal data
- Server-side request forgery

Out of scope:

- Findings from automated scanners with no demonstrated impact
- Missing security headers with no exploit path
- Denial of service through unrealistic traffic volumes
