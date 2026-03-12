/**
 * Watchlist CRUD Tests
 *
 * Test scaffolds for watchlist database operations.
 * These are it.todo() stubs to be implemented with DB mocking later.
 */
import { describe, it } from 'vitest';

describe('addToWatchlist', () => {
  it.todo('adds new vessel to watchlist');
  it.todo('updates notes on conflict (upsert)');
  it.todo('allows null notes');
  it.todo('sets added_at timestamp');
});

describe('removeFromWatchlist', () => {
  it.todo('removes vessel from watchlist');
  it.todo('is idempotent - does not error if not on watchlist');
  it.todo('only removes for specified user');
});

describe('getUserWatchlist', () => {
  it.todo('returns all vessels on user watchlist');
  it.todo('returns entries ordered by added_at DESC');
  it.todo('returns empty array when watchlist empty');
  it.todo('does not return other users watchlist entries');
});

describe('isOnWatchlist', () => {
  it.todo('returns true when vessel is on watchlist');
  it.todo('returns false when vessel not on watchlist');
  it.todo('checks user-specific watchlist');
});

describe('getWatchersForVessel', () => {
  it.todo('returns all user IDs watching vessel');
  it.todo('returns empty array when no watchers');
});
