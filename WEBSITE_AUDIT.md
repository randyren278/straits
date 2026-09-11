# Straits website audit

Date: September 11, 2026

**Straits has the right visual foundation for a hidden corner of the internet. What would make it memorable is a stronger sense of discovery: visitors find a contact, uncover its history, and follow something unexpected.**

I inspected the live map at narrow and desktop widths, opened a vessel dossier, tried track history, visited analytics and fleet, and checked the relevant APIs and source. This is a design and functional audit; I haven’t measured Lighthouse/Core Web Vitals or completed a screen-reader audit. No application code changed during the audit.

## What’s already worth preserving

The black-and-amber palette, sharp borders, compact typography, and map-first composition give Straits character. Keep those. The dossier’s sanctions references, aliases, risk breakdown, and anomaly history supply real depth.

Your strongest material is already inside the product. The interface needs to make discovering it more compelling.

## The issues I would fix first

| Priority | Finding | Recommended change |
|---|---|---|
| **Critical** | The live news feed contains seeded headlines attributed to Reuters, Bloomberg, and others, linking to `example.com`. | Exclude demo records from the production feed. Add publication-age filtering and deduplication; relevance currently outranks recency without a date cutoff. |
| **High** | “Less than a minute ago” describes the vessel API response timestamp, rather than the age of the observations. The inspected response included positions spanning September 5–11. | Separate **last refresh**, **last observation**, and **coverage health**. Show an individual contact’s observation age prominently. |
| **High** | Analytics displayed large empty chart frames. The inspected 30-day Hormuz endpoint returned no data. | Explain the missing coverage, identify available dates, and offer a populated region/range when one exists. |
| **High** | ABROS’s track button changed to “HIDE TRACK,” but its 24-hour positions endpoint returned zero records. | Show “No track observations in the last 24 hours.” Distinguish loading, unavailable history, and a successfully displayed track. |
| **Medium** | Red markers represent both sanctions and confirmed going-dark events; purple also has multiple meanings. No map legend was visible. | Separate identity, activity, and freshness through shape, outline, and opacity. Add a compact, expandable legend. |
| **Medium** | Fleet exposes category codes such as `mare.shadow;poi`, while much of the secondary text is small and dim. | Translate categories into readable labels. Increase contrast and reading size for evidence; retain compact typography for metadata. |

The freshness issue is traceable to [the API timestamp](src/app/api/vessels/route.ts) and [the freshness indicator](src/components/ui/DataFreshness.tsx). The news ranking is in [getLatestNews](src/lib/db/news.ts).

These fixes matter aesthetically, too. A convincing intelligence terminal needs trustworthy timestamps, meaningful states, and sources that lead somewhere.

## The creative direction: an independent maritime listening station

Make the site feel maintained by someone with a particular obsession. Its personality can emerge through cartography, terminology, annotations, and the way investigations unfold.

### 1. Give the first screen a reason to investigate

Currently, the opening map presents many contacts with roughly equal visual weight. Add a small **Current watch** section containing three evidence-backed observations:

- A contact with a newly detected event.
- A region with a meaningful traffic change.
- A coverage gap requiring caution.

Each observation should take the visitor directly to its supporting map view and dossier.

You already have a situation-brief endpoint in the source. Bringing that capability into the visible dashboard is a better first investment than adding another disconnected feature.

**Success check:** a new visitor can identify something worth investigating and open its evidence within 20 seconds.

### 2. Make selecting a vessel feel like acquiring a contact

This should become the signature interaction:

- A restrained bracket locks onto the selected vessel.
- Other markers recede slightly.
- Its identifier, observation time, and position appear together.
- Available history draws onto the map.
- The dossier opens with a short explanation of why the contact matters.

Keep the map and dossier visibly synchronized. Currently, the dossier can change while the surrounding marker field remains visually dominant.

Use brief motion tied to actual state changes, with reduced-motion support. Your existing acquisition reveal provides a useful starting point.

### 3. Turn dossiers into investigations

Risk bars explain a score, but a chronological evidence trail tells a story.

Build a timeline combining recorded observations, signal gaps, destination changes, rendezvous events, and sanctions references. Selecting an event should focus the map on the relevant time and location.

Then expose related vessels as navigable connections. The source already contains Known Associates in the fleet detail view; that could become a powerful discovery path.

Keep observed facts, detector conclusions, and uncertainty visibly distinct. Label replay gaps explicitly; historical coverage must support the experience before adding a time scrubber.

### 4. Make the map unmistakably Straits

The surrounding interface has a stronger identity than the basemap. Develop a restrained cartographic language:

- Prioritize waterways, ports, chokepoints, and maritime labels.
- Reduce distracting inland road and city detail at operational zoom levels.
- Use heading indicators only where heading is available and meaningful.
- Fade stale contacts and explain their age on inspection.
- Show monitored coverage so an empty region has context.

During inspection, three chokepoints showed zero vessels while Suez showed 287. The interface should help distinguish “no observed contacts” from “no traffic.”

### 5. Add depth that rewards returning

A hidden place becomes interesting when it seems to continue existing after you leave.

Add:

- **Since your last visit:** newly observed events and changes to watched vessels.
- **Shareable investigation links:** preserve vessel, region, filters, and eventually time.
- **A discoverable command palette:** jump to a vessel, chokepoint, dossier, or methodology.
- **A field manual:** evolve About into an illustrated guide to reading signals, understanding uncertainty, and interpreting the map.

Keep ordinary navigation obvious. Put the mystery in the material visitors uncover.

### 6. Establish a stronger visual hierarchy

Much of the interface uses similar small uppercase labels. Preserve density, but introduce three clear levels: the current subject, its evidence, and supporting metadata.

Reserve amber for navigation and selection; use brighter warning colors sparingly and consistently. Give the selected dossier more room, and let oil prices and general news collapse while someone investigates.

On narrow screens, make the bottom sheet advertise useful content—such as the current watch or selected contact—rather than only aggregate counts.

## Implementation order

1. **Restore trust:** production news, observation timestamps, coverage labels, honest empty states.
2. **Create the signature experience:** Current watch → contact selection → readable dossier.
3. **Deepen exploration:** event timeline, associates, shareable views, return-visit changes.
4. **Finish the atmosphere:** custom cartography, field manual, restrained motion.

**The highest-impact change is the journey from “something unusual is happening here” to “I can follow the evidence myself.”** That would give Straits the sense of a place people have stumbled into—and a reason to stay.

---

## Implementation status (September 11, 2026)

Built in this pass, mapped to the sections above. Verified by `npm run ci`, the responsive layout and loading smoke suites, and browser journeys against both a fresh isolated TimescaleDB dataset and the original stale local dataset.

**Fix-first findings**

| Finding | Status | Where |
|---|---|---|
| Seeded headlines in the live feed | Done — `example.com` records excluded, 72h publication cutoff, title dedupe | `src/lib/db/news.ts` |
| "Less than a minute ago" was the response time | Done — `latestObservation` in `/api/vessels`; header shows **Latest fix** and **Refreshed** separately; mobile chip shows fix age; each contact shows its own **Observed** age with a stale note | `src/app/api/vessels/route.ts`, `DataFreshness.tsx`, `StatusChip.tsx`, `VesselPanel.tsx` |
| Empty analytics frames | Done — correlation API returns zone coverage; empty state explains the gap, names observed days, offers a populated range or filter | `src/lib/db/analytics.ts`, `TrafficChart.tsx`, `analytics/page.tsx` |
| "HIDE TRACK" with zero fixes | Done — track load reports loading / empty / error / drawn (with fix count) | `src/stores/vessel.ts`, `VesselMap.tsx`, `VesselPanel.tsx` |
| Red and purple with two meanings; no legend | Done — fill = activity, outline = identity, opacity = fix age; expandable legend driven by the same constants | `src/lib/map/marker-style.ts`, `MapLegend.tsx` |
| Raw category codes, dim evidence text | Done — readable labels with meanings; evidence lines lifted a step in contrast | `src/lib/sanctions/labels.ts`, `SanctionedVessels.tsx`, `FleetVesselDetail.tsx` |

**Creative direction**

1. **Current watch** — `/api/watch` composes a contact event, a region traffic change (24h vs 24h, SPC z when available) and a coverage gap; panel at the top of the rail and on the mobile peek strip; each item opens its map view and dossier. `src/lib/watch/`, `CurrentWatchPanel.tsx`.
2. **Contact acquisition** — amber ring on the selected marker, the rest of the field recedes, dossier header carries name / observed age / position, a one-line *why it matters*, and a brief acquisition sweep (reduced-motion aware).
3. **Dossiers as investigations** — chronological **Evidence trail** (observed / detector / reference kept visibly distinct; events with positions focus the map); **Known associates** are navigable.
4. **Cartography** — inland roads, buildings and POIs hidden; monitored-coverage outline; stale contacts fade; heading chevrons only when heading is valid and the vessel is under way.
5. **Depth** — *Since your last visit* line; shareable investigation links (`?vessel=&cp=&lat=&lon=&z=&tankers=&anomalies=`) with a copy-link button; ⌘K command palette; About page rebuilt as a **Field manual** with *Reading the map*.
6. **Hierarchy** — selected contact leads the rail, news folds while investigating, dossier split into contact / evidence / metadata levels.

**Not done**: a time scrubber (historical coverage does not yet support it), Lighthouse / screen-reader audit.
