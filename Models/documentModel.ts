import { Queryable } from '../Config/db';

export async function list(db: Queryable, topicId?: string) {
  const result = topicId
    ? await db.query('SELECT * FROM documents WHERE topic_id = $1 AND is_deleted = FALSE ORDER BY updated_at DESC', [
        topicId,
      ])
    : await db.query('SELECT * FROM documents WHERE is_deleted = FALSE ORDER BY updated_at DESC LIMIT 100');
  return result.rows;
}

export async function create(
  db: Queryable,
  data: { title: string; content: string; subjectId: string | null; topicId: string | null; createdBy: string }
) {
  const result = await db.query(
    `INSERT INTO documents (title, content, subject_id, topic_id, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.title, data.content, data.subjectId, data.topicId, data.createdBy]
  );
  return result.rows[0];
}
