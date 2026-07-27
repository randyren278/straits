# Fleet Page — Tabs, Row Cap, Sort

**Date:** 2026-07-27
**Route:** `/fleet` — `src/app/(protected)/fleet/page.tsx`
**Status:** Design approved, ready for implementation planning

---

## Problem

The fleet page requires an unreasonable amount of scrolling, and its navigation is
invisible. Measured on the live site (straits.randyren.org/fleet) via Playwright —
not estimated:

| Measurement | Desktop 1440×900 | Mobile 390×844 |
|---|---|---|
| Page height, all sections collapsed | 2952px = **3.3 screens** | 6613px = **7.8 screens** |
| Y-position of first anomaly section header | **2455px** | **6128px** |
| Page height with one section open (Loitering, 308 rows) | 15613px = **17.3 screens** | 30378px = **36 screens** |
| Horizontal overflow | 0 | 0 |

Live data at time of measurement: 921 active anomalies across 7 categories, plus 60
sanctioned vessels. Category counts: Loitering 308, Speed Anomaly 225, Going Dark 198,
STS Transfer 93, Route Deviation 80, Spoofed Position 13, Repeat Going Dark 4.

Three distinct defects:

1. **`SanctionedVessels` is a 60-row block with no collapse**, hard-mounted above the
   accordions. It occupies 2253px and cannot be dismissed.
2. **The 7 accordion headers are the page's only navigation, and they sit at y=2455+** —
   below the fold on every device. The page's contents are undiscoverable without
   scrolling nearly three screens.
3. **No row cap.** All rows for an open category render at once. One open section is
   17.3 screens on desktop, 36 on mobile.

Horizontal overflow is clean at both widths and is not part of this work.

---

## Solution

Replace the accordion with a tab interface, cap rendered rows per tab, and make
columns sortable.

### Scope decisions

| Decision | Choice | Rationale |
|---|---|---|
| Layout | Tabs + row cap + sort | Tabs alone relocate the scrolling rather than remove it — the Loitering tab would still be ~14 screens |
| Mobile tab layout | Wrapped 2-column grid | All 8 tabs visible with no swipe and no tap-to-reveal |
| Sort surface | Clickable headers (desktop) + sort bar (mobile) | The Sanctioned tab renders a card list on mobile with no headers to click |
| Search / filter box | **Excluded** | Not requested |
| Tab/sort/page in URL | **Excluded** | `useSearchParams` appears nowhere in `src/`; adding it plus a Suspense boundary buys shareability that was not requested |
| Server-side pagination | **Excluded** | `/api/anomalies` already returns all rows in one payload; paging is pure client-side work |

### Rejected mobile alternatives

- **Horizontal scroll strip** (44px, cheapest): only ~3 of 8 tabs visible; the rest hide
  behind a swipe. This reproduces defect #2 in miniature — "Repeat Going Dark" (4 rows)
  would effectively disappear again.
- **Dropdown selector** (56px): all 8 reachable in one tap, but the closed state shows a
  single category, losing the at-a-glance read of the whole fleet, and it stops matching
  the desktop tab metaphor.

The wrapped grid costs ~148px of vertical space but **replaces the existing mobile
summary strip** (`page.tsx:124-130`), which already renders these exact counts in a
wrapped block below the title. Net added height is roughly 40px, and one redundant
element is removed.

---

## Component architecture

| Component | Status | Responsibility |
|---|---|---|
| `FleetTabs` | new | Tab strip. Desktop horizontal row, mobile 2-col grid. Props: `tabs[]`, `activeId`, `onChange`. Holds no domain data. |
| `useTableView` | new | Hook owning `{sortKey, sortDir, page}`. Takes rows, returns the sorted+sliced page plus total count. |
| `TablePager` | new | `‹ Prev · Showing 1–25 of 308 · Next ›` |
| `AnomalyTable` | modified | Accordion removed. Gains sortable headers + pager. Keeps row→dossier expansion. |
| `SanctionedVessels` | modified | No longer always-mounted; becomes tab content. Gains sort + pager. Keeps its own columns and red accent. |
| `page.tsx` | modified | Owns `activeTab`; renders exactly one panel. |

`FleetTabs` deliberately knows nothing about anomalies — it can be understood and tested
as "given labels and counts, render a strip and report clicks."

`useTableView` has two consumers (`AnomalyTable` and `SanctionedVessels`), which is what
justifies extracting it rather than inlining the state twice.

### Removed code

`AnomalyTable`'s section-header `<button>`, its `expanded` state, and the
`ChevronDown`/`ChevronRight` imports are deleted. Tabs and accordions are redundant;
keeping both would require two clicks to reach any data. The `expandedImo` state that
drives the per-row dossier is retained.

The mobile summary strip in `page.tsx:124-130` is deleted, superseded by the tab grid.

---

## Data flow

Unchanged through the grouping step:

```
fetch /api/anomalies  →  921 anomalies
   ├── groupByType()                          → 7 groups, count desc  → 7 tabs
   └── filter(isSanctioned) + dedupe by IMO   → 60 vessels            → 1 tab (first)
                              ↓
         activeTab → useTableView(rows) → sort → slice(page × 25) → render ≤25 rows
```

Tabs are derived from the data. A category with zero anomalies produces no tab. The
Sanctioned tab is absent when the list is empty, preserving the current `return null`
behaviour.

Page size: **25 rows**, uniform across tabs and breakpoints.

Default active tab: **Sanctioned** when non-empty, otherwise the largest category.

### Page-size trade-off

25 rows behaves differently across the two row shapes, because `SanctionedVessels`
renders a *card list* on mobile (~95px per vessel, measured) while `AnomalyTable` renders
a real table (~46px per row):

| Tab at 390×844 | Height at 25 rows | Screens |
|---|---|---|
| Anomaly tabs (table rows) | ~1590px | ~1.9 |
| Sanctioned tab (cards) | ~2815px | ~3.3 |

The Sanctioned tab is therefore the tall case on mobile at ~3.3 screens — still a 2.4×
improvement on today's 7.8, but not the ~1 screen the other tabs achieve. Dropping to 15
rows would bring every tab under 2.2 screens at the cost of 21 pages instead of 13 for
the Loitering tab. **Resolved: 25 rows**, accepting the taller Sanctioned tab, because a
single page-size constant is simpler than a breakpoint-dependent one and 13 pages beats
21. The mobile verification threshold below is set to match this reality rather than an
aspiration.

---

## Sort semantics

Sortable columns: **Vessel Name, Risk Score, Detected**.

Excluded: **Flag** (renders `—` for all 921 rows — sorting it would do nothing visible),
**IMO** (hull number is not an intelligence question), **Confidence** (badge with weak
ordering).

The Sanctioned tab has no Detected column, so it sorts on Vessel Name and Risk Score only.

- Default: **Risk Score descending** — highest-risk vessels on page 1.
- **Nulls sort last in both directions.** A missing risk score means *unknown*, not
  *safe*; it must never head the descending list nor the ascending one. This rule applies
  to null risk scores and to missing vessel names.
- Vessel Name uses `localeCompare`.
- Detected compares timestamps.
- Desktop: clickable `<th>` carrying `aria-sort` plus a ↕ / ▲ / ▼ indicator.
- Mobile: a compact `Sort: Risk ▼` control above the table, driving the same state.

---

## State transitions

| Action | Effect |
|---|---|
| Change tab | page → 1; sort → default; open dossier closes |
| Change sort column or direction | page → 1; open dossier closes |
| Change page | open dossier closes |
| Refetch shrinks the active tab below current page | page clamps to last valid page |

Closing the dossier on every transition is deliberate: an expanded row that survives a
page change points at a vessel no longer in view.

---

## Preserved behaviour

Loading, error, and empty states are unchanged. The CSV and JSON export links are
unchanged. The `ErrorBoundary` wrapper is retained. The per-vessel `FleetVesselDetail`
dossier is unchanged. Bloomberg aesthetic throughout: true black, amber accents,
JetBrains Mono, sharp corners, red accent reserved for the Sanctioned tab.

---

## Accessibility

- `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected` and
  `aria-controls`.
- Roving tabindex; ←/→ arrow keys move between tabs.
- Mobile tab rows are 44px tall, matching the touch-target standard already applied to
  the export buttons on this page.
- Sortable headers expose `aria-sort` (`ascending` / `descending` / `none`).

---

## Verification

Two stages, run against a local dev server at `:3000/fleet`. Screenshot review alone is
insufficient — a prior audit of this project missed four user-visible defects precisely
because screenshots cannot show content below the fold or state that only exists after
interaction. Findings must be numbers.

### Stage 1 — measurement script

Playwright script asserting hard values. Any failure blocks completion:

- On **every tab** at 1440×900: page height ≤ 1.5 viewports
- On **every tab** at 390×844: page height ≤ 2.2 viewports, except the Sanctioned tab
  (card list) which must be ≤ 3.5 viewports — see the page-size trade-off above
- `document.documentElement.scrollWidth - window.innerWidth === 0` at both widths
- Rendered `<tbody>` rows ≤ 25 on every tab
- Every mobile tab button ≥ 44px tall
- Exactly one element with `aria-selected="true"`
- **Sort demonstrably reorders**: capture first-row risk under ▼, click to ▲, assert the
  value changed and the ordering inverted
- Rows with a null risk score appear last under both sort directions
- Clicking a row still opens the `FleetVesselDetail` dossier
- Paging forward changes the rendered row set and updates the `Showing X–Y of Z` label

### Stage 2 — review council

Three reviewer agents, each independently driving Playwright against the running page,
with separate briefs so they examine different surfaces rather than converging:

1. **Layout** — scroll cost, overflow, fold position, every tab at both widths
2. **Interaction** — tab / sort / page / dossier correctness against the state-transition
   table above
3. **Accessibility** — roles, keyboard navigation, touch targets, focus handling

Each finding must carry a reproducible assertion with a measured number. Findings
reported as impressions, without a measurement, are discarded.

---

## Out of scope

- **The Flag column renders `—` for all 921 rows.** This is a data/enrichment gap, not a
  layout one. Flagged, not fixed here.
- Search / filter within a tab.
- Shareable URLs for tab, sort, and page state.
- Server-side pagination or any change to `/api/anomalies`.
