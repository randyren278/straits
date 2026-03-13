'use client';

/**
 * Alert notification bell with dropdown.
 * Shows unread alert count and lists recent alerts.
 * Requirements: ANOM-02, HIST-02
 */
import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useVesselStore } from '@/stores/vessel';
import { AnomalyBadge } from './AnomalyBadge';
import type { AnomalyType, Alert } from '@/types/anomaly';

interface AlertWithVessel extends Alert {
  vesselName?: string;
}

export function NotificationBell() {
  const { alerts, unreadCount, setAlerts, markAlertRead, setMapCenter } = useVesselStore();
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Initialize user ID from localStorage
  useEffect(() => {
    let id = localStorage.getItem('tanker_tracker_user_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('tanker_tracker_user_id', id);
    }
    setUserId(id);
  }, []);

  // Fetch alerts periodically
  useEffect(() => {
    if (!userId) return;

    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/alerts', {
          headers: { 'X-User-Id': userId },
        });
        const data = await res.json();
        setAlerts(data.alerts || []);
      } catch (err) {
        console.error('Failed to fetch alerts:', err);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [userId, setAlerts]);

  const handleAlertClick = async (alert: AlertWithVessel) => {
    // Mark as read if unread
    if (!alert.readAt) {
      markAlertRead(alert.id);
      try {
        await fetch(`/api/alerts/${alert.id}/read`, {
          method: 'POST',
          headers: { 'X-User-Id': userId || '' },
        });
      } catch (err) {
        console.error('Failed to mark alert as read:', err);
      }
    }

    // Navigate to vessel location if available from alert details
    const details = alert.details as Record<string, unknown>;
    if (details?.lastPosition) {
      const pos = details.lastPosition as { lat: number; lon: number };
      setMapCenter({ lat: pos.lat, lon: pos.lon, zoom: 10 });
    } else if (details?.centroid) {
      const pos = details.centroid as { lat: number; lon: number };
      setMapCenter({ lat: pos.lat, lon: pos.lon, zoom: 10 });
    }

    setIsOpen(false);
  };

  const alertsWithVessel = alerts as AlertWithVessel[];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
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
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-black border border-amber-500/20 shadow-xl z-50 max-h-96 overflow-hidden">
            <div className="p-3 border-b border-gray-700 flex justify-between items-center">
              <span className="font-semibold text-white">Alerts</span>
              <span className="text-xs text-gray-500">{unreadCount} unread</span>
            </div>

            <div className="overflow-y-auto max-h-80">
              {alertsWithVessel.length === 0 ? (
                <div className="p-4 text-gray-400 text-center">No alerts</div>
              ) : (
                alertsWithVessel.slice(0, 20).map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    className={`p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-900 transition-colors ${
                      !alert.readAt ? 'bg-gray-950' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-white">
                        {alert.vesselName || alert.imo}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="mt-1">
                      <AnomalyBadge
                        type={alert.alertType as AnomalyType}
                        confidence="confirmed"
                        size="sm"
                      />
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
