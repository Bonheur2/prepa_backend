import { Queryable } from '../Config/db';

export async function create(db: Queryable, userId: string): Promise<string> {
  const result = await db.query(
    `INSERT INTO password_reset_tokens (user_id, expires_at)
     VALUES ($1, CURRENT_TIMESTAMP + INTERVAL '1 hour')
     RETURNING token`,
    [userId]
  );
  return result.rows[0].token;
}

export async function findValidUserId(db: Queryable, token: string): Promise<string | undefined> {
  const result = await db.query(
    `SELECT user_id FROM password_reset_tokens
     WHERE token = $1 AND used = FALSE AND expires_at > CURRENT_TIMESTAMP`,
    [token]
  );
  return result.rows[0]?.user_id;
}

export async function markUsed(db: Queryable, token: string): Promise<void> {
  await db.query('UPDATE password_reset_tokens SET used = TRUE WHERE token = $1', [token]);
}
