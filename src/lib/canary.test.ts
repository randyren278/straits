import { afterEach, describe, expect, it, vi } from 'vitest';
import { appTable, isCanaryEnabled } from './canary';

afterEach(() => vi.unstubAllEnvs());

describe('canary deployment boundary', () => {
  it('enables canary only when explicitly enabled outside production', () => {
    vi.stubEnv('STRAITS_CANARY', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(isCanaryEnabled()).toBe(true);
    expect(appTable('watchlist')).toBe('canary.watchlist');
  });

  it('hard disables canary features in production', () => {
    vi.stubEnv('STRAITS_CANARY', '1');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(isCanaryEnabled()).toBe(false);
    expect(appTable('alerts')).toBe('alerts');
  });

  it('keeps the production table path when the flag is absent', () => {
    vi.stubEnv('STRAITS_CANARY', '0');
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(appTable('performance_samples')).toBe('performance_samples');
  });
});
