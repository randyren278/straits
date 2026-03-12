/**
 * Oil Price Panel Component
 * Floating panel displaying WTI and Brent crude oil prices with sparklines.
 * Refreshes every minute via polling.
 */
'use client';

import { useEffect, useState } from 'react';
import { Sparkline } from '../charts/Sparkline';

interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  history: { value: number }[];
}

/**
 * Compact floating panel showing oil prices in top-right corner.
 * Features:
 * - WTI and Brent prices with dollar amounts
 * - Daily change percentage (color-coded green/red)
 * - 30-day sparkline showing price trend
 * - Auto-refresh every 60 seconds
 */
export function OilPricePanel() {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch('/api/prices');
        const data = await res.json();
        setPrices(data.prices || []);
      } catch (error) {
        console.error('Failed to fetch prices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;
  if (!prices.length) return null;

  return (
    <div className="absolute top-16 right-4 bg-[#16162a] border border-gray-800 rounded-lg p-3 z-20 shadow-lg">
      <div className="flex gap-6">
        {prices.map((p) => (
          <div key={p.symbol} className="flex flex-col min-w-[100px]">
            <span className="text-xs text-gray-400 font-medium">{p.symbol}</span>
            <span className="text-xl font-mono text-white">${p.price.toFixed(2)}</span>
            <span className={`text-xs font-medium ${p.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {p.change >= 0 ? '+' : ''}{p.changePercent.toFixed(2)}%
            </span>
            <div className="mt-1">
              <Sparkline
                data={p.history}
                color={p.change >= 0 ? '#4ade80' : '#f87171'}
                height={32}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
