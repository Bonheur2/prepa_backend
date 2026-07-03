import { Queryable } from '../Config/db';
import { UserRole } from '../Utils/auth';

export async function existsByEmail(db: Queryable, email: string): Promise<boolean> {
  const result = await db.query('SELECT id FROM users WHERE email = $1 AND is_deleted = FALSE', [email]);
  return result.rows.length > 0;
}

export async function createUser(
  db: Queryable,
  data: {
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    level: string | null;
    schoolName: string | null;
  }
) {
  const result = await db.query(
    `INSERT INTO users (name, email, password_hash, role, level, school_name)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, role, level, school_name, created_at`,
    [data.name, data.email, data.passwordHash, data.role, data.level, data.schoolName]
  );
  return result.rows[0];
}

export async function findByEmailWithPassword(db: Queryable, email: string) {
  const result = await db.query(
    `SELECT id, name, email, password_hash, role, level FROM users
     WHERE email = $1 AND is_deleted = FALSE`,
    [email]
  );
  return result.rows[0] as
    | { id: string; name: string; email: string; password_hash: string; role: UserRole; level: string | null }
    | undefined;
}

export async function findIdByEmail(db: Queryable, email: string): Promise<string | undefined> {
  const result = await db.query('SELECT id FROM users WHERE email = $1 AND is_deleted = FALSE', [email]);
  return result.rows[0]?.id;
}

export async function updatePasswordHash(db: Queryable, userId: string, passwordHash: string): Promise<void> {
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
}

export async function findLevelById(db: Queryable, userId: string): Promise<string | undefined> {
  const result = await db.query('SELECT level FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.level;
}
