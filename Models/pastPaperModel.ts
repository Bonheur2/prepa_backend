import { Queryable } from '../Config/db';

export async function list(db: Queryable, subjectId?: string) {
  const result = subjectId
    ? await db.query('SELECT * FROM past_papers WHERE subject_id = $1 AND is_deleted = FALSE ORDER BY year DESC', [
        subjectId,
      ])
    : await db.query('SELECT * FROM past_papers WHERE is_deleted = FALSE ORDER BY year DESC LIMIT 100');
  return result.rows;
}

export async function create(
  db: Queryable,
  data: { subjectId: string; year: number; term: string | null; fileUrl: string }
) {
  const result = await db.query(
    'INSERT INTO past_papers (subject_id, year, term, file_url) VALUES ($1, $2, $3, $4) RETURNING *',
    [data.subjectId, data.year, data.term, data.fileUrl]
  );
  return result.rows[0];
}

export async function findUpdatedSince(db: Queryable, since: string) {
  const result = await db.query('SELECT * FROM past_papers WHERE updated_at > $1', [since]);
  return result.rows;
}
