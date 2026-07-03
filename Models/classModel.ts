import { Queryable } from '../Config/db';

export async function listForAdmin(db: Queryable) {
  const result = await db.query('SELECT * FROM classes WHERE is_deleted = FALSE ORDER BY updated_at DESC');
  return result.rows;
}

export async function listForTeacher(db: Queryable, teacherId: string) {
  const result = await db.query(
    'SELECT * FROM classes WHERE teacher_id = $1 AND is_deleted = FALSE ORDER BY updated_at DESC',
    [teacherId]
  );
  return result.rows;
}

export async function listForStudent(db: Queryable, studentId: string) {
  const result = await db.query(
    `SELECT c.* FROM classes c
     JOIN class_students cs ON cs.class_id = c.id
     WHERE cs.student_id = $1 AND c.is_deleted = FALSE`,
    [studentId]
  );
  return result.rows;
}

export async function joinCodeExists(db: Queryable, joinCode: string): Promise<boolean> {
  const result = await db.query('SELECT 1 FROM classes WHERE join_code = $1', [joinCode]);
  return result.rows.length > 0;
}

export async function create(
  db: Queryable,
  data: {
    name: string;
    level: string;
    subjectId: string | null;
    schoolId: string | null;
    teacherId: string;
    joinCode: string;
  }
) {
  const result = await db.query(
    `INSERT INTO classes (name, level, subject_id, school_id, teacher_id, join_code)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.name, data.level, data.subjectId, data.schoolId, data.teacherId, data.joinCode]
  );
  return result.rows[0];
}

export async function findIdByJoinCode(db: Queryable, joinCode: string): Promise<string | undefined> {
  const result = await db.query('SELECT id FROM classes WHERE join_code = $1 AND is_deleted = FALSE', [joinCode]);
  return result.rows[0]?.id;
}
