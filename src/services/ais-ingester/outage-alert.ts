/**
 * outage-alert.ts — decide when a sustained failure deserves a shout.
 *
 * A single bad run is normal noise (a wake-from-sleep, a flaky socket, a
 * momentary DNS blip, a slow external API). A *run* of them is an incident —
 * and the failure mode this exists to prevent is the silent one:
 *
 *   - In August 2026 the upstream AIS provider went dark for 30+ hours while
 *     every harvest still exited 0 and the menu bar read "Last run OK",
 *     because an empty window was only ever a per-run warning.
 *   - Separately, the anomaly detector step failed on 100% of ~30 consecutive
 *     runs with no counter at all — `status.warnings` is per-run and
 *     forgotten the moment the next run overwrites status.json.
 *
 * Both are the same shape of bug (a sustained condition with no memory), so
 * one generic pure function drives both: `computeSustainedAlert`. It also
 * re-notifies periodically while the condition persists, rather than firing
 * once and going quiet for the rest of a multi-day outage — the operator
 * gets a heartbeat, not silence, but still not a notification per window.
 *
 * Pulled out as a pure function (no Date.now(), no filesystem, no
 * websocket) so the edges that actually matter — notify once per threshold
 * crossing, then again only after the re-notify interval — are testable
 * without a real outage to reproduce.
 */

export interface SustainedAlertInput {
  /** True when this run hit the condition being tracked (empty AIS window,
   * detector step failure, etc). */
  failing: boolean;
  /** Consecutive failing runs before this one (carried in status.json). */
  prevCount: number;
  /** Whether the operator has already been notified about the run in progress. */
  prevAlertSent: boolean;
  /** Consecutive failing runs required before the first notification. */
  threshold: number;
  /** Current time, ms since epoch. Passed in (not read internally) so this
   * stays a pure function — callers pass `Date.now()` or a fixed harvest
   * start time. */
  now: number;
  /** ms since epoch of the last notification sent for this streak, or null
   * if none has been sent yet (or the streak has since reset). */
  prevNotifiedAt: number | null;
  /** Minimum gap between re-notifications while the condition persists. */
  renotifyIntervalMs: number;
}

export interface SustainedAlertResult {
  /** Consecutive failing runs including this one; 0 once the run succeeds. */
  count: number;
  /** Whether a notification has been sent for the streak still in progress. */
  alertSent: boolean;
  /** Fire a notification for this run — true on the threshold crossing, then
   * again at most once per `renotifyIntervalMs` while it continues. */
  shouldNotify: boolean;
  /** ms since epoch of the most recent notification (this run's, if it just
   * notified; otherwise carried forward from `prevNotifiedAt`). */
  notifiedAt: number | null;
}

export function computeSustainedAlert({
  failing,
  prevCount,
  prevAlertSent,
  threshold,
  now,
  prevNotifiedAt,
  renotifyIntervalMs,
}: SustainedAlertInput): SustainedAlertResult {
  // Recovery clears everything: the next incident must be able to notify
  // (and re-notify) from scratch, so nothing here persists for the process
  // lifetime — it all lives in status.json per streak.
  if (!failing) {
    return { count: 0, alertSent: false, shouldNotify: false, notifiedAt: null };
  }

  const count = prevCount + 1;
  if (count < threshold) {
    return { count, alertSent: prevAlertSent, shouldNotify: false, notifiedAt: prevNotifiedAt };
  }

  // Threshold reached or already past it: notify on the crossing (prevNotifiedAt
  // is still null then), and again once the re-notify interval has elapsed —
  // a heartbeat while the incident continues, not a single edge-triggered shot,
  // but never more than one notification per interval.
  const dueForRenotify = prevNotifiedAt === null || now - prevNotifiedAt >= renotifyIntervalMs;

  return {
    count,
    alertSent: true,
    shouldNotify: dueForRenotify,
    notifiedAt: dueForRenotify ? now : prevNotifiedAt,
  };
}
