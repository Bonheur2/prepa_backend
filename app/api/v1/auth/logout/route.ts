import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  const { jti, exp, userId } = auth.user;
  if (!exp) {
    // Should never happen -- every token issued by signToken() has an exp.
    return NextResponse.json({ error: 'Malformed token' }, { status: 400 });
  }

  try {
    await pool.query(
      `INSERT INTO revoked_tokens (jti, user_id, expires_at)
       VALUES ($1, $2, to_timestamp($3))
       ON CONFLICT (jti) DO NOTHING`,
      [jti, userId, exp]
    );

    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
