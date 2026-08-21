import { jwtVerify, SignJWT } from 'jose';

export const SESSION_COOKIE = 'straits_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const ISSUER = 'straits';
const AUDIENCE = 'straits-dashboard';

function secretBytes(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

/**
 * Auth is intentionally opt-in so the zero-config local demo continues to work.
 * A deployment becomes protected when both a real bcrypt hash and a >=32-char
 * JWT secret are configured.
 */
export function isAuthConfigured(): boolean {
  const hash = process.env.PASSWORD_HASH;
  return Boolean(secretBytes() && hash && /^\$2[aby]\$/.test(hash));
}

export async function createSessionToken(): Promise<string> {
  const secret = secretBytes();
  if (!secret) throw new Error('JWT_SECRET must be at least 32 characters');

  return new SignJWT({ role: 'viewer' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject('shared-dashboard')
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret);
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = secretBytes();
  if (!secret) return false;

  try {
    await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    return true;
  } catch {
    return false;
  }
}
