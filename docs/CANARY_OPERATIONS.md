# Canary operations

The test site is https://canary.straits.randyren.org. Pushes to `canary` create Vercel Preview deployments and update that branch domain. `master` remains the production branch. Do not use `vercel --prod` to publish a canary revision.

## Isolation and setup

Canary shares the observation database and compute, but authenticates as `straits_canary`. Its role has read access to an explicit observation-table allowlist and writes only to the `canary` schema. Production watchlists and alert state are not exposed to this role. This is write isolation, not a separate database or performance sandbox.

Branch-specific Vercel Preview variables are `DATABASE_URL` and `STRAITS_CANARY=1`. The build derives the public UI flag; `VERCEL_ENV=production` always disables experimental routes. The canary hostname is public for testing, while other preview hostnames retain deployment protection. Canary pages send noindex directives.

Local runtime credentials are in the ignored, owner-readable `.env.canary.local`. Never commit or print that file. Database-owner provisioning is handled by `scripts/setup-canary-db.mjs` (dry-run by default; `--apply` applies). Stories use `scripts/canary-stories.sql`. Verify runtime permissions with:

```sh
node --env-file=.env.canary.local scripts/verify-canary-db.mjs
```

The permission checks use rollback-only writes. Story rows permit INSERT and SELECT, but deny UPDATE and DELETE to the application role. Story creation accepts only question parameters and an optional annotation; the server builds the evidence. Storage is capped at 1,000 stories, each at most 128 KiB.

## Acceptance before promotion

Run `npm run check`, `npm run build`, and `npm audit --omit=dev --audit-level=high`. CI additionally applies portable schemas and migrations, builds with both preview-canary and production-gate settings, and runs CodeQL. Confirm the deployed revision is READY and exercise the real site with computer use:

1. Check supported and unsupported questions; inspect sources, dates, cohorts, and map links.
2. Change speed and closure delay in Parallel Seas; verify visible route highlighting and changed calculations.
3. Change coverage region, select a vessel, and inspect the regional collection overlapping its gap.
4. Follow a question, revisit Following, refresh it, and unfollow it.
5. Create an annotated story, reopen its URL, navigate all four steps, and inspect its embed.
6. Repeat key navigation at a compact viewport and check Safari as well as Chrome.

Earlier attempts to build patched Next.js 16.3.6 stalled while loading its native SWC module on this Mac. The final local canary build completed successfully, as did Linux Vercel and both CI build configurations.

## Interpretation boundaries

- Claims come from a bounded supported catalog. AIS contacts are not completed passages; missing days do not become zero traffic. The 40% reduction threshold is a transparent product rule, not a calibrated statistical test.
- Parallel Seas uses fixed illustrative Mumbai–Rotterdam waypoints and constant speed. It is an editable scenario, not a route planner, closure forecast, or freight-price model.
- Coverage shows the last 48 hours and up to 100 most recently observed regional MMSIs. Gaps do not prove evasion; counts across feeds can overlap.
- Follows live only in this browser and are checked when Following opens or refreshes. There is no background email/push notification service.
- Stories freeze server-generated evidence. Their map links open current map context rather than historical replay.
- PortWatch is a delayed AIS-derived aggregate. Marine context is modeled forecast data. Source access and licensing details are in [FREE_DATA_SOURCES.md](FREE_DATA_SOURCES.md); the free marine API is noncommercial.

## Rollback and production

Revert a defective canary commit on the `canary` branch and push, or reassign only the canary branch domain to a known-good Preview deployment. Preserve stored snapshots during rollback. Do not rotate or reuse production credentials to repair canary access.

Production promotion is a separate decision. Review the complete diff, provision the intended production schema and access model, resolve the public write/abuse model and commercial source licensing, and explicitly decide which experimental features should ship before merging to `master`.
