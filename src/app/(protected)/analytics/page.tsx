/**
 * Analytics Page (HIST-01)
 *
 * Historical analytics view with traffic charts, time range selector,
 * chokepoint selector, and oil price overlay.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/ui/Header';
import { TrafficChart } from '@/components/charts/TrafficChart';
import { TimeRangeSelector } from '@/components/ui/TimeRangeSelector';
import { ChokepointSelector } from '@/components/ui/ChokepointSelector';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useAnalyticsStore } from '@/stores/analytics';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints-constants';
import type { TrafficWithPrices, RouteTrafficPoint, RouteRegion } from '@/types/analytics';

interface CorrelationData {
  chokepoint: string;
  chokepointName: string;
  priceSymbol: string;
  range: string;
  data: TrafficWithPrices[];
}

/** Human-readable labels for route regions used as chart titles. */
const ROUTE_LABELS: Record<RouteRegion, string> = {
  east_asia: 'East Asia',
  europe: 'Europe',
  americas: 'Americas',
  unknown: 'Unknown',
};

export default function AnalyticsPage() {
  const {
    timeRange,
    selectedChokepoints,
    selectedRoutes,
    viewMode,
    priceSymbol,
    isLoading,
    shipTypeFilter,
    setTimeRange,
    setSelectedChokepoints,
    setViewMode,
    setPriceSymbol,
    setIsLoading,
    setShipTypeFilter,
  } = useAnalyticsStore();

  // Chokepoint view: correlation data keyed by chokepoint ID.
  const [chartData, setChartData] = useState<Record<string, TrafficWithPrices[]>>({});
  // Route view: traffic data keyed by route region.
  const [routeData, setRouteData] = useState<Record<string, TrafficWithPrices[]>>({});
  const [error, setError] = useState<string | null>(null);

  // Fetch data for the active view (chokepoint correlation or route traffic)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (viewMode === 'route') {
        const routesParam = selectedRoutes.join(',');
        const res = await fetch(
          `/api/analytics/traffic?range=${timeRange}&groupBy=route&routes=${routesParam}`
        );

        if (!res.ok) {
          throw new Error('Failed to fetch route traffic');
        }

        const json: { data: RouteTrafficPoint[] } = await res.json();

        // Group the flat route series by route region for per-route charts.
        const grouped: Record<string, TrafficWithPrices[]> = {};
        for (const point of json.data) {
          (grouped[point.route] ??= []).push(point);
        }
        setRouteData(grouped);
      } else {
        const results: Record<string, TrafficWithPrices[]> = {};

        await Promise.all(
          selectedChokepoints.map(async (cpId) => {
            const res = await fetch(
              `/api/analytics/correlation?range=${timeRange}&chokepoint=${cpId}&priceSymbol=${priceSymbol}&shipType=${shipTypeFilter}`
            );

            if (!res.ok) {
              throw new Error(`Failed to fetch data for ${cpId}`);
            }

            const json: CorrelationData = await res.json();
            results[cpId] = json.data;
          })
        );

        setChartData(results);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [viewMode, timeRange, selectedChokepoints, selectedRoutes, priceSymbol, shipTypeFilter, setIsLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <main className="p-6 max-w-7xl mx-auto max-md:p-3">
        {/* Page title and description */}
        <div className="mb-6">
          <h1 className="text-sm font-mono uppercase tracking-widest text-amber-500">Historical Analytics</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Vessel traffic trends and oil price correlation over time
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-center mb-6 p-3 bg-gray-900 border border-amber-500/20">
          <div>
            <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Time Range</label>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">View</label>
            <div className="flex gap-1">
              {(['chokepoint', 'route'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={
                    viewMode === mode
                      ? 'border border-amber-500 bg-amber-500/10 text-amber-500 text-xs font-mono uppercase tracking-wider px-2 py-1'
                      : 'border border-gray-700 text-gray-400 hover:border-amber-500/50 hover:text-gray-300 text-xs font-mono uppercase tracking-wider px-2 py-1'
                  }
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          {viewMode === 'chokepoint' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Chokepoints</label>
                <ChokepointSelector
                  selected={selectedChokepoints}
                  onChange={setSelectedChokepoints}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Price</label>
                <div className="flex gap-1">
                  {(['WTI', 'BRENT'] as const).map((symbol) => (
                    <button
                      key={symbol}
                      onClick={() => setPriceSymbol(symbol)}
                      className={
                        priceSymbol === symbol
                          ? 'border border-amber-500 bg-amber-500/10 text-amber-500 text-xs font-mono uppercase tracking-wider px-2 py-1'
                          : 'border border-gray-700 text-gray-400 hover:border-amber-500/50 hover:text-gray-300 text-xs font-mono uppercase tracking-wider px-2 py-1'
                      }
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div>
            <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Ship Type</label>
            <div className="flex gap-1">
              {(['all', 'tanker', 'cargo', 'other'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setShipTypeFilter(f)}
                  className={
                    shipTypeFilter === f
                      ? 'border border-amber-500 bg-amber-500/10 text-amber-500 text-xs font-mono uppercase tracking-wider px-2 py-1'
                      : 'border border-gray-700 text-gray-400 hover:border-amber-500/50 hover:text-gray-300 text-xs font-mono uppercase tracking-wider px-2 py-1'
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 text-red-400">
            {error}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Loading analytics data...</div>
          </div>
        )}

        {/* Charts — chokepoint correlation view */}
        {!isLoading && !error && viewMode === 'chokepoint' && (
          <ErrorBoundary>
            <div className="space-y-6">
              {selectedChokepoints.map((cpId) => {
                const chokepoint = CHOKEPOINTS[cpId];
                const data = chartData[cpId] || [];

                return (
                  <TrafficChart
                    key={cpId}
                    data={data}
                    title={`${chokepoint.name} - Traffic vs ${priceSymbol} Price`}
                    showPrice={true}
                    priceLabel={priceSymbol}
                    height={350}
                  />
                );
              })}
            </div>
          </ErrorBoundary>
        )}

        {/* Charts — route traffic view */}
        {!isLoading && !error && viewMode === 'route' && (
          <ErrorBoundary>
            <div className="space-y-6">
              {selectedRoutes.map((route) => {
                const data = routeData[route] || [];

                return (
                  <TrafficChart
                    key={route}
                    data={data}
                    title={`${ROUTE_LABELS[route]} - Vessel Traffic`}
                    showPrice={false}
                    height={350}
                  />
                );
              })}
            </div>
          </ErrorBoundary>
        )}

        {/* Empty state */}
        {!isLoading && !error && viewMode === 'chokepoint' && selectedChokepoints.length === 0 && (
          <div className="flex items-center justify-center h-64 bg-gray-900 border border-amber-500/10">
            <p className="text-gray-400">Select at least one chokepoint to view analytics</p>
          </div>
        )}
        {!isLoading && !error && viewMode === 'route' && selectedRoutes.length === 0 && (
          <div className="flex items-center justify-center h-64 bg-gray-900 border border-amber-500/10">
            <p className="text-gray-400">Select at least one route to view analytics</p>
          </div>
        )}
      </main>
    </div>
  );
}
