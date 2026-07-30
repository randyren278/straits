'use client';

/**
 * Personal alert inbox bell with dropdown.
 * Shows the signed-in user's alerts (per-user feed from /api/alerts) with an
 * unread badge driven by the vessel store's unreadCount.
 * Requirements: HIST-02, PANL-04
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useVesselStore } from '@/stores/vessel';
import { useSharedUserId } from '@/lib/hooks/useSharedUserId';
import { usePolledJson } from '@/lib/hooks/usePolledJson';
import { ANOMALY_TYPE_LABELS } from '@/types/anomaly';
import type { AnomalyType, Alert } from '@/types/anomaly';

/** Human-readable label for an alert type (falls back to the raw value). */
function alertTypeLabel(alertType: string): string {
  return ANOMALY_TYPE_LABELS[alertType as AnomalyType] ?? alertType;
}

/** Gap kept between the dropdown and the viewport edges. */
const EDGE_MARGIN = 8;
/** Preferred width; narrowed on phones that can't fit it. */
const PREFERRED_WIDTH = 320;

export function NotificationBell() {
  const { alerts, unreadCount, setAlerts, markAlertRead, setTargetVesselImo } = useVesselStore();
  const [isOpen, setIsOpen] = useState(false);
  const [userId] = useSharedUserId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{ left: number; width: number; maxHeight: number } | null>(null);

  // Place the dropdown against the viewport rather than blindly right-aligning
  // it to the bell. The bell sits at different x-positions per route (the fleet
  // header has no search or filters), and a fixed right-0 anchor put most of a
  // 320px panel off the left edge there. Runs before paint, so nothing flashes.
  useLayoutEffect(() => {
    if (!isOpen) return;

    const place = () => {
      const anchor = wrapRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const width = Math.min(PREFERRED_WIDTH, vw - EDGE_MARGIN * 2);
      // Prefer right-aligned to the bell, then clamp into the viewport.
      const preferred = anchor.right - width;
      const clamped = Math.min(
        Math.max(preferred, EDGE_MARGIN),
        vw - width - EDGE_MARGIN
      );
      setPlacement({
        // Offset is relative to the anchor, since the panel is absolutely
        // positioned inside it and must scroll along with the header.
        left: clamped - anchor.left,
        width,
        maxHeight: Math.max(vh - anchor.bottom - EDGE_MARGIN * 2, 160),
      });
    };

    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [isOpen]);

  // Fetch the user's alerts every 30 seconds — shared with any other mounted
  // copy of this component (one per breakpoint) via usePolledJson, so two
  // copies never mean two pollers.
  const fetchAlerts = useCallback(async (): Promise<Alert[]> => {
    try {
      const res = await fetch('/api/alerts', {
        headers: { 'X-User-Id': userId },
      });
      const data = await res.json();
      return (data.alerts as Alert[]) || [];
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      throw err;
    }
  }, [userId]);

  const polledAlerts = usePolledJson<Alert[]>(userId ? `/api/alerts:${userId}` : null, fetchAlerts, 30000);

  useEffect(() => {
    if (polledAlerts) setAlerts(polledAlerts);
  }, [polledAlerts, setAlerts]);

  const handleAlertClick = async (alert: Alert) => {
    if (!alert.readAt) {
      markAlertRead(alert.id);
      try {
        await fetch(`/api/alerts/${alert.id}/read`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to mark alert as read:', err);
      }
    }
    setTargetVesselImo(alert.imo);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors phone:min-h-[44px] phone:min-w-[44px] phone:inline-flex phone:items-center phone:justify-center tablet:min-h-[44px] tablet:min-w-[44px] tablet:inline-flex tablet:items-center tablet:justify-center"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop for closing */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            role="presentation"
            aria-hidden="true"
          />

          {/* Dropdown */}
          <div
            className="absolute top-full mt-2 bg-black border border-amber-500/20 shadow-xl z-50 flex flex-col overflow-hidden"
            style={
              placement
                ? { left: placement.left, width: placement.width, maxHeight: placement.maxHeight }
                : { right: 0, width: PREFERRED_WIDTH, maxHeight: 384 }
            }
            role="region"
            aria-label="Alert inbox"
          >
            <div className="p-3 border-b border-gray-700 flex justify-between items-center shrink-0">
              <span className="font-semibold text-white">Alerts</span>
              <span className="text-xs text-gray-500">{unreadCount} unread</span>
            </div>

            {/* Grows into whatever height the viewport actually left us. */}
            <div className="overflow-y-auto flex-1 min-h-0">
              {alerts.length === 0 ? (
                <div className="p-4 text-gray-400 text-center">No alerts</div>
              ) : (
                alerts.slice(0, 20).map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    className="p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-900 transition-colors"
                    role="button"
                    aria-label={`Alert for vessel ${alert.vesselName || alert.imo}: ${alertTypeLabel(alert.alertType)}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-1.5">
                        {!alert.readAt && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <span className="font-medium text-white">
                          {alert.vesselName || alert.imo}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-400 font-mono uppercase tracking-wider">
                      {alertTypeLabel(alert.alertType)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
