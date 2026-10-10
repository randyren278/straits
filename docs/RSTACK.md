# Rstack workflow for Straits

## Invocation and configuration

In Codex, use `$r-mode <task>` to select an evidence-driven workflow,
`$r-verify <change or journey>` for verification, or `$r-setup` to refresh setup.
The installed skills live under `~/.agents/skills/r-*/SKILL.md`. Linked Claude
skills use `/r-mode`; a Claude plugin installation uses `/rstack:r-mode`.

`.rstack/config.json` uses schema version 1. Empty `roles` inherit the active
session model and reasoning settings. `max_workers: 2` limits proposed worker
concurrency to keep verification and edits manageable. This is skill guidance;
it does not change host settings, enable tools, grant permissions, or authorize
delegation. Check the active host and session instructions each time.

## Launch

Use Node.js 22 to match `.github/workflows/ci.yml`. Install locked dependencies
with `npm ci` when needed.

- `./run.sh`: starts or reuses a Docker TimescaleDB container, applies the local
  schema, creates `.env.local` if needed, seeds an empty database, and runs the
  dashboard at `http://localhost:3000/dashboard`. Docker's daemon must be running.
- `npm run dev`: starts only Next.js against the configured database.
- `npm run build` then `npm run start`: builds and serves the production bundle.
- `npm run ingester:dev`: separately runs the live ingester using `.env.local`.

Before using `run.sh`, confirm `.env.local` targets the intended local database:
the script preserves an existing URL, while its schema and empty-database check
target the Docker database. Its seed command uses `.env.local`. Do not print
credentials. `./run.sh --reseed` truncates and reseeds data.

## Verification commands

Run from the repository root. Success means the command exits zero and the
expected assertions actually ran; report skipped checks separately.

| Command | Evidence and prerequisites |
| --- | --- |
| `npm run lint` | ESLint for `src/`. |
| `npm run typecheck` | TypeScript without emitting JavaScript. |
| `npm run test:ci` | Vitest unit/component and available Postgres integration tests. |
| `npm run check` | Lint, types, then tests. |
| `npm run ci` | All of `check`, then a local production build. |
| `CHROME_CHANNEL=chrome npm run verify` | Fleet and dashboard layout assertions against a running local app. |
| `BASE_URL=http://localhost:3000 npm run verify:vessel-loading` | Phone/desktop delayed-vessel-response map reveal; uses fixture vessel responses and real basemap requests; writes screenshots to a temporary directory. |
| `BASE_URL=http://localhost:3000 npm run verify:coverage` | Coverage API labels match the dashboard and analytics DOM. |
| `BASE_URL=http://localhost:3000 npm run verify:crossings` | Crossing day controls and voyage detail match the API. |
| `BASE_URL=http://localhost:3000 npm run verify:motion` | Track output, moving vessels, painted overlay pixels, animation frame rate, and page errors. Requires populated track-engine data. |

Vitest's Postgres helper (`tests/postgres.ts`) uses `MIRROR_TEST_ADMIN_URL` or
the local server on port 5433. Use a local test server where the suite may create
and drop temporary databases. An unreachable server skips integration tests
locally and fails them when `CI` is set; a local green suite may have less
coverage than GitHub CI. Do not point this admin URL at a production database.

Browser checks need a running app and appropriate data. `verify:fleet` takes
`FLEET_URL` (including `/fleet`); the other scripts take `BASE_URL` (the origin).
When targeting another local port, set both variables for `npm run verify`:

```bash
FLEET_URL=http://localhost:3001/fleet BASE_URL=http://localhost:3001 CHROME_CHANNEL=chrome npm run verify
```

Dashboard, vessel-loading, and motion default to installed Chrome and accept
`CHROME_CHANNEL`. Fleet defaults to bundled Chromium and accepts that override.
Coverage and crossings always use bundled Chromium; install it with
`npx playwright install chromium`. Without an explicit `BASE_URL`, coverage and
crossings can start `next start` from an existing build when port 3000 is idle.
Pass an explicit target to keep the server lifecycle clear.

The local `npm run ci` command does not reproduce the entire GitHub workflow.
GitHub also applies portable schema/migrations twice, verifies schema security
and canary permissions, and builds both production and canary targets. CodeQL
is a separate workflow. Use `.github/workflows/ci.yml` as the executable source
for those checks; use disposable databases for schema verification.

For changes to canary routing or flags, also verify both build modes:

```bash
VERCEL_ENV=production STRAITS_CANARY=0 npm run build
VERCEL_ENV=preview STRAITS_CANARY=1 npm run build
```

Builds share `.next` by default: run them sequentially and serve the intended
final build. Local tests, browser interaction, and deployed behavior are separate
evidence. Record the target, command, outcome, and any fixture/skipped coverage.

## Host discovery

During setup on 2026-10-10, the session exposed shell/file tools, computer-use
tools, and agent collaboration tools with four total session slots. No agent
was spawned. Role defaults remain inherited; exposed model names do not imply
that another host or future session has the same capabilities.

Node.js 22.22.2 and npm 10.9.7 were available. Installed Chrome and newly installed
Playwright Chromium both launched in isolated browser smoke checks. Docker CLI
was installed, but its daemon was not
reachable. No app was listening on port 3000 at discovery. Recheck these
conditions before starting a browser verification run.

The setup baseline passed `npm run ci`: lint, typecheck, 145 passing test files,
998 passing tests, and a production build. Vitest reported one skipped file and
nine todo tests, with non-failing localhost fetch/abort stderr. This was a local
check, not the full GitHub workflow or an app browser verification. Browser
capability probes used an in-memory page, not the Straits application.
