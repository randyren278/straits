/**
 * Anomaly CRUD Tests
 *
 * Test scaffolds for anomaly database operations.
 * These are it.todo() stubs to be implemented with DB mocking later.
 */
import { describe, it } from 'vitest';

describe('upsertAnomaly', () => {
  it.todo('inserts new anomaly when none exists for vessel/type');
  it.todo('updates existing active anomaly with new details');
  it.todo('stores JSONB details correctly');
  it.todo('does not update resolved anomalies');
});

describe('getActiveAnomalies', () => {
  it.todo('returns all active anomalies when no imo filter');
  it.todo('returns only anomalies for specified imo');
  it.todo('excludes resolved anomalies');
  it.todo('orders by detected_at DESC');
  it.todo('returns empty array when no active anomalies');
});

describe('resolveAnomaly', () => {
  it.todo('sets resolved_at to current timestamp');
  it.todo('only resolves matching imo and anomaly_type');
  it.todo('is idempotent - does not error if already resolved');
  it.todo('does not resolve other anomaly types for same vessel');
});

describe('getAnomaliesForVessels', () => {
  it.todo('returns anomalies for multiple imos');
  it.todo('returns empty array for empty imos input');
  it.todo('excludes resolved anomalies');
  it.todo('handles imos with no anomalies');
});
