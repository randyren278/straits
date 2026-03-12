---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | vitest.config.ts — Wave 0 installs |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| DATA-01 | AIS WebSocket ingestion parses messages | unit | `npm run test -- src/lib/ais/parser.test.ts` | ❌ W0 | ⬜ pending |
| DATA-02 | Position inserted to database | integration | `npm run test -- src/lib/db/positions.test.ts` | ❌ W0 | ⬜ pending |
| DATA-03 | IMO extracted from ShipStaticData | unit | `npm run test -- src/lib/ais/parser.test.ts` | ❌ W0 | ⬜ pending |
| DATA-04 | Invalid positions filtered (speed >50kt) | unit | `npm run test -- src/lib/ais/filter.test.ts` | ❌ W0 | ⬜ pending |
| AUTH-01 | Password verification works | unit | `npm run test -- src/lib/auth.test.ts` | ❌ W0 | ⬜ pending |
| MAP-01 | GeoJSON generated from vessel data | unit | `npm run test -- src/lib/map/geojson.test.ts` | ❌ W0 | ⬜ pending |
| MAP-02 | Vessel click returns correct properties | e2e | Manual — Playwright later | ❌ manual | ⬜ pending |
| MAP-03 | Filter excludes non-tankers | unit | `npm run test -- src/lib/map/filter.test.ts` | ❌ W0 | ⬜ pending |
| MAP-04 | Track history returns LineString | unit | `npm run test -- src/lib/map/tracks.test.ts` | ❌ W0 | ⬜ pending |
| MAP-05 | Data freshness calculated correctly | unit | `npm run test -- src/components/freshness.test.ts` | ❌ W0 | ⬜ pending |
| MAP-08 | Mobile layout renders correctly | e2e | Manual — viewport test | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest configuration
- [ ] `tests/setup.ts` — Test environment setup (mocks, database)
- [ ] `src/lib/ais/parser.test.ts` — AIS message parsing tests
- [ ] `src/lib/ais/filter.test.ts` — GPS data quality filter tests
- [ ] `src/lib/auth.test.ts` — Auth utility tests
- [ ] `src/lib/db/positions.test.ts` — Database integration tests
- [ ] `src/lib/map/geojson.test.ts` — GeoJSON generation tests
- [ ] `src/lib/map/filter.test.ts` — Vessel type filter tests
- [ ] `src/lib/map/tracks.test.ts` — Track history tests
- [ ] `src/components/freshness.test.ts` — Data freshness tests
- [ ] Framework install: `npm install -D vitest @testing-library/react happy-dom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Map click shows vessel panel | MAP-02 | WebGL interaction hard to automate | Click vessel, verify panel shows name/IMO/speed |
| Mobile layout works | MAP-08 | Visual layout verification | Resize to 375px width, verify bottom sheet pattern |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
