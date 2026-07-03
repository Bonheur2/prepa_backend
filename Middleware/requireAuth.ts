import { Request, Response, NextFunction } from 'express';
import { verifyToken, AuthTokenPayload, UserRole } from '../Utils/auth';
import pool from '../Config/db';
import * as RevokedTokenModel from '../Models/revokedTokenModel';

function getRawToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

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
export function requireAuth(allowedRoles?: UserRole[]) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = getRawToken(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let payload: AuthTokenPayload;
    try {
      payload = verifyToken(token);
    } catch {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      if (await RevokedTokenModel.isRevoked(pool, payload.jti)) {
        res.status(401).json({ error: 'Session has been logged out' });
        return;
      }
    } catch (error) {
      console.error('Auth revocation check failed:', error);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    if (allowedRoles && !allowedRoles.includes(payload.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    req.user = payload;
    next();
  };
}
