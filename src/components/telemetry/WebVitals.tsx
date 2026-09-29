'use client';

import { useEffect } from 'react';
import { useReportWebVitals } from 'next/web-vitals';

type MetricName = 'LCP' | 'INP' | 'CLS' | 'MAP_READY' | 'MAP_INIT_ERROR' | 'MAP_DATA_ERROR' | 'SHELL_READY' | 'SNAPSHOT_RECEIVED' | 'MAP_STYLE_READY';
type Sample = { id: string; route: string; device: string; connection: string } | null;
let sample: Sample | undefined;
let warned = false;

function getSample(): Sample {
  if (sample !== undefined) return sample;
  const route = window.location.pathname;
  if (!['/dashboard', '/fleet', '/analytics', '/about'].includes(route) || Math.random() >= 0.1) {
    sample = null;
    return sample;
  }
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
  sample = {
    id: crypto.randomUUID(), route,
    device: window.innerWidth < 768 ? 'phone' : window.innerWidth < 1280 ? 'tablet' : 'desktop',
    connection: ['slow-2g', '2g', '3g', '4g'].includes(connection ?? '') ? connection! : 'unknown',
  };
  return sample;
}

function report(metric: MetricName, value: number) {
  const context = getSample();
  // These values are measured from the hard-navigation time origin. Do not
  // attribute a later client-side route's work to the initial route.
  if (!context || context.route !== window.location.pathname || !Number.isFinite(value)) return;
  const body = JSON.stringify({
    sampleId: context.id, metric, value, route: context.route,
    device: context.device, connection: context.connection,
  });
  const blob = new Blob([body], { type: 'application/json' });
  if (navigator.sendBeacon?.('/api/performance', blob)) return;
  void fetch('/api/performance', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
    .then((response) => {
      if (!response.ok && !warned) {
        warned = true;
        console.warn('Performance telemetry unavailable', response.status);
      }
    })
    .catch(() => {
      if (!warned) {
        warned = true;
        console.warn('Performance telemetry unavailable');
      }
    });
}

const handleWebVitals: Parameters<typeof useReportWebVitals>[0] = (metric) => {
  if (metric.name === 'LCP' || metric.name === 'INP' || metric.name === 'CLS') {
    report(metric.name, metric.value);
  }
};

const MARKS: Record<string, MetricName> = {
  'straits:shell-ready': 'SHELL_READY',
  'straits:snapshot-received': 'SNAPSHOT_RECEIVED',
  'straits:map-style-loaded': 'MAP_STYLE_READY',
  'straits:vessel-render-ready': 'MAP_READY',
  'straits:map-init-error': 'MAP_INIT_ERROR',
  'straits:map-data-error': 'MAP_DATA_ERROR',
};

export function WebVitals() {
  useReportWebVitals(handleWebVitals);

  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') return;
    const seen = new Set<MetricName>();
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const metric = MARKS[entry.name];
        if (!metric || seen.has(metric)) continue;
        seen.add(metric);
        report(metric, entry.startTime);
      }
    });
    observer.observe({ type: 'mark', buffered: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
