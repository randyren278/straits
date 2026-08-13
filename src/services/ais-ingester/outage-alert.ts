/**
 * outage-alert.ts — decide when a sustained AIS drought deserves a shout.
 *
 * A single empty window is normal noise (a wake-from-sleep, a flaky socket, a
 * momentary DNS blip). A *run* of empty windows is an outage — and the failure
 * mode this exists to prevent is the silent one: in August 2026 the upstream
 * provider went dark for 30+ hours while every harvest still exited 0 and the
 * menu bar read "Last run OK", because an empty window was only ever a warning.
 *
 * The logic is pulled out as a pure function so the edge that actually matters
 * — notify once, not once per window — is testable without a websocket, a
 * database, or a real outage to reproduce.
 */

export interface OutageAlertInput {
  /** True when this harvest window landed zero AIS positions. */
  emptyWindow: boolean;
  /** Consecutive empty windows before this one (carried in status.json). */
  prevCount: number;
  /** Whether the operator has already been told about this outage. */
  prevAlertSent: boolean;
  /** Consecutive empty windows required before alerting. */
  threshold: number;
}

export interface OutageAlertResult {
  /** Consecutive empty windows including this one; 0 once data returns. */
  count: number;
  /** Whether an alert has been sent for the outage still in progress. */
  alertSent: boolean;
  /** Fire a notification for this window — true at most once per outage. */
  shouldNotify: boolean;
}

export function computeOutageAlert({
  emptyWindow,
  prevCount,
  prevAlertSent,
  threshold,
}: OutageAlertInput): OutageAlertResult {
  // Recovery re-arms the alarm: the next outage must be able to notify again,
  // so alertSent clears here rather than persisting for the process lifetime.
  if (!emptyWindow) {
    return { count: 0, alertSent: false, shouldNotify: false };
  }

  const count = prevCount + 1;
  const shouldNotify = count >= threshold && !prevAlertSent;

  return {
    count,
    alertSent: prevAlertSent || shouldNotify,
    shouldNotify,
  };
}
