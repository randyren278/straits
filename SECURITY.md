# Security Policy

## Supported branch

Security fixes are applied to the default `master` branch. Pull requests are expected to pass CI and CodeQL before merge once repository rules are enabled.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could expose credentials, user data, database access, or a practical exploit path. Use GitHub's private vulnerability reporting / Security Advisory flow for this repository when available.

Include enough information to reproduce and assess the issue:

- affected route, component, or service;
- prerequisites and deployment assumptions;
- minimal reproduction steps;
- expected vs. observed behavior;
- potential impact;
- any suggested mitigation.

Do not include production secrets, database connection strings, API keys, session tokens, or private vessel/customer data in reports.

## Security model

### Application access

Straits supports two deployment modes:

1. **Open demo mode** — when `JWT_SECRET` and `PASSWORD_HASH` are not both configured, the dashboard remains open for zero-config local/demo use.
2. **Protected deployment mode** — when both are configured, `src/proxy.ts` requires a valid signed session for product pages and APIs. Login verifies the shared password using bcrypt and stores a short-lived signed JWT in an HTTP-only, SameSite cookie.

`/api/health`, `/api/ready`, and `/api/status` intentionally remain unauthenticated so infrastructure and uptime monitors can inspect service health.

The shared-password gate is an access perimeter, not a complete multi-user authorization system. A future multi-user deployment should use server-verified identity and stop trusting arbitrary client-supplied user identifiers.

### Database exposure

The application accesses PostgreSQL server-side through `pg`. Production schemas enable PostgreSQL row-level security on public tables with zero public policies so Supabase's anonymous PostgREST surface cannot read or mutate application tables. The application database owner remains the trusted server-side access path.

### Secrets

Never commit:

- `DATABASE_URL`;
- `AISSTREAM_API_KEY`;
- `JWT_SECRET`;
- plaintext dashboard passwords;
- production `PASSWORD_HASH` values if the repository becomes private-but-shared and threat boundaries require keeping hashes secret;
- optional provider API keys.

Use the deployment platform's encrypted secret store. `JWT_SECRET` should be at least 32 random bytes/characters and rotated after suspected exposure. Passwords should be stored only as bcrypt hashes.

## Automated security controls

- CodeQL analyzes JavaScript/TypeScript on pushes, pull requests, and a weekly schedule.
- CI performs a production dependency audit.
- Dependabot maintains npm and GitHub Actions dependencies.
- Baseline HTTP response hardening disables MIME sniffing/framing and sets referrer, permissions, and HSTS policies.

A Content Security Policy is intentionally not guessed into place: MapLibre tiles and external data providers require a tested allow-list. Add CSP only after exercising the production map, exports, and external fetch paths under the proposed policy.

## Operational security checklist

Before treating a deployment as production:

- enable branch protection/rulesets and require CI + CodeQL;
- configure protected deployment auth or a first-class identity provider;
- verify RLS is enabled after every schema change;
- rotate secrets through the platform rather than editing committed files;
- monitor liveness (`/api/health`), database readiness (`/api/ready`), and data freshness (`/api/status`);
- move the always-on ingester to managed infrastructure and restrict its database credentials to the minimum required privileges;
- validate sanctions snapshots before destructive reconciliation;
- ensure logs do not contain credentials, raw cookies, or connection strings.
