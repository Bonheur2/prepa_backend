import { Queryable } from '../Config/db';

export async function list(db: Queryable) {
  const result = await db.query('SELECT * FROM quizzes WHERE is_deleted = FALSE ORDER BY updated_at DESC LIMIT 50');
  return result.rows;
}

export async function create(
  db: Queryable,
  data: {
    title: string;
    subjectId: string;
    topicId: string | null;
    level: string;
    createdBy: string | null;
    isAdaptive: boolean | undefined;
  }
) {
  const result = await db.query(
    `INSERT INTO quizzes (title, subject_id, topic_id, level, created_by, is_adaptive)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE))
     RETURNING *`,
    [data.title, data.subjectId, data.topicId, data.level, data.createdBy, data.isAdaptive]
  );
  return result.rows[0];
}

export async function findUpdatedSince(db: Queryable, since: string) {
  const result = await db.query('SELECT * FROM quizzes WHERE updated_at > $1', [since]);
  return result.rows;
}
