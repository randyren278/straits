/**
 * About Page
 *
 * Documents all anomaly event definitions, the dark fleet risk score formula,
 * and data sources used by Straits.
 */
'use client';

import { Header } from '@/components/ui/Header';
import { LEGEND_ACTIVITY, LEGEND_IDENTITY, FRESHNESS_STOPS, ACTIVITY_COLORS, IDENTITY_COLORS } from '@/lib/map/marker-style';

function Swatch({ fill, stroke, opacity = 1 }: { fill: string; stroke: string; opacity?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-3.5 h-3.5 rounded-full shrink-0"
      style={{ backgroundColor: fill, boxShadow: `0 0 0 1.5px ${stroke}`, opacity }}
    />
  );
}

const RISK_ROWS = [
  { factor: 'Going Dark History', points: '8 pts / event', note: 'Capped at 40 pts (5 events max contribution)' },
  { factor: 'Sanctions Match', points: '25 pts', note: 'Binary: vessel IMO appears in OpenSanctions database' },
  { factor: 'Flag State Risk', points: '15 pts', note: 'High-risk flags: IR, RU, VE, KP, PA, CM, KM' },
  { factor: 'Loitering History', points: '10 pts', note: 'Binary: any loitering event in past 90 days' },
  { factor: 'STS Transfer History', points: '10 pts', note: 'Binary: any STS transfer event on record' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <main className="p-6 max-w-7xl mx-auto phone:p-3 phone:pb-[calc(var(--straits-nav-h)+1rem)]">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-sm font-mono uppercase tracking-widest text-amber-500">Field manual</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            How to read the map, what the signals mean, and where the uncertainty is
          </p>
        </div>

        {/* Section 0: Reading the map */}
        <div className="bg-gray-900 border border-amber-500/20 mb-6" id="reading-the-map">
          <div className="px-3 py-1.5 border-b border-amber-500/20">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-500">Reading the map</span>
          </div>
          <div className="p-4 space-y-6">
            <p className="text-gray-300 text-sm">
              Every contact carries three independent signals. They never share a colour, so a sanctioned hull that
              goes dark shows both facts at once instead of one hiding the other.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-amber-500 font-mono text-sm mb-2">FILL · ACTIVITY</div>
                <p className="text-gray-400 text-xs mb-2">What a detector concluded the vessel is doing right now.</p>
                <ul className="space-y-1.5 text-xs font-mono text-gray-300">
                  {LEGEND_ACTIVITY.map(({ label, color }) => (
                    <li key={label} className="flex items-center gap-2"><Swatch fill={color} stroke={IDENTITY_COLORS.none} />{label}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-amber-500 font-mono text-sm mb-2">OUTLINE · IDENTITY</div>
                <p className="text-gray-400 text-xs mb-2">Which lists the hull is on. Reference data, not a detector.</p>
                <ul className="space-y-1.5 text-xs font-mono text-gray-300">
                  {LEGEND_IDENTITY.map(({ label, color }) => (
                    <li key={label} className="flex items-center gap-2"><Swatch fill={ACTIVITY_COLORS.normal} stroke={color} />{label}</li>
                  ))}
                  <li className="flex items-center gap-2 text-gray-500"><Swatch fill={ACTIVITY_COLORS.normal} stroke={IDENTITY_COLORS.none} />Not on any list</li>
                </ul>
              </div>
              <div>
                <div className="text-amber-500 font-mono text-sm mb-2">OPACITY · FIX AGE</div>
                <p className="text-gray-400 text-xs mb-2">How old the last received position is. Faded contacts are last-known, not live.</p>
                <ul className="flex items-end gap-4 text-xs font-mono text-gray-300">
                  {FRESHNESS_STOPS.filter(([h]) => h > 0).map(([hours, opacity]) => (
                    <li key={hours} className="flex flex-col items-center gap-1">
                      <Swatch fill={ACTIVITY_COLORS.normal} stroke={IDENTITY_COLORS.none} opacity={opacity} />
                      <span className="text-gray-500">{hours >= 24 ? `${Math.round(hours / 24)}d` : `${hours}h`}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-gray-500 text-xs mt-2">Contacts drop off the map after 7 days without a fix.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-amber-500 font-mono text-sm mb-2">OVERLAYS</div>
                <ul className="space-y-1.5 text-xs text-gray-300">
                  <li><span className="font-mono text-gray-200">Dashed amber box</span> — a chokepoint zone. Counts in the header are contacts inside it.</li>
                  <li><span className="font-mono text-gray-200">Dotted amber outline</span> — monitored coverage. Empty sea outside it means <em>unwatched</em>, not empty.</li>
                  <li><span className="font-mono text-gray-200">Amber ring</span> — the selected contact. The rest of the field recedes while you investigate.</li>
                  <li><span className="font-mono text-gray-200">Amber line</span> — the last 24 hours of fixes for the selected contact, when any exist.</li>
                  <li><span className="font-mono text-gray-200">White chevron</span> — reported heading, drawn only when the vessel is under way and the heading is valid.</li>
                </ul>
              </div>
              <div>
                <div className="text-amber-500 font-mono text-sm mb-2">THREE KINDS OF STATEMENT</div>
                <ul className="space-y-1.5 text-xs text-gray-300">
                  <li><span className="font-mono text-[10px] px-1 border border-gray-600 text-gray-400">OBS</span> <span className="ml-1">Observed — a fact from the AIS feed: a fix, a destination change. Reliable to the extent the transponder is.</span></li>
                  <li><span className="font-mono text-[10px] px-1 border border-orange-500/60 text-orange-300">DET</span> <span className="ml-1">Detector — a conclusion drawn from observations, with a confidence. Can be wrong; the thresholds are below.</span></li>
                  <li><span className="font-mono text-[10px] px-1 border border-red-500/60 text-red-300">REF</span> <span className="ml-1">Reference — an external listing (OpenSanctions). Authoritative about the list, not about what the vessel is doing today.</span></li>
                </ul>
                <p className="text-gray-500 text-xs mt-3">
                  Timestamps are separated on purpose: <span className="text-gray-300">refreshed</span> is when the site last asked the database;
                  <span className="text-gray-300"> latest fix</span> is the newest observation anywhere; <span className="text-gray-300">observed</span> on
                  a contact is that contact&apos;s own last fix. Only the last one tells you how current a position is.
                </p>
              </div>
            </div>

            <div>
              <div className="text-amber-500 font-mono text-sm mb-2">GETTING AROUND</div>
              <ul className="space-y-1 text-xs text-gray-300">
                <li><kbd className="font-mono text-[10px] px-1 border border-gray-700 text-gray-400">⌘K</kbd> jumps to a vessel, a chokepoint or a page from anywhere.</li>
                <li>The link icon on a contact copies a URL that reproduces the contact, the map view and your filters.</li>
                <li><span className="font-mono text-gray-200">Current watch</span> on the live map lists the three things most worth a look right now, each one tap from its evidence.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Section 1: Anomaly Events */}
        <div className="bg-gray-900 border border-amber-500/20 mb-6">
          <div className="px-3 py-1.5 border-b border-amber-500/20">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-500">Anomaly Events</span>
          </div>
          <div className="p-4 space-y-6">

            {/* Going Dark */}
            <div>
              <div className="text-amber-500 font-mono text-sm mb-1">GOING DARK</div>
              <p className="text-gray-300 text-sm mb-1">
                Vessel stops broadcasting AIS signal while in a known coverage zone. Normal gaps in open ocean are excluded. Only gaps detected within monitored regional bounding boxes are flagged.
              </p>
              <div className="text-gray-500 text-xs font-mono flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-2">
                <span>Suspected: 2-4 hour signal gap</span>
                <span className="hidden sm:inline text-amber-500/40">|</span>
                <span>Confirmed: &gt;4 hour signal gap</span>
              </div>
            </div>

            {/* Loitering */}
            <div>
              <div className="text-amber-500 font-mono text-sm mb-1">LOITERING</div>
              <p className="text-gray-300 text-sm mb-1">
                Vessel moving below 3 knots outside a known anchorage area, remaining within a 5 nautical mile radius for an extended period. Indicates possible at-sea waiting for a clandestine transfer or rendezvous.
              </p>
              <div className="text-gray-500 text-xs font-mono flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-2">
                <span>Speed: &lt;3 knots</span>
                <span className="hidden sm:inline text-amber-500/40">|</span>
                <span>Radius: 5 nm</span>
                <span className="hidden sm:inline text-amber-500/40">|</span>
                <span>Outside known anchorages</span>
              </div>
            </div>

            {/* Speed Anomaly */}
            <div>
              <div className="text-amber-500 font-mono text-sm mb-1">SPEED ANOMALY</div>
              <p className="text-gray-300 text-sm mb-1">
                Vessel speed drops below 3 knots outside port or anchorage areas. May indicate drifting, a disabled vessel, or intentional speed reduction to avoid detection windows.
              </p>
              <div className="text-gray-500 text-xs font-mono flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-2">
                <span>Speed: &lt;3 knots</span>
                <span className="hidden sm:inline text-amber-500/40">|</span>
                <span>Outside port / anchorage zones</span>
              </div>
            </div>

            {/* Route Deviation */}
            <div>
              <div className="text-amber-500 font-mono text-sm mb-1">ROUTE DEVIATION</div>
              <p className="text-gray-300 text-sm mb-1">
                Vessel heading contradicts its declared AIS destination. Detected by geocoding the declared destination via Nominatim and comparing actual heading to expected bearing. A deviation is confirmed when all positions over a 2-hour window show inconsistent heading.
              </p>
              <div className="text-gray-500 text-xs font-mono flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-2">
                <span>Window: 2 hours</span>
                <span className="hidden sm:inline text-amber-500/40">|</span>
                <span>All positions must deviate</span>
                <span className="hidden sm:inline text-amber-500/40">|</span>
                <span>Geocoding: Nominatim / OpenStreetMap</span>
              </div>
            </div>

            {/* Repeat Going Dark */}
            <div>
              <div className="text-amber-500 font-mono text-sm mb-1">REPEAT GOING DARK</div>
              <p className="text-gray-300 text-sm mb-1">
                Vessel has gone dark 3 or more times within a rolling 30-day window. Pattern strongly indicates deliberate AIS manipulation rather than equipment failure or communication blackspots.
              </p>
              <div className="text-gray-500 text-xs font-mono flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-2">
                <span>Threshold: 3+ going-dark events</span>
                <span className="hidden sm:inline text-amber-500/40">|</span>
                <span>Window: 30 days rolling</span>
              </div>
            </div>

            {/* STS Transfer */}
            <div>
              <div className="text-amber-500 font-mono text-sm mb-1">STS TRANSFER</div>
              <p className="text-gray-300 text-sm mb-1">
                Two vessels detected within 0.5 nautical miles of each other for 30 or more consecutive minutes. Ship-to-ship transfers at sea are a primary method for sanctions evasion and oil laundering: cargo is transferred between vessels to obscure origin.
              </p>
              <div className="text-gray-500 text-xs font-mono flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-2">
                <span>Proximity: &lt;0.5 nm</span>
                <span className="hidden sm:inline text-amber-500/40">|</span>
                <span>Duration: 30+ consecutive minutes</span>
              </div>
            </div>

          </div>
        </div>

        {/* Section 2: Dark Fleet Risk Score */}
        <div className="bg-gray-900 border border-amber-500/20 mb-6">
          <div className="px-3 py-1.5 border-b border-amber-500/20">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-500">Dark Fleet Risk Score</span>
          </div>
          <div className="p-4">
            <p className="text-gray-300 text-sm mb-4">
              A composite score (0-100) that aggregates evasion signals per vessel. Higher scores indicate a stronger pattern of behavior associated with sanctions evasion or illicit oil trade. The score updates whenever new anomaly events are detected.
            </p>
            <table className="hidden roomy:table w-full font-mono text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="border-b border-amber-500/20">
                  <th className="py-2 px-3 text-left text-xs text-amber-500 uppercase tracking-wider">Factor</th>
                  <th className="py-2 px-3 text-right text-xs text-amber-500 uppercase tracking-wider">Points</th>
                  <th className="py-2 px-3 text-left text-xs text-amber-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-amber-500/10">
                  <td className="py-2 px-3 text-gray-300">Going Dark History</td>
                  <td className="py-2 px-3 text-right text-gray-300">8 pts / event</td>
                  <td className="py-2 px-3 text-gray-500 text-xs">Capped at 40 pts (5 events max contribution)</td>
                </tr>
                <tr className="border-b border-amber-500/10">
                  <td className="py-2 px-3 text-gray-300">Sanctions Match</td>
                  <td className="py-2 px-3 text-right text-gray-300">25 pts</td>
                  <td className="py-2 px-3 text-gray-500 text-xs">Binary: vessel IMO appears in OpenSanctions database</td>
                </tr>
                <tr className="border-b border-amber-500/10">
                  <td className="py-2 px-3 text-gray-300">Flag State Risk</td>
                  <td className="py-2 px-3 text-right text-gray-300">15 pts</td>
                  <td className="py-2 px-3 text-gray-500 text-xs">High-risk flags: IR, RU, VE, KP, PA, CM, KM</td>
                </tr>
                <tr className="border-b border-amber-500/10">
                  <td className="py-2 px-3 text-gray-300">Loitering History</td>
                  <td className="py-2 px-3 text-right text-gray-300">10 pts</td>
                  <td className="py-2 px-3 text-gray-500 text-xs">Binary: any loitering event in past 90 days</td>
                </tr>
                <tr className="border-b border-amber-500/10">
                  <td className="py-2 px-3 text-gray-300">STS Transfer History</td>
                  <td className="py-2 px-3 text-right text-gray-300">10 pts</td>
                  <td className="py-2 px-3 text-gray-500 text-xs">Binary: any STS transfer event on record</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-amber-500 font-bold">Total Maximum</td>
                  <td className="py-2 px-3 text-right text-amber-500 font-bold">100 pts</td>
                  <td className="py-2 px-3 text-gray-500 text-xs"></td>
                </tr>
              </tbody>
            </table>

            {/* Mobile stacked view — full-width notes, readable on a phone */}
            <div className="roomy:hidden space-y-2">
              {RISK_ROWS.map((r) => (
                <div key={r.factor} className="border border-amber-500/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm">{r.factor}</span>
                    <span className="text-amber-500 text-sm">{r.points}</span>
                  </div>
                  <div className="text-gray-500 text-xs mt-1">{r.note}</div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-amber-500/20 pt-2 px-3">
                <span className="text-amber-500 font-bold text-sm">Total Maximum</span>
                <span className="text-amber-500 font-bold text-sm">100 pts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Data Sources */}
        <div className="bg-gray-900 border border-amber-500/20 mb-6">
          <div className="px-3 py-1.5 border-b border-amber-500/20">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-500">Data Sources</span>
          </div>
          <div className="p-4 space-y-2">
            <div className="text-sm text-gray-300">
              <span className="text-amber-500">aisstream.io</span>: AIS vessel positions via WebSocket, near real-time
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-amber-500">MapLibre + CARTO</span>: Keyless basemap rendering, no access token required
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-amber-500">OpenSanctions</span>: Sanctions database, daily refresh, IMO-matched (CC BY-NC 4.0)
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-amber-500">FRED</span>: Oil prices (primary), Federal Reserve Economic Data, API key optional
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-amber-500">Alpha Vantage</span>: Oil prices (optional fallback), 25 requests/day free tier
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-amber-500">Google News RSS</span>: Geopolitical news headlines via keyless RSS, keyword-filtered for Middle East and oil
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-amber-500">Nominatim</span>: Destination geocoding via OpenStreetMap, used for route deviation detection
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
