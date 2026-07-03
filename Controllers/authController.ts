import { Request, Response } from 'express';
import pool from '../Config/db';
import { hashPassword, comparePassword, signToken } from '../Utils/auth';
import {
  registerSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  parseBody,
} from '../Utils/validation';
import * as UserModel from '../Models/userModel';
import * as RevokedTokenModel from '../Models/revokedTokenModel';
import * as PasswordResetTokenModel from '../Models/passwordResetTokenModel';

export async function register(req: Request, res: Response) {
  const parsed = parseBody(registerSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }

  try {
    const { name, email, password, role, level, school_name } = parsed.data;

    const allowedRoles = ['STUDENT', 'TEACHER', 'ADMIN'];
    const finalRole = role && allowedRoles.includes(role) ? role : 'STUDENT';

    if (finalRole === 'STUDENT' && !level) {
      res.status(400).json({ error: 'level (O_LEVEL or A_LEVEL) is required for student accounts' });
      return;
    }

    if (await UserModel.existsByEmail(pool, email)) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const user = await UserModel.createUser(pool, {
      name,
      email,
      passwordHash,
      role: finalRole,
      level: finalRole === 'STUDENT' ? level ?? null : null,
      schoolName: school_name || null,
    });

    const { token } = signToken({ userId: user.id, role: user.role });

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// A bcrypt hash of a random string, used to compare against when no user is
// found -- keeps the response time roughly the same either way, so the
// endpoint doesn't leak which emails are registered via timing.
const DUMMY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8i8vXf3lZW3E0.o4X3dY9dNRE9v9Wa';

export async function login(req: Request, res: Response) {
  const parsed = parseBody(loginSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }

  try {
    const { email, password } = parsed.data;

    const user = await UserModel.findByEmailWithPassword(pool, email);
    const validPassword = await comparePassword(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !validPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const { token } = signToken({ userId: user.id, role: user.role });
    const { password_hash, ...safeUser } = user;

    res.status(200).json({ user: safeUser, token });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function logout(req: Request, res: Response) {
  const { jti, exp, userId } = req.user!;
  if (!exp) {
    // Should never happen -- every token issued by signToken() has an exp.
    res.status(400).json({ error: 'Malformed token' });
    return;
  }

  try {
    await RevokedTokenModel.revoke(pool, jti, userId, exp);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function requestPasswordReset(req: Request, res: Response) {
  const parsed = parseBody(requestPasswordResetSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }

  // Always return the same response whether or not the account exists, so
  // this endpoint can't be used to enumerate registered emails.
  const genericMessage = { message: 'If an account exists for this email, a reset link has been sent.' };

  try {
    const { email } = parsed.data;

    const userId = await UserModel.findIdByEmail(pool, email);
    if (!userId) {
      res.json(genericMessage);
      return;
    }

    const resetToken = await PasswordResetTokenModel.create(pool, userId);

    // TODO: no email provider is wired up yet. Send `resetToken` via a real
    // provider (SES, SendGrid, Postmark, etc.) as a link like
    // `https://yourapp.com/reset-password?token=${resetToken}` instead of
    // logging it. Logging is only here to unblock local development.
    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.json(genericMessage);
  } catch (error) {
    console.error('Password reset request failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function resetPassword(req: Request, res: Response) {
  const parsed = parseBody(resetPasswordSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }
  const { token, new_password } = parsed.data;

  const client = await pool.connect();
  try {
    const userId = await PasswordResetTokenModel.findValidUserId(client, token);
    if (!userId) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const passwordHash = await hashPassword(new_password);

    await client.query('BEGIN');
    await UserModel.updatePasswordHash(client, userId, passwordHash);
    await PasswordResetTokenModel.markUsed(client, token);
    await client.query('COMMIT');

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Password reset failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}
