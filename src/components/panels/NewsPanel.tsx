/**
 * News Panel Component
 * Terminal panel showing filtered geopolitical news headlines.
 * Refreshes every 5 minutes via polling.
 */
'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

/**
 * Terminal-style news feed panel in the right column.
 * Features:
 * - Scrollable list of 15 headlines
 * - Source name and relative timestamp
 * - External link indicator
 * - Collapse/expand toggle
 * - Auto-refresh every 5 minutes
 */
export function NewsPanel() {
  const [headlines, setHeadlines] = useState<NewsItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news');
        const data = await res.json();
        setHeadlines(data.headlines || []);
      } catch (error) {
        console.error('Failed to fetch news:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    const interval = setInterval(fetchNews, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;

  return (
    <div className="bg-black">
      {/* Terminal panel header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-3 py-1.5 border-b border-amber-500/20 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">INTEL FEED</span>
        {collapsed ? <ChevronDown className="w-3 h-3 text-amber-500/60" /> : <ChevronUp className="w-3 h-3 text-amber-500/60" />}
      </button>

      {!collapsed && (
        <div className="overflow-y-auto">
          {headlines.length === 0 ? (
            <p className="px-3 py-2 text-gray-500 text-xs font-mono">No headlines available</p>
          ) : (
            headlines.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-2 border-b border-amber-500/10 hover:bg-white/5 transition-colors"
              >
                <p className="text-xs text-gray-200 leading-tight line-clamp-2">{item.title}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 font-mono">
                  <span>{item.source}</span>
                  <span>-</span>
                  <span>{formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}</span>
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </div>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
