'use client';

/**
 * Reusable anomaly badge component with color-coded styling.
 * Requirements: ANOM-01, ANOM-02
 */
import { AlertTriangle, Radio, Navigation, Gauge } from 'lucide-react';

interface AnomalyBadgeProps {
  type: 'going_dark' | 'loitering' | 'deviation' | 'speed' | 'repeat_going_dark' | 'sts_transfer';
  confidence: 'confirmed' | 'suspected' | 'unknown';
  size?: 'sm' | 'md';
}

const BADGE_CONFIG = {
  going_dark: {
    confirmed: { bg: 'bg-red-500', icon: Radio, label: 'DARK' },
    suspected: { bg: 'bg-yellow-500', icon: Radio, label: 'DARK?' },
    unknown: { bg: 'bg-gray-500', icon: Radio, label: 'GAP' },
  },
  loitering: {
    confirmed: { bg: 'bg-orange-500', icon: Navigation, label: 'LOITER' },
    suspected: { bg: 'bg-orange-400', icon: Navigation, label: 'LOITER?' },
    unknown: { bg: 'bg-gray-500', icon: Navigation, label: 'SLOW' },
  },
  deviation: {
    confirmed: { bg: 'bg-amber-600', icon: AlertTriangle, label: 'ROUTE' },
    suspected: { bg: 'bg-amber-500', icon: AlertTriangle, label: 'ROUTE?' },
    unknown: { bg: 'bg-gray-500', icon: AlertTriangle, label: 'DEV' },
  },
  speed: {
    confirmed: { bg: 'bg-amber-600', icon: Gauge, label: 'DRIFT' },
    suspected: { bg: 'bg-amber-500', icon: Gauge, label: 'DRIFT?' },
    unknown: { bg: 'bg-gray-500', icon: Gauge, label: 'SLOW' },
  },
  repeat_going_dark: {
    confirmed: { bg: 'bg-red-600', icon: Radio, label: 'REPEAT' },
    suspected: { bg: 'bg-red-400', icon: Radio, label: 'REPEAT?' },
    unknown: { bg: 'bg-gray-500', icon: Radio, label: 'PATTERN' },
  },
  sts_transfer: {
    confirmed: { bg: 'bg-purple-600', icon: AlertTriangle, label: 'STS' },
    suspected: { bg: 'bg-purple-400', icon: AlertTriangle, label: 'STS?' },
    unknown: { bg: 'bg-gray-500', icon: AlertTriangle, label: 'STS' },
  },
};

export function AnomalyBadge({ type, confidence, size = 'sm' }: AnomalyBadgeProps) {
  const config = BADGE_CONFIG[type]?.[confidence] || BADGE_CONFIG.going_dark.unknown;
  const Icon = config.icon;

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-xs'
    : 'px-2 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1 ${config.bg} text-white rounded font-semibold ${sizeClasses}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {config.label}
    </span>
  );
}
