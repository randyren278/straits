/**
 * NotificationBell component tests.
 * Validates the per-user alert inbox: fetches /api/alerts with the X-User-Id
 * header and renders the joined vessel name.
 * Requirements: HIST-02
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { NotificationBell } from './NotificationBell';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const mockAlerts = [
  {
    id: 1,
    imo: '9876543',
    alertType: 'going_dark',
    triggeredAt: '2025-06-01T12:00:00Z',
    readAt: null,
    details: {},
    vesselName: 'STORM PETREL',
    flag: 'PA',
  },
  {
    id: 2,
    imo: '1234567',
    alertType: 'loitering',
    triggeredAt: '2025-06-02T08:30:00Z',
    readAt: '2025-06-02T09:00:00Z',
    details: {},
    vesselName: 'DARK WAVE',
    flag: 'IR',
  },
];

describe('NotificationBell', () => {
  beforeEach(() => {
    window.localStorage.clear();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      })),
    );
  });

  it('fetches /api/alerts with the X-User-Id header and renders vessel names', async () => {
    render(<NotificationBell />);

    // The deferred initial fetch runs on a 0ms timeout, after the component
    // has generated and persisted a user id.
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/alerts');

    // The header must carry the persisted per-user id (non-empty UUID).
    const sentUserId = options.headers['X-User-Id'];
    expect(typeof sentUserId).toBe('string');
    expect(sentUserId).toBeTruthy();
    expect(window.localStorage.getItem('tanker_tracker_user_id')).toBe(sentUserId);

    // Unread badge reflects the single unread alert.
    await waitFor(() => {
      expect(
        screen.getByLabelText(/Notifications \(1 unread\)/),
      ).toBeInTheDocument();
    });

    // Open the dropdown and assert the joined vessel name renders.
    screen.getByLabelText(/Notifications/).click();
    await waitFor(() => {
      expect(screen.getByText('STORM PETREL')).toBeInTheDocument();
    });
    expect(screen.getByText('DARK WAVE')).toBeInTheDocument();
  });
});
