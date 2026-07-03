import { Queryable } from '../Config/db';

export async function revoke(db: Queryable, jti: string, userId: string, exp: number): Promise<void> {
  await db.query(
    `INSERT INTO revoked_tokens (jti, user_id, expires_at)
     VALUES ($1, $2, to_timestamp($3))
     ON CONFLICT (jti) DO NOTHING`,
    [jti, userId, exp]
  );
}

export async function isRevoked(db: Queryable, jti: string): Promise<boolean> {
  const result = await db.query('SELECT 1 FROM revoked_tokens WHERE jti = $1', [jti]);
  return result.rows.length > 0;
}
