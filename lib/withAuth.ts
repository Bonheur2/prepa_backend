import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, AuthTokenPayload, UserRole } from './auth';
import pool from './db';

function getRawToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

type AuthResult = { user: AuthTokenPayload } | { error: NextResponse };

/**
 * Verifies the request's JWT, confirms it hasn't been revoked (logout),
 * and optionally restricts it to specific roles.
 *
 * This does one DB lookup per authenticated request -- an intentional
 * tradeoff. A stateless JWT can't otherwise support real logout; without
 * this check, a "logged out" token would keep working until its 30-day
 * expiry. If this ever becomes a bottleneck, cache revocation checks in
 * Redis instead of hitting Postgres directly.
 */
export async function requireAuth(req: NextRequest, allowedRoles?: UserRole[]): Promise<AuthResult> {
  const token = getRawToken(req);
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  let payload: AuthTokenPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const revoked = await pool.query('SELECT 1 FROM revoked_tokens WHERE jti = $1', [payload.jti]);
  if (revoked.rows.length > 0) {
    return { error: NextResponse.json({ error: 'Session has been logged out' }, { status: 401 }) };
  }

  if (allowedRoles && !allowedRoles.includes(payload.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user: payload };
}
