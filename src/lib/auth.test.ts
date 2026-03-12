import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

// Mock environment
vi.stubEnv('JWT_SECRET', 'test-secret-must-be-at-least-32-characters-long');

describe('auth utilities', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('verifyPassword', () => {
    it('returns true for correct password', async () => {
      const hash = await bcrypt.hash('correct-password', 10);
      vi.stubEnv('PASSWORD_HASH', hash);

      const { verifyPassword } = await import('./auth');
      const result = await verifyPassword('correct-password');
      expect(result).toBe(true);
    });

    it('returns false for incorrect password', async () => {
      const hash = await bcrypt.hash('correct-password', 10);
      vi.stubEnv('PASSWORD_HASH', hash);

      const { verifyPassword } = await import('./auth');
      const result = await verifyPassword('wrong-password');
      expect(result).toBe(false);
    });
  });

  describe('session management', () => {
    it('createSession returns valid JWT', async () => {
      const { createSession, verifySession } = await import('./auth');
      const token = await createSession();
      expect(token).toBeTruthy();
      expect(await verifySession(token)).toBe(true);
    });

    it('verifySession rejects invalid token', async () => {
      const { verifySession } = await import('./auth');
      expect(await verifySession('invalid-token')).toBe(false);
    });
  });
});
