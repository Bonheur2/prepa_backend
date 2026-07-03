import { Queryable } from '../Config/db';

export async function list(db: Queryable, subjectId?: string) {
  const result = subjectId
    ? await db.query('SELECT * FROM topics WHERE subject_id = $1 AND is_deleted = FALSE ORDER BY title', [subjectId])
    : await db.query('SELECT * FROM topics WHERE is_deleted = FALSE ORDER BY title LIMIT 200');
  return result.rows;
}

export async function findTitleById(db: Queryable, topicId: string): Promise<string | undefined> {
  const result = await db.query('SELECT title FROM topics WHERE id = $1', [topicId]);
  return result.rows[0]?.title;
}

export async function subjectExists(db: Queryable, subjectId: string): Promise<boolean> {
  const result = await db.query('SELECT id FROM subjects WHERE id = $1 AND is_deleted = FALSE', [subjectId]);
  return result.rows.length > 0;
}

export async function create(db: Queryable, subjectId: string, title: string) {
  const result = await db.query('INSERT INTO topics (subject_id, title) VALUES ($1, $2) RETURNING *', [
    subjectId,
    title,
  ]);
  return result.rows[0];
}

export async function findUpdatedSince(db: Queryable, since: string) {
  const result = await db.query('SELECT * FROM topics WHERE updated_at > $1', [since]);
  return result.rows;
}

export async function findFallbackTopics(db: Queryable, subjectId: string | null, level: string | null) {
  const result = await db.query(
    `SELECT t.id, t.subject_id FROM topics t
     JOIN subjects s ON s.id = t.subject_id
     WHERE t.is_deleted = FALSE
       AND ($1::uuid IS NULL OR t.subject_id = $1)
       AND ($2::academic_level IS NULL OR s.level = $2)
     LIMIT 5`,
    [subjectId, level]
  );
  return result.rows as { id: string; subject_id: string }[];
}
