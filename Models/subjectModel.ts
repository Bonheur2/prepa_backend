import { Queryable } from '../Config/db';

export async function list(db: Queryable) {
  const result = await db.query('SELECT * FROM subjects WHERE is_deleted = FALSE ORDER BY level, name');
  return result.rows;
}

export async function existsByNameLevel(db: Queryable, name: string, level: string): Promise<boolean> {
  const result = await db.query('SELECT id FROM subjects WHERE name = $1 AND level = $2 AND is_deleted = FALSE', [
    name,
    level,
  ]);
  return result.rows.length > 0;
}

export async function create(db: Queryable, name: string, level: string) {
  const result = await db.query('INSERT INTO subjects (name, level) VALUES ($1, $2) RETURNING *', [name, level]);
  return result.rows[0];
}

export async function findUpdatedSince(db: Queryable, since: string) {
  const result = await db.query('SELECT * FROM subjects WHERE updated_at > $1', [since]);
  return result.rows;
}
