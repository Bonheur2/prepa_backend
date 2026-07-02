import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { comparePassword, signToken } from '@/lib/auth';
import { loginSchema, parseBody } from '@/lib/validation';

// A bcrypt hash of a random string, used to compare against when no user
// is found -- keeps the response time roughly the same either way, so the
// endpoint doesn't leak which emails are registered via timing.
const DUMMY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8i8vXf3lZW3E0.o4X3dY9dNRE9v9Wa';

export async function POST(req: NextRequest) {
  const parsed = parseBody(loginSchema, await req.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json(parsed.error, { status: 400 });
  }

  try {
    const { email, password } = parsed.data;

    const result = await pool.query(
      `SELECT id, name, email, password_hash, role, level FROM users
       WHERE email = $1 AND is_deleted = FALSE`,
      [email]
    );
    const user = result.rows[0];

    const validPassword = await comparePassword(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !validPassword) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const { token } = signToken({ userId: user.id, role: user.role });
    const { password_hash, ...safeUser } = user;

    return NextResponse.json({ user: safeUser, token }, { status: 200 });
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
