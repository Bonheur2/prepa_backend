import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';
import { registerSchema, parseBody } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const parsed = parseBody(registerSchema, await req.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json(parsed.error, { status: 400 });
  }

  try {
    const { name, email, password, role, level, school_name } = parsed.data;

    const allowedRoles = ['STUDENT', 'TEACHER', 'ADMIN'];
    const finalRole = role && allowedRoles.includes(role) ? role : 'STUDENT';

    if (finalRole === 'STUDENT' && !level) {
      return NextResponse.json(
        { error: 'level (O_LEVEL or A_LEVEL) is required for student accounts' },
        { status: 400 }
      );
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND is_deleted = FALSE', [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, level, school_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, level, school_name, created_at`,
      [name, email, passwordHash, finalRole, finalRole === 'STUDENT' ? level : null, school_name || null]
    );

    const user = result.rows[0];
    const { token } = signToken({ userId: user.id, role: user.role });

    return NextResponse.json({ user, token }, { status: 201 });
  } catch (error) {
    console.error('Registration failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
