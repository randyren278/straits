'use client';

/**
 * Chokepoint monitoring widgets showing vessel counts.
 * Displays tanker and total vessel counts for each critical chokepoint.
 * Requirements: MAP-07
 */
import { useEffect, useState } from 'react';
import { Anchor } from 'lucide-react';

interface ChokepointData {
  id: string;
  name: string;
  totalVessels: number;
  tankerCount: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

interface ChokepointWidgetsProps {
  onSelect?: (bounds: ChokepointData['bounds'], name: string) => void;
}

export function ChokepointWidgets({ onSelect }: ChokepointWidgetsProps) {
  const [chokepoints, setChokepoints] = useState<ChokepointData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/chokepoints');
        const data = await res.json();
        setChokepoints(data.chokepoints || []);
      } catch (error) {
        console.error('Failed to fetch chokepoints:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every minute
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;

  return (
    <div className="flex gap-2">
      {chokepoints.map((cp) => (
        <button
          key={cp.id}
          onClick={() => onSelect?.(cp.bounds, cp.name)}
          className="flex items-center gap-2 px-3 py-1.5 bg-black hover:bg-gray-900 border border-amber-500/20 transition-colors"
        >
          <Anchor className="w-3.5 h-3.5 text-amber-500" />
          <div className="text-left">
            <p className="text-xs text-gray-300 font-medium whitespace-nowrap">
              {cp.name.replace('Strait of ', '').replace(' Canal', '')}
            </p>
            <p className="text-xs text-gray-500">
              {cp.tankerCount} tankers / {cp.totalVessels} total
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
