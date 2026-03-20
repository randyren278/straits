/**
 * About Page
 *
 * Documents all anomaly event definitions, the dark fleet risk score formula,
 * and data sources used by Tanker Tracker.
 */
'use client';

import { Header } from '@/components/ui/Header';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <main className="p-6 max-w-4xl mx-auto">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-sm font-mono uppercase tracking-widest text-amber-500">About Tanker Tracker</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Anomaly detection definitions and risk scoring methodology
          </p>
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
                Vessel stops broadcasting AIS signal while in a known coverage zone. Normal gaps in open ocean are excluded — only gaps detected within monitored regional bounding boxes are flagged.
              </p>
              <div className="text-gray-500 text-xs font-mono">
                Suspected: 2–4 hour signal gap &nbsp;|&nbsp; Confirmed: &gt;4 hour signal gap
              </div>
            </div>

            {/* Loitering */}
            <div>
              <div className="text-amber-500 font-mono text-sm mb-1">LOITERING</div>
              <p className="text-gray-300 text-sm mb-1">
                Vessel moving below 3 knots outside a known anchorage area, remaining within a 5 nautical mile radius for an extended period. Indicates possible at-sea waiting for a clandestine transfer or rendezvous.
              </p>
              <div className="text-gray-500 text-xs font-mono">
                Speed: &lt;3 knots &nbsp;|&nbsp; Radius: 5 nm &nbsp;|&nbsp; Outside known anchorages
              </div>
            </div>

            {/* Speed Anomaly */}
            <div>
              <div className="text-amber-500 font-mono text-sm mb-1">SPEED ANOMALY</div>
              <p className="text-gray-300 text-sm mb-1">
                Vessel speed drops below 3 knots outside port or anchorage areas. May indicate drifting, a disabled vessel, or intentional speed reduction to avoid detection windows.
              </p>
              <div className="text-gray-500 text-xs font-mono">
                Speed: &lt;3 knots &nbsp;|&nbsp; Outside port / anchorage zones
              </div>
            </div>

            {/* Route Deviation */}
            <div>
              <div className="text-amber-500 font-mono text-sm mb-1">ROUTE DEVIATION</div>
              <p className="text-gray-300 text-sm mb-1">
                Vessel heading contradicts its declared AIS destination. Detected by geocoding the declared destination via Nominatim and comparing actual heading to expected bearing. A deviation is confirmed when all positions over a 2-hour window show inconsistent heading.
              </p>
              <div className="text-gray-500 text-xs font-mono">
                Window: 2 hours &nbsp;|&nbsp; All positions must deviate &nbsp;|&nbsp; Geocoding: Nominatim / OpenStreetMap
              </div>
            </div>

            {/* Repeat Going Dark */}
            <div>
              <div className="text-amber-500 font-mono text-sm mb-1">REPEAT GOING DARK</div>
              <p className="text-gray-300 text-sm mb-1">
                Vessel has gone dark 3 or more times within a rolling 30-day window. Pattern strongly indicates deliberate AIS manipulation rather than equipment failure or communication blackspots.
              </p>
              <div className="text-gray-500 text-xs font-mono">
                Threshold: 3+ going-dark events &nbsp;|&nbsp; Window: 30 days rolling
              </div>
            </div>

            {/* STS Transfer */}
            <div>
              <div className="text-amber-500 font-mono text-sm mb-1">STS TRANSFER</div>
              <p className="text-gray-300 text-sm mb-1">
                Two vessels detected within 0.5 nautical miles of each other for 30 or more consecutive minutes. Ship-to-ship transfers at sea are a primary method for sanctions evasion and oil laundering — cargo is transferred between vessels to obscure origin.
              </p>
              <div className="text-gray-500 text-xs font-mono">
                Proximity: &lt;0.5 nm &nbsp;|&nbsp; Duration: 30+ consecutive minutes
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
              A composite score (0–100) that aggregates evasion signals per vessel. Higher scores indicate a stronger pattern of behavior associated with sanctions evasion or illicit oil trade. The score updates whenever new anomaly events are detected.
            </p>
            <table className="w-full font-mono text-sm" style={{ borderCollapse: 'collapse' }}>
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
                  <td className="py-2 px-3 text-gray-500 text-xs">Binary — vessel IMO appears in OpenSanctions database</td>
                </tr>
                <tr className="border-b border-amber-500/10">
                  <td className="py-2 px-3 text-gray-300">Flag State Risk</td>
                  <td className="py-2 px-3 text-right text-gray-300">15 pts</td>
                  <td className="py-2 px-3 text-gray-500 text-xs">High-risk flags: IR, RU, VE, KP, PA, CM, KM</td>
                </tr>
                <tr className="border-b border-amber-500/10">
                  <td className="py-2 px-3 text-gray-300">Loitering History</td>
                  <td className="py-2 px-3 text-right text-gray-300">10 pts</td>
                  <td className="py-2 px-3 text-gray-500 text-xs">Binary — any loitering event in past 90 days</td>
                </tr>
                <tr className="border-b border-amber-500/10">
                  <td className="py-2 px-3 text-gray-300">STS Transfer History</td>
                  <td className="py-2 px-3 text-right text-gray-300">10 pts</td>
                  <td className="py-2 px-3 text-gray-500 text-xs">Binary — any STS transfer event on record</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-amber-500 font-bold">Total Maximum</td>
                  <td className="py-2 px-3 text-right text-amber-500 font-bold">100 pts</td>
                  <td className="py-2 px-3 text-gray-500 text-xs"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Data Sources */}
        <div className="bg-gray-900 border border-amber-500/20 mb-6">
          <div className="px-3 py-1.5 border-b border-amber-500/20">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-500">Data Sources</span>
          </div>
          <div className="p-4 space-y-2">
            <div className="text-sm text-gray-300">
              <span className="text-amber-500">aisstream.io</span> — AIS vessel positions via WebSocket, near real-time
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-amber-500">OpenSanctions</span> — Sanctions database, daily refresh, IMO-matched
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-amber-500">Alpha Vantage</span> — Oil prices (primary), 25 requests/day free tier
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-amber-500">FRED</span> — Oil prices (fallback), Federal Reserve Economic Data, no rate limits
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-amber-500">NewsAPI</span> — Geopolitical news headlines, keyword-filtered for Middle East and oil
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-amber-500">Nominatim</span> — Destination geocoding via OpenStreetMap, used for route deviation detection
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
