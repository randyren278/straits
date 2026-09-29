/**
 * Oil Price Panel Component
 * Terminal panel displaying WTI and Brent crude oil prices with sparklines.
 * Refreshes every minute via polling.
 */
'use client';

import { Sparkline } from '../charts/Sparkline';
import { usePolledJson } from '@/lib/hooks/usePolledJson';

interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  history: { value: number }[];
}

/**
 * Terminal-style panel showing oil prices in the right column.
 * Features:
 * - WTI and Brent prices with dollar amounts
 * - Daily change percentage (color-coded green/red)
 * - 30-day sparkline showing price trend
 * - Auto-refresh every 60 seconds
 */
export function OilPricePanel() {
  const prices = usePolledJson<PriceData[]>('/api/prices', async (signal) => {
    const response = await fetch('/api/prices', { signal });
    if (!response.ok) throw new Error(`prices ${response.status}`);
    const data = await response.json();
    return data.prices ?? [];
  }, 60_000);

  if (prices === null) return null;
  if (!prices.length) return null;

  return (
    <div className="bg-black" role="region" aria-label="Oil prices">
      {/* Terminal panel header */}
      <div className="px-3 py-1.5 border-b border-amber-500/20 flex items-center justify-between">
        <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">OIL PRICES</span>
      </div>

      {/* Price data */}
      <div className="px-3 py-2 space-y-1.5 text-xs" role="status" aria-live="polite">
        {prices.map((p) => (
          <div key={p.symbol} className="flex flex-col" aria-label={`${p.symbol}: $${p.price.toFixed(2)}, ${p.change >= 0 ? '+' : ''}${p.changePercent.toFixed(2)}%`}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-gray-500">{p.symbol}</span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-white">${p.price.toFixed(2)}</span>
                <span className={`font-mono text-xs ${p.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {p.change >= 0 ? '+' : ''}{p.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
            <Sparkline
              data={p.history}
              color={p.change >= 0 ? '#4ade80' : '#f87171'}
              height={32}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
