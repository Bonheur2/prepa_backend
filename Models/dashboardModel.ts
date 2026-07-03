import { Queryable } from '../Config/db';

// Overview list for a teacher/admin: every student, sorted by weakest
// average mastery first. Teachers only see students enrolled in one of
// their own classes; admins see everyone.
export async function studentsOverview(db: Queryable, level: string | null, teacherScope: string | null) {
  const result = await db.query(
    `SELECT
       u.id, u.name, u.email, u.level, u.school_name,
       COUNT(DISTINCT sa.id) AS total_attempts,
       COALESCE(ROUND(AVG(CASE WHEN sa.is_correct THEN 100 ELSE 0 END)), 0) AS accuracy_pct,
       COALESCE(ROUND(AVG(lg.mastery_score)), 0) AS avg_mastery
     FROM users u
     LEFT JOIN student_attempts sa ON sa.student_id = u.id
     LEFT JOIN learning_gaps lg ON lg.student_id = u.id
     WHERE u.role = 'STUDENT' AND u.is_deleted = FALSE
       AND ($1::academic_level IS NULL OR u.level = $1)
       AND ($2::uuid IS NULL OR u.id IN (
         SELECT cs.student_id FROM class_students cs
         JOIN classes c ON c.id = cs.class_id
         WHERE c.teacher_id = $2
       ))
     GROUP BY u.id
     ORDER BY avg_mastery ASC
     LIMIT 100`,
    [level, teacherScope]
  );
  return result.rows;
}

// Teachers can only drill into students enrolled in one of their own
// classes -- without this check, any teacher account could pull any
// student's detailed history by id.
export async function teacherHasStudentInClass(db: Queryable, studentId: string, teacherId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM class_students cs
     JOIN classes c ON c.id = cs.class_id
     WHERE cs.student_id = $1 AND c.teacher_id = $2`,
    [studentId, teacherId]
  );
  return result.rows.length > 0;
}

export async function findStudentProfile(db: Queryable, studentId: string) {
  const result = await db.query(
    `SELECT id, name, email, level, school_name FROM users
     WHERE id = $1 AND role = 'STUDENT' AND is_deleted = FALSE`,
    [studentId]
  );
  return result.rows[0];
}

export async function findStudentLearningGaps(db: Queryable, studentId: string) {
  const result = await db.query(
    `SELECT lg.topic_id, t.title AS topic_title, s.name AS subject_name,
            lg.mastery_score, lg.attempts_count, lg.last_reviewed_at
     FROM learning_gaps lg
     JOIN topics t ON t.id = lg.topic_id
     JOIN subjects s ON s.id = t.subject_id
     WHERE lg.student_id = $1
     ORDER BY lg.mastery_score ASC`,
    [studentId]
  );
  return result.rows;
}

export async function findStudentRecentAttempts(db: Queryable, studentId: string) {
  const result = await db.query(
    `SELECT sa.id, sa.question_id, q.question_text, sa.student_answer,
            sa.is_correct, sa.attempted_at
     FROM student_attempts sa
     JOIN questions q ON q.id = sa.question_id
     WHERE sa.student_id = $1
     ORDER BY sa.attempted_at DESC
     LIMIT 20`,
    [studentId]
  );
  return result.rows;
}

// Aggregated across tracked students: which topics is the class
// struggling with most, on average? Teachers see only their own
// students' data; admins see everyone.
export async function gapsBySubject(db: Queryable, subjectId: string | null, teacherScope: string | null) {
  const result = await db.query(
    `SELECT
       t.id AS topic_id, t.title, s.name AS subject_name, s.level,
       COUNT(DISTINCT lg.student_id) AS students_tracked,
       ROUND(AVG(lg.mastery_score)) AS avg_mastery
     FROM learning_gaps lg
     JOIN topics t ON t.id = lg.topic_id
     JOIN subjects s ON s.id = t.subject_id
     WHERE ($1::uuid IS NULL OR s.id = $1)
       AND ($2::uuid IS NULL OR lg.student_id IN (
         SELECT cs.student_id FROM class_students cs
         JOIN classes c ON c.id = cs.class_id
         WHERE c.teacher_id = $2
       ))
     GROUP BY t.id, t.title, s.name, s.level
     ORDER BY avg_mastery ASC
     LIMIT 50`,
    [subjectId, teacherScope]
  );
  return result.rows;
}
