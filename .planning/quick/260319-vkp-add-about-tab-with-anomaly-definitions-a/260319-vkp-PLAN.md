---
phase: quick
plan: 260319-vkp
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(protected)/about/page.tsx
  - src/components/ui/Header.tsx
  - README.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "About tab appears in header navigation alongside Live Map and Analytics"
    - "Clicking About navigates to /about and shows anomaly definitions"
    - "All 6 anomaly types are documented with detection thresholds"
    - "Dark fleet risk score formula is documented with all 5 factors and weights"
    - "README reflects v1.3 features and mentions the About tab"
  artifacts:
    - path: "src/app/(protected)/about/page.tsx"
      provides: "About page with anomaly and risk score documentation"
      min_lines: 100
    - path: "src/components/ui/Header.tsx"
      provides: "Three-tab navigation (Live Map, Analytics, About)"
    - path: "README.md"
      provides: "Updated documentation with v1.3 features"
  key_links:
    - from: "src/components/ui/Header.tsx"
      to: "/about"
      via: "Link component href"
      pattern: "href.*about"
---

<objective>
Add an "About" third tab to the dashboard that documents all anomaly event definitions and the dark fleet risk score formula. Update README with v1.3 features.

Purpose: Users (friends) can understand what the anomaly badges mean and how risk scores are calculated without asking.
Output: New About page, updated Header nav, updated README.
</objective>

<execution_context>
@/Users/randyren/.claude/get-shit-done/workflows/execute-plan.md
@/Users/randyren/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/ui/Header.tsx
@src/types/anomaly.ts
@src/lib/detection/risk-score.ts
@src/app/(protected)/analytics/page.tsx
@README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create About page and add nav tab</name>
  <files>src/app/(protected)/about/page.tsx, src/components/ui/Header.tsx</files>
  <action>
**Header.tsx changes:**

Update the nav detection logic. Currently uses `const isAnalytics = pathname === '/analytics'`. Change to detect the active tab from pathname:

```typescript
const pathname = usePathname();
const activeTab = pathname === '/analytics' ? 'analytics' : pathname === '/about' ? 'about' : 'dashboard';
```

Add a third Link for "About" after the Analytics link. Use the same styling pattern:
- Active: `border-amber-500 text-amber-500 bg-amber-500/10`
- Inactive: `border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700`

Update the chokepoint widgets conditional: currently `{!isAnalytics && (`. Change to `{activeTab === 'dashboard' && (` so chokepoint widgets only show on the Live Map tab (not on About either).

**About page (src/app/(protected)/about/page.tsx):**

Create a new page following the exact same structure as the analytics page. It is a 'use client' component that renders `<Header />` with no props, then a `<main>` content area.

Page layout: `min-h-screen bg-black text-white`, main uses `p-6 max-w-4xl mx-auto`.

Page title: same pattern as analytics — `text-sm font-mono uppercase tracking-widest text-amber-500` with text "About Tanker Tracker", subtitle "Anomaly detection definitions and risk scoring methodology".

Content sections use terminal panel styling:
- Section container: `bg-gray-900 border border-amber-500/20 mb-6`
- Section header: `px-3 py-1.5 border-b border-amber-500/20` with `text-xs font-mono uppercase tracking-wider text-amber-500` label
- Section body: `p-4`

**Section 1: "Anomaly Events"**

Render a definition list for each of the 6 anomaly types. For each type, show:
- Type name in amber-500 font-mono (e.g., "GOING DARK")
- Description paragraph in text-gray-300 text-sm
- Detection thresholds in text-gray-500 text-xs font-mono

Content for each type:

1. **GOING DARK** (`going_dark`) — Vessel stops broadcasting AIS signal while in a known coverage zone. Normal gaps in open ocean are excluded. Thresholds: Suspected: 2-4 hour gap. Confirmed: >4 hour gap.

2. **LOITERING** (`loitering`) — Vessel moving below 3 knots outside a known anchorage area, remaining within a 5 nautical mile radius for an extended period. Indicates possible at-sea waiting for clandestine transfer.

3. **SPEED ANOMALY** (`speed`) — Vessel speed drops below 3 knots outside port or anchorage areas. May indicate drifting, disabled vessel, or intentional speed reduction to avoid detection.

4. **ROUTE DEVIATION** (`deviation`) — Vessel heading contradicts its declared AIS destination. Detected by geocoding the declared destination via Nominatim and comparing actual heading to expected bearing. A deviation is confirmed when ALL positions over a 2-hour window show inconsistent heading.

5. **REPEAT GOING DARK** (`repeat_going_dark`) — Vessel has gone dark 3 or more times within a rolling 30-day window. Pattern strongly indicates deliberate AIS manipulation rather than equipment failure.

6. **STS TRANSFER** (`sts_transfer`) — Two vessels detected within 0.5 nautical miles of each other for 30+ consecutive minutes. Ship-to-ship transfers at sea are a primary method for sanctions evasion and oil laundering.

**Section 2: "Dark Fleet Risk Score"**

Explain the composite risk score (0-100) that aggregates evasion signals per vessel.

Show each factor as a row in a simple table or grid:
- Going Dark History: 8 pts per event, capped at 40 pts (5 events max contribution)
- Sanctions Match: 25 pts (binary — vessel appears in OpenSanctions database)
- Flag State Risk: 15 pts if registered under high-risk flag. List flags: Iran (IR), Russia (RU), Venezuela (VE), North Korea (KP), Panama (PA), Cameroon (CM), Comoros (KM)
- Loitering History: 10 pts (binary — any loitering event in past 90 days)
- STS Transfer History: 10 pts (binary — any STS transfer event on record)
- Total Maximum: 100 pts

Use a simple table with `font-mono text-sm` for the factor rows. Table styling: `w-full` with `border-collapse`, rows use `border-b border-amber-500/10`, cells use `py-2 px-3`.

**Section 3: "Data Sources"**

Brief section listing:
- AIS positions: aisstream.io (WebSocket, near real-time)
- Sanctions data: OpenSanctions (daily refresh)
- Oil prices: Alpha Vantage (primary) + FRED (fallback)
- News: NewsAPI (keyword-filtered)
- Geocoding: Nominatim (OpenStreetMap)

Use same terminal panel styling. Each source as a simple `text-sm text-gray-300` line with the source name in `text-amber-500`.
  </action>
  <verify>
    <automated>cd /Users/randyren/Developer/tanker-tracker && npx next build 2>&1 | tail -20</automated>
  </verify>
  <done>About tab appears in header navigation. Clicking it navigates to /about and renders all 6 anomaly definitions, risk score formula with exact weights, and data sources. Build succeeds with no errors.</done>
</task>

<task type="auto">
  <name>Task 2: Update README with v1.3 features</name>
  <files>README.md</files>
  <action>
Update the existing README.md with v1.3 features. Do NOT rewrite the whole file.

**1. Update the Features list** — add these bullet points after the existing list:
- Route deviation detection via destination geocoding
- Behavioral pattern detection: repeat going-dark, destination changes, ship-to-ship transfers
- Dark fleet risk scoring (0-100 composite score per vessel)
- Vessel intelligence dossier panel with risk breakdown and anomaly history
- About page documenting all anomaly definitions and scoring methodology

**2. Add a section "## Anomaly Detection"** after the Features section and before Prerequisites. Brief paragraph:

"Tanker Tracker monitors 6 types of vessel anomalies: AIS signal loss (going dark), loitering outside anchorage, speed anomalies, route deviation from declared destination, repeat going-dark patterns, and ship-to-ship transfers. Each vessel receives a composite dark fleet risk score (0-100) based on its evasion signal history. See the About tab in the dashboard for full definitions and scoring methodology."
  </action>
  <verify>
    <automated>grep -c "Anomaly Detection\|dark fleet risk\|About tab\|route deviation" /Users/randyren/Developer/tanker-tracker/README.md</automated>
  </verify>
  <done>README has updated feature list reflecting v1.3 capabilities. New "Anomaly Detection" section provides overview and points users to the About tab. grep returns 4+ matches.</done>
</task>

</tasks>

<verification>
- `npx next build` succeeds
- Header shows 3 tabs: Live Map, Analytics, About
- /about page renders anomaly definitions and risk score table
- README contains v1.3 feature documentation
</verification>

<success_criteria>
- About page accessible at /about with all 6 anomaly type definitions and exact thresholds
- Risk score formula documented with all 5 factors, weights, and max score of 100
- Header navigation shows 3 tabs with correct active state highlighting
- Chokepoint widgets hidden on About page (only show on Live Map)
- README updated with v1.3 features and anomaly detection section
- Build passes cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/260319-vkp-add-about-tab-with-anomaly-definitions-a/260319-vkp-SUMMARY.md`
</output>
