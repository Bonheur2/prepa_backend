import { Queryable } from '../Config/db';

export async function enroll(db: Queryable, classId: string, studentId: string): Promise<void> {
  await db.query('INSERT INTO class_students (class_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
    classId,
    studentId,
  ]);
}
