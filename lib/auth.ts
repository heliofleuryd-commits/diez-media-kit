import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.ADMIN_PASSWORD || 'dev-secret-change-me'
);

const COOKIE = 'admin_token';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function signToken() {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string) {
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function getAdminToken() {
  const jar = await cookies();
  return jar.get(COOKIE)?.value;
}

export async function isAuthenticated() {
  const token = await getAdminToken();
  if (!token) return false;
  return verifyToken(token);
}

export { COOKIE, MAX_AGE };
