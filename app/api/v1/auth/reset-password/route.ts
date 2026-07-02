import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { resetPasswordSchema, parseBody } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const parsed = parseBody(resetPasswordSchema, await req.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json(parsed.error, { status: 400 });
  }
  const { token, new_password } = parsed.data;

  const client = await pool.connect();
  try {
    const tokenResult = await client.query(
      `SELECT user_id FROM password_reset_tokens
       WHERE token = $1 AND used = FALSE AND expires_at > CURRENT_TIMESTAMP`,
      [token]
    );
    if (tokenResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    const userId = tokenResult.rows[0].user_id;
    const passwordHash = await hashPassword(new_password);

    await client.query('BEGIN');
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await client.query('UPDATE password_reset_tokens SET used = TRUE WHERE token = $1', [token]);
    await client.query('COMMIT');

    return NextResponse.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Password reset failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
