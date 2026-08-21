import { afterEach, describe, expect, it } from 'vitest';
import {
  createSessionToken,
  isAuthConfigured,
  verifySessionToken,
} from './session';

const originalJwtSecret = process.env.JWT_SECRET;
const originalPasswordHash = process.env.PASSWORD_HASH;

afterEach(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;

  if (originalPasswordHash === undefined) delete process.env.PASSWORD_HASH;
  else process.env.PASSWORD_HASH = originalPasswordHash;
});

describe('shared-dashboard sessions', () => {
  it('only enables auth when both deployment secrets look valid', () => {
    delete process.env.JWT_SECRET;
    delete process.env.PASSWORD_HASH;
    expect(isAuthConfigured()).toBe(false);

    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.PASSWORD_HASH = '$2b$10$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuu';
    expect(isAuthConfigured()).toBe(true);
  });

  it('creates a token that verifies with the configured secret', async () => {
    process.env.JWT_SECRET = 's'.repeat(48);
    process.env.PASSWORD_HASH = '$2b$10$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuu';

    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it('rejects missing, malformed, and differently-signed tokens', async () => {
    process.env.JWT_SECRET = 'a'.repeat(48);
    process.env.PASSWORD_HASH = '$2b$10$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuu';
    const token = await createSessionToken();

    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken('not-a-jwt')).toBe(false);

    process.env.JWT_SECRET = 'b'.repeat(48);
    expect(await verifySessionToken(token)).toBe(false);
  });
});
