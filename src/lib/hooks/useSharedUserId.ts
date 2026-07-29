'use client';

/**
 * Shared per-browser user id, race-free across every component that mounts
 * more than one instance in the same commit (e.g. NotificationBell/StatusChip
 * per breakpoint). Each instance's "generate if missing" effect would
 * otherwise read/write through its own useLocalStorage state, whose value is
 * still stale (this render's closure) when another instance's effect runs in
 * the same flush — producing two different random ids against the same
 * localStorage key. This module-level cache makes every caller after the
 * first see the first caller's id instead of generating its own.
 */
import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

const USER_ID_KEY = 'tanker_tracker_user_id';

let cachedUserId: string | null = null;

function ensureUserId(current: string): string {
  if (current) return current;
  if (cachedUserId) return cachedUserId;
  const stored = window.localStorage.getItem(USER_ID_KEY);
  const id = stored ?? crypto.randomUUID();
  if (!stored) window.localStorage.setItem(USER_ID_KEY, id);
  cachedUserId = id;
  return id;
}

/** Test-only: clears the module-level cache so tests don't leak state into each other. */
export function __resetSharedUserIdForTests(): void {
  cachedUserId = null;
}

export function useSharedUserId(): [string, (value: string) => void] {
  const [userId, setUserId] = useLocalStorage<string>(USER_ID_KEY, '');

  useEffect(() => {
    if (!userId) {
      const id = ensureUserId(userId);
      if (id !== userId) setUserId(id);
    }
  }, [userId, setUserId]);

  return [userId, setUserId];
}
