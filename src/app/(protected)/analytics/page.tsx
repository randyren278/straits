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
import { useAnalyticsStore } from '@/stores/analytics';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints-constants';
import type { TrafficWithPrices } from '@/types/analytics';

interface CorrelationData {
  chokepoint: string;
  chokepointName: string;
  priceSymbol: string;
  range: string;
  data: TrafficWithPrices[];
}

export default function AnalyticsPage() {
  const {
    timeRange,
    selectedChokepoints,
    isLoading,
    setTimeRange,
    setSelectedChokepoints,
    setIsLoading,
  } = useAnalyticsStore();

  const [chartData, setChartData] = useState<Record<string, TrafficWithPrices[]>>({});
  const [error, setError] = useState<string | null>(null);

  // Fetch correlation data for each selected chokepoint
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const results: Record<string, TrafficWithPrices[]> = {};

      await Promise.all(
        selectedChokepoints.map(async (cpId) => {
          const res = await fetch(
            `/api/analytics/correlation?range=${timeRange}&chokepoint=${cpId}&priceSymbol=WTI`
          );

          if (!res.ok) {
            throw new Error(`Failed to fetch data for ${cpId}`);
          }

          const json: CorrelationData = await res.json();
          results[cpId] = json.data;
        })
      );

      setChartData(results);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, selectedChokepoints, setIsLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <main className="p-6 max-w-7xl mx-auto">
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
            <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Chokepoints</label>
            <ChokepointSelector
              selected={selectedChokepoints}
              onChange={setSelectedChokepoints}
            />
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

        {/* Charts */}
        {!isLoading && !error && (
          <div className="space-y-6">
            {selectedChokepoints.map((cpId) => {
              const chokepoint = CHOKEPOINTS[cpId];
              const data = chartData[cpId] || [];

              return (
                <TrafficChart
                  key={cpId}
                  data={data}
                  title={`${chokepoint.name} - Traffic vs WTI Price`}
                  showPrice={true}
                  priceLabel="WTI"
                  height={350}
                />
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && selectedChokepoints.length === 0 && (
          <div className="flex items-center justify-center h-64 bg-gray-900 border border-amber-500/10">
            <p className="text-gray-400">Select at least one chokepoint to view analytics</p>
          </div>
        )}
      </main>
    </div>
  );
}
