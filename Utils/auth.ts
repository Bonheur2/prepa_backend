import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with
  // `undefined` as the secret.
  throw new Error('JWT_SECRET environment variable is not set');
}

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export interface AuthTokenPayload {
  userId: string;
  role: UserRole;
  jti: string;
  exp?: number; // set automatically by jsonwebtoken from `expiresIn`
}

const EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60; // 30 days

export function signToken(payload: { userId: string; role: UserRole }): {
  token: string;
  jti: string;
  expiresAt: Date;
} {
  // Every token gets a unique id so a single session can be revoked
  // (logout) without needing to invalidate every token for the user.
  const jti = randomUUID();
  const token = jwt.sign({ ...payload, jti }, JWT_SECRET as string, {
    expiresIn: EXPIRES_IN_SECONDS,
  });
  const expiresAt = new Date(Date.now() + EXPIRES_IN_SECONDS * 1000);
  return { token, jti, expiresAt };
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET as string) as AuthTokenPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
