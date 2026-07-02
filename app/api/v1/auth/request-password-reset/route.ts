import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requestPasswordResetSchema, parseBody } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const parsed = parseBody(requestPasswordResetSchema, await req.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json(parsed.error, { status: 400 });
  }

  try {
    const { email } = parsed.data;

    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND is_deleted = FALSE',
      [email]
    );

    // Always return the same response whether or not the account exists,
    // so this endpoint can't be used to enumerate registered emails.
    const genericResponse = NextResponse.json({
      message: 'If an account exists for this email, a reset link has been sent.',
    });

    if (userResult.rows.length === 0) {
      return genericResponse;
    }

    const userId = userResult.rows[0].id;
    const tokenResult = await pool.query(
      `INSERT INTO password_reset_tokens (user_id, expires_at)
       VALUES ($1, CURRENT_TIMESTAMP + INTERVAL '1 hour')
       RETURNING token`,
      [userId]
    );
    const resetToken = tokenResult.rows[0].token;

    // TODO: no email provider is wired up yet. Send `resetToken` via a
    // real provider (SES, SendGrid, Postmark, etc.) as a link like
    // `https://yourapp.com/reset-password?token=${resetToken}` instead
    // of logging it. Logging is only here to unblock local development.
    console.log(`Password reset token for ${email}: ${resetToken}`);

    return genericResponse;
  } catch (error) {
    console.error('Password reset request failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
