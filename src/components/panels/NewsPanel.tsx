/**
 * News Panel Component
 * Collapsible sidebar showing filtered geopolitical news headlines.
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
 * Collapsible news feed panel positioned below the oil price panel.
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
    <div className="absolute top-32 right-4 w-80 bg-[#16162a] border border-gray-800 rounded-lg shadow-lg z-10">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-3 py-2 flex items-center justify-between text-gray-300 hover:text-white border-b border-gray-800"
      >
        <span className="font-medium">News Feed</span>
        {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {!collapsed && (
        <div className="max-h-96 overflow-y-auto">
          {headlines.length === 0 ? (
            <p className="p-3 text-gray-500 text-sm">No headlines available</p>
          ) : (
            headlines.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
              >
                <p className="text-sm text-gray-200 line-clamp-2">{item.title}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
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
