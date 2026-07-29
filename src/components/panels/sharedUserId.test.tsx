/**
 * Cross-component regression test for the shared user-id fix.
 * NotificationBell and WatchlistPanel each mint/read a per-user id on mount;
 * before the useSharedUserId extraction they raced each other into writing
 * two different UUIDs to the same tanker_tracker_user_id localStorage key
 * (WatchlistPanel minted its own random id directly, independent of
 * NotificationBell's module-level cache). This test mounts both together and
 * asserts they converge on one id.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { NotificationBell } from '../ui/NotificationBell';
import { WatchlistPanel } from './WatchlistPanel';
import { useVesselStore } from '@/stores/vessel';
import { __resetSharedUserIdForTests } from '@/lib/hooks/useSharedUserId';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('NotificationBell + WatchlistPanel mounted together', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetSharedUserIdForTests();

    useVesselStore.setState({
      watchlist: [{ userId: '', imo: '9876543', addedAt: new Date(), notes: null }],
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/watchlist')) {
          return { ok: true, json: async () => ({ watchlist: [] }) };
        }
        return { ok: true, json: async () => ({ alerts: [] }) };
      }),
    );
  });

  it('converges on a single user id instead of racing into two', async () => {
    render(
      <>
        <NotificationBell />
        <WatchlistPanel />
      </>,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

    const alertsCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/alerts'));
    const watchlistCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/watchlist'));

    await waitFor(() => {
      expect(alertsCall).toBeTruthy();
      expect(watchlistCall).toBeTruthy();
    });

    const bellUserId = alertsCall![1].headers['X-User-Id'];
    const watchlistUserId = watchlistCall![1].headers['X-User-Id'];

    expect(bellUserId).toBeTruthy();
    expect(bellUserId).toBe(watchlistUserId);
    expect(window.localStorage.getItem('tanker_tracker_user_id')).toBe(bellUserId);
  });
});
