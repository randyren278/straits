# AIS Fallback: scoping a second data source

AISStream.io has been dark since 2026-08-05 — 122 consecutive empty harvest
windows as of 2026-08-16, `vessel_positions` pruned itself to zero rows. This
document scopes what a second source would actually cost and take, so the
next outage doesn't repeat this one.

**Bottom line up front:** there is no free, wide-area, real-time source with
usable Middle East coverage that matches AISStream's architecture (a keyless
bounding-box websocket firehose). The two products that are architecturally
comparable — VesselFinder's LIVEDATA subscription and MarineTraffic/Spire
enterprise access — are both quote-only and, based on published comparable
pricing, land somewhere between low-hundreds and low-thousands of USD/month.
**If you want a guaranteed always-on second live source, this becomes a paid
line item.** What follows is a plan that fixes today's problem for $0 first
(dark map → stale-but-present map), then lays out the real paid options if
you decide near-real-time redundancy is worth buying.

---

## Why AISStream has no free peer

Two structurally different ways to get live AIS exist, and neither has a
free version that covers the Gulf/Red Sea/Suez from where this project runs:

1. **Terrestrial ground-station networks** (AISHub, MarineTraffic's community
   layer, AISStream itself). Coverage is wherever someone has a VHF receiver
   with line of sight to the water — [effective range is ~20–40 nautical
   miles from an antenna, up to ~80nm with height](https://help.marinetraffic.com/hc/en-us/articles/203990918--What-is-the-typical-range-of-the-AIS-),
   and it decays past the horizon. A receiver in North America cannot hear
   Persian Gulf traffic; coverage of the Gulf depends entirely on *someone
   else* running a station there.
2. **Satellite AIS** (Spire, exactEarth-now-Spire, VesselFinder's satellite
   tier). LEO satellites hear any vessel globally regardless of where you
   sit, which is exactly why it's the enterprise-priced tier — it's the only
   technology that doesn't depend on local ground infrastructure.

AISStream sits in bucket 1, is free, and its only real weakness is that
free-BETA-no-SLA is now a documented pattern, not a one-off: three TLS cert
lapses (2026-05-20, 06-23, 07-19) plus an open "connects, subscribes, zero
data delivered" bug, [aisstream/aisstream#15](https://github.com/aisstream/aisstream/issues/15),
filed 2026-03-13. There is also **no paid tier to upgrade to** — [confirmed
via their own docs and GitHub](https://aisstream.io/documentation) — so
"pay AISStream for reliability" isn't an option with the current vendor.
That's the actual argument for a second, structurally independent source
rather than a support ticket.

---

## Options evaluated

Coverage target: the 6 bounding boxes in `harvest-once.ts:100-107` (Persian
Gulf, Gulf of Oman/Arabian Sea approaches, Arabian Sea transit corridor, Red
Sea, Gulf of Aden, Suez + Eastern Med). Volume estimate used below: the
harvester currently lands **~25–300 positions per 90s window**, 144
windows/day → roughly **108K–1.3M positions/month** at full 6-box coverage
([HARVESTER.md](HARVESTER.md), "Data volume & retention").

| Provider | Access model | Free tier | Cost at this project's volume | Geographic fit | Licensing for a shared dashboard | Reliability signal |
|---|---|---|---|---|---|---|
| **AISHub** | Reciprocal community network, JSON/XML/CSV poll (≥1 min interval) | Free, **but only after you operate your own AIS station** ≥10 vessels avg / ≥90% uptime over 7 days ([join-us](https://www.aishub.net/join-us), [API docs](https://www.aishub.net/api)) | $0 ongoing + ~$30–100 one-time for an RTL-SDR receiver+antenna, **if** it qualifies | Unverified — Gulf/Red Sea/Suez station density couldn't be confirmed (coverage map is JS-rendered, not fetchable here); 1,605 stations / 83 countries total, no regional breakdown found | **Personal / non-commercial only**, no redistribution or resale ([ToS summary](https://www.aishub.net/)) — a private friends-only dashboard is plausibly fine, monetizing it later would not be | A similar hosted-service project (koala73/worldmonitor) [independently ruled AISHub out](https://github.com/koala73/worldmonitor/issues/6227) for exactly this reason: no receiver, no membership path, at any price |
| **MarineTraffic API** (Kpler) | REST, enterprise sales only | None published — credit pricing was discontinued | Contact sales; no self-serve tier exists | Global (satellite+terrestrial), but irrelevant if ToS blocks the use case | **Explicitly forbids redistribution/display outside your own organization** in the standard terms — a hard blocker independent of price | Backed by Kpler; also now owns Spire and FleetMon |
| **VesselFinder — credit API** | REST, per-position metered | Trial credits on request, no standing free tier | Terrestrial: 1 credit/position, ~€330/10k credits (~€0.033/position) → **~€3,600–€43,000/month** at this project's volume; satellite is 10 credits/position, 10x that | Terrestrial-only unless you pay for satellite | Not established (not documented in what's public) | No SLA published |
| **VesselFinder — LIVEDATA** | Subscription for **all vessels in a bounding box**, fixed monthly fee ([docs](https://api.vesselfinder.com/docs/livedata.html)) | None; quote-only, priced by area size / traffic density / datasets | **Unverified — requires a sales quote** | Architecturally the closest match to AISStream (bounding-box firehose, not per-vessel metering) | Not established | No SLA published |
| **Spire Maritime** (Kpler) | Satellite AIS, enterprise | None | Reported **>$10K/month** for enterprise access ([comparison source](https://www.usesentinel.io/blog/ais-data-providers-comparison)) | Global | Not established | Enterprise-grade infra, but same corporate family as MarineTraffic post-acquisition |
| **Datalastic** | REST, self-service, per-vessel-returned metering | 14-day **paid** trial from €9 (not free) | Starter €199/mo = 20k credits, up to €679/mo unlimited ([pricing](https://datalastic.com/pricing/)) | The area endpoint is capped at **~10nm radius around a point** ([marine-location-traffic-api](https://datalastic.com/marine-location-traffic-api/)) — built for port monitoring, not regional streaming; covering 6 wide boxes would need many overlapping polls, each metered per vessel | Not established | Self-service, API key in minutes |
| **Data Docked** | REST, per-vessel-returned metering, positions itself as a cheaper MarineTraffic alternative | 20–100 free credits (inconsistent across their own pages — unverified) | From €80/mo ([pricing](https://datadocked.com/pricing)) | Same per-vessel-metering shape as Datalastic; wide-area cost not confirmed, exact credits-per-tier not published | Not established | Newer entrant, resells combined satellite+terrestrial |
| **Global Fishing Watch** | REST, free self-registration | **Genuinely free for non-commercial use**, no card required ([FAQ](https://globalfishingwatch.org/faqs/can-i-use-global-fishing-watch-apis-for-commercial-purposes/)) | $0 | All vessel types via the [Global AIS Vessel Presence dataset](https://globalfishingwatch.org/platform-update/global-ais-vessel-presence-dataset/) — global, no regional gate | Non-commercial use is explicitly permitted — fits a friends-only dashboard | Backed by a stable NGO/Google-funded org, but **temporal resolution is one AIS position per vessel per hour** — a real fidelity cut, not a like-for-like swap. Latency beyond that hourly bucket is UNVERIFIED. |
| **Norwegian Coastal Administration / BarentsWatch** | REST/live feed, free, keyless-ish (registration only) | Free | $0 | **Norway + Svalbard only** ([Kystverket](https://www.kystverket.no/en/sea-transport-and-ports/ais/access-to-ais-data/)) | N/A | N/A — ruled out on coverage alone |
| **Digitraffic (Finland)** | MQTT/WebSocket, free, keyless | Free | $0 | **Baltic Sea / Gulf of Finland only** ([digitraffic.fi](https://www.digitraffic.fi/en/marine-traffic/)) | N/A | N/A — ruled out on coverage alone |
| **Self-hosted local AIS receiver** | N/A | N/A | ~$30–100 hardware | **Not relevant.** VHF AIS is line-of-sight, ~20–40nm. A receiver on a Mac in North America cannot hear Gulf/Red Sea/Suez traffic under any circumstance. Its only theoretical value is as the "membership fee" to unlock AISHub's aggregated feed (see above), not as a direct source. | — | — |

Every government open-AIS feed found (Norway, Finland) follows the same
pattern: real, free, keyless, and hard-limited to the publishing country's
own waters. No Gulf state (Iran, Saudi Arabia, UAE, Oman, Yemen, Egypt)
publishes an open AIS feed — this appears to be a structural gap, not
something a different search query would find.

---

## Recommendation

**Do not wait for a single "replacement" decision — split this into a $0
resilience step you can ship today and a paid-source decision that needs the
user's sign-off on a real number.**

### First choice: ship the provider abstraction now, with Global Fishing Watch as the $0 fallback

- Turns "dark map, 0 rows" into "stale-but-present map" the next time
  AISStream goes dark, at zero cost and no new account approval wait.
- Honest downside: hourly-resolution data will misfire the going-dark,
  loitering, and speed-anomaly detectors if fed to them unchanged (a routine
  10-minute gap now looks identical to "vessel went dark"). This has to be
  handled explicitly (see Integration design) — it is not free of engineering
  cost, just free of dollar cost.
- This is a genuine downgrade, not a hidden win: hourly pings will not
  support anomaly detection at the resolution the rest of the product is
  built for. It buys "the map isn't empty" — nothing more — until either
  AISStream recovers or a paid source is funded.

### Runner-up (if the user decides to pay): VesselFinder LIVEDATA quote

- It's the only product surveyed whose access model — all vessels in a
  bounding box, fixed monthly fee — actually matches what `harvest-once.ts`
  already does. Everything else surveyed is a per-vessel-metered API built
  for point/port lookups, which is the wrong shape for 6 wide regional boxes
  and gets expensive fast (see the Datalastic/Data Docked cost math above).
- Honest downside: price is unpublished and requires a sales conversation;
  no evidence of an SLA either. Get the actual quote before committing —
  don't assume it lands in the "hobby project" range just because AISStream
  was free.

### Worth a cheap, parallel experiment: AISHub

- Zero ongoing cost, and if it works it's the only option that's both free
  and structurally identical to AISStream (bounding-box-ish aggregated
  feed). But it's gated behind two unverified things: (1) whether AISHub
  already has real Gulf/Red Sea/Suez contributor stations — **check
  https://www.aishub.net/coverage manually before buying any hardware**,
  the map didn't render through automated fetch here; (2) a 7-day
  qualification window (≥10 vessels avg, ≥90% uptime) after setting up a
  receiver, before API access is even granted. A similar project
  ([koala73/worldmonitor](https://github.com/koala73/worldmonitor/issues/6227))
  hit a hard wall here with zero receiver — this plan differs only because
  the harvester already lives on a Mac that's up most of the time, so a
  cheap local receiver is plausible as a side project, not because the Gulf
  coverage gap is any less real.

### What NOT to pursue

- **MarineTraffic API** — ruled out on licensing alone. Their terms
  explicitly restrict display/redistribution outside your own organization;
  a friends-shared dashboard is arguably exactly what that forbids,
  independent of whatever the enterprise price turns out to be.
- **Spire Maritime** — >$10K/month reported; not a hobby-project number.
- **A home AIS receiver as a direct source** — physically cannot hear the
  Gulf. Don't spend money on this expecting it to work that way; its only
  possible value is unlocking AISHub membership, and even that is
  conditional on unverified regional coverage.
- **Datalastic / Data Docked as a wide-area replacement** — both are
  per-vessel-metered, and Datalastic's area endpoint is capped at ~10nm
  radius around a single point. Covering 6 boxes this way means many
  overlapping polls, each burning credits per vessel returned; at this
  project's estimated 108K–1.3M positions/month the entry-level tiers
  (20k–100 credits) are exhausted in hours, not a month. These are built for
  "watch this one port," not "stream a region."

---

## Integration design

### Interface

Pull the provider-specific logic out of `harvest-once.ts` into a small,
swappable shape. The `Pos`/`Meta` types already defined at
`harvest-once.ts:81-87` become the shared contract — every provider
normalizes into them, so nothing downstream (upsert, detectors, status)
needs to know which source fed a given window.

```ts
// src/services/ais-ingester/providers/types.ts
export interface AisProvider {
  name: string; // 'aisstream' | 'global-fishing-watch' | ...
  collectWindow(
    boxes: [[number, number], [number, number]][],
    windowMs: number
  ): Promise<{ positions: Map<string, Pos>; statics: Map<string, Meta> }>;
}
```

- `providers/aisstream.ts` — the existing `collectWindow()` body
  (`harvest-once.ts:195-264`), moved verbatim, implementing the interface.
- `providers/global-fishing-watch.ts` (or whichever paid source is chosen
  later) — a REST poll of the same 6 boxes, normalized into the same
  `Pos`/`Meta` maps. Add one field the shared type doesn't have yet:
  `sourceResolution: 'live' | 'hourly'` (or similar), so a consumer can tell
  a real-time ping from an hourly-bucketed one without inferring it from
  which provider ran.
- Keep `MAX_SPEED_KNOTS`/`isInJammingZone` filtering shared (move to
  `providers/normalize.ts`) rather than duplicated per provider — every
  source should get the same sanity filtering regardless of origin.

### Failover, not fan-out

Call providers **in order**, not concurrently. Only advance to the next one
if the previous returned zero positions for the window:

```ts
async function collectWithFailover(providers: AisProvider[], boxes, windowMs) {
  for (const provider of providers) {
    const result = await provider.collectWindow(boxes, windowMs);
    if (result.positions.size > 0) return { ...result, source: provider.name };
  }
  return { positions: new Map(), statics: new Map(), source: providers.at(-1)!.name };
}
```

This matters specifically because a paid, metered provider sitting second in
the chain should **cost nothing during normal operation** — it only gets
called on the windows where the primary already came back empty, which is
exactly the outage scenario worth paying for. Fan-out (calling every
provider every window) would burn a metered provider's monthly credit
allowance in days regardless of whether AISStream is healthy.

### Reusing the existing dead-provider signature

`harvest-once.ts` already distinguishes "provider is down" from "bad key"
via the socket-open-but-silent pattern documented in
`scripts/harvester/ais-key-check.mjs` and `docs/HARVESTER.md` ("Diagnose
with `ais-key-check.mjs`... a key that is accepted but silent... means the
provider is down, not your key"). Apply the same distinction generically:
a provider implementation should treat "connected/200-OK but zero data
frames for the full window" as *that provider's* outage signal, not throw —
the orchestrator's empty-`positions.size` check already handles the rest via
the failover loop above, and the existing `computeOutageAlert` /
`consecutiveEmptyAisWindows` machinery in `outage-alert.ts` only needs to
key off whether *any* provider in the chain landed data, which it already
does implicitly (it just checks `positions.size === 0`).

### status.json / observability

Add to the `Status` type (`harvest-once.ts:112-130`):

```ts
source: string;                 // which provider fed this window
sourceResolution: 'live' | 'hourly';
providersAttempted: string[];   // for outage post-mortems
```

Surface `source` in the SwiftBar dropdown (`scripts/harvester/straits.10m.sh`)
so a degraded-fidelity window is visually distinct from a healthy one —
e.g., amber "fallback: global-fishing-watch (hourly)" vs the current green
"OK". This is the same instinct as the existing amber/red split for
best-effort steps — don't let a lower-fidelity source *read* as a clean run.

### Env

Follow the existing optional-fallback pattern already used for oil prices
(`FRED_API_KEY` optional → falls back to keyless CSV → `ALPHA_VANTAGE_API_KEY`
further fallback, `.env.harvester` example in HARVESTER.md). A new provider's
key should be optional in the same way: unset → that provider is simply
skipped in the failover chain, not a hard error.

---

## Effort estimate & sequencing

| Step | Effort | Needs an account first? |
|---|---|---|
| 1. Extract `AisProvider` interface, move AISStream's `collectWindow` behind it | 1–2 hrs | No — do this today |
| 2. Wire Global Fishing Watch as provider #2 (self-register, REST client, normalize to `Pos`/`Meta`, add `sourceResolution` flag, gate anomaly detectors off hourly-resolution windows) | 3–5 hrs | No — self-serve, free |
| 3. Update `status.json` schema + SwiftBar plugin to show `source` | 1 hr | No |
| 4. Check `aishub.net/coverage` for Gulf/Red Sea/Suez station density | 10 min | No |
| 5. (Conditional on step 4) Buy + set up an RTL-SDR receiver, wait out the 7-day AISHub qualification window | Days of elapsed time, ~1 hr active work | No account until qualified |
| 6. Request quotes from VesselFinder LIVEDATA and/or Datalastic for the actual 6-box footprint | Sales-dependent turnaround (days) | Yes |
| 7. Wire in whichever paid source is chosen, once its response shape is known | ~half a day, similar to step 2 | Yes |

Steps 1–4 need no new account, no spend, and no waiting on anyone — do them
first regardless of what the user decides about paying for a second source.
Step 1 alone is worth doing even if no second provider is ever added: it's
the seam that makes the *next* decision cheap instead of a rewrite.

---

## What NOT to do

- **Don't wait for a "real" replacement before shipping the $0 fallback.**
  The provider abstraction + Global Fishing Watch path fixes today's actual
  symptom (empty table, empty map) without needing anyone's approval or a
  credit card.
- **Don't sign up for MarineTraffic expecting to display data to friends** —
  their terms forbid it regardless of price tier.
- **Don't try to cover the 6 regional boxes with a per-vessel, point-radius
  metered API** (Datalastic's ~10nm endpoint, Data Docked) — wrong shape,
  and the credit math doesn't survive contact with this project's volume.
- **Don't expect a home AIS receiver to directly solve Gulf coverage** — VHF
  line-of-sight physics rules it out regardless of hardware spent. Its only
  possible value is as a ticket into AISHub's network, and that's gated on
  unverified regional coverage there too.
- **Don't feed Global Fishing Watch's hourly-resolution positions into the
  existing anomaly detectors unchanged.** Going-dark, loitering, and
  speed-anomaly detection all assume something close to the current ~10-min
  cadence; hourly data will either flood false positives or need those
  detectors explicitly gated off `sourceResolution: 'hourly'` windows.
  Decide this on purpose — don't let it happen by accident when the fallback
  first fires during a real outage.
- **Don't fan a metered provider out to every window** — only call it when
  the primary provider's window comes back empty (see Failover, not
  fan-out above). Calling it every 10 minutes regardless of AISStream's
  health will exhaust a paid tier's monthly credits in days.

---

## What's UNVERIFIED

Flagged inline above, collected here for visibility:

- **AISHub's actual station density in the Gulf/Red Sea/Suez region** — the
  coverage map at aishub.net/coverage is JS-rendered and didn't return
  content through automated fetch. This is the single most important
  unknown before spending any money on receiver hardware.
- **VesselFinder LIVEDATA's actual price** for this project's footprint —
  quote-only, not published anywhere found.
- **Datalastic's vessel-type field presence** in real (not just documented)
  API responses — a separate, similar project flagged this as their own
  open blocker before committing.
- **Data Docked's free-tier credit count** — their own pages disagree (20 vs
  100 credits) and per-tier credit allowances for the €80/mo plan weren't
  published anywhere found.
- **Global Fishing Watch's actual data latency** beyond the documented
  hourly temporal resolution — i.e., how stale is "this hour's" bucket by
  the time it's queryable. Worth a manual test call before wiring it in as
  the default fallback.
