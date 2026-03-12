import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET);

export async function verifyPassword(plaintext: string): Promise<boolean> {
  const hash = process.env.PASSWORD_HASH;
  if (!hash) {
    console.error('PASSWORD_HASH not configured');
    return false;
  }
  return bcrypt.compare(plaintext, hash);
}

export async function createSession(): Promise<string> {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}
