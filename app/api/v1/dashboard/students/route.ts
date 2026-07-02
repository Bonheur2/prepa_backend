import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';

// Overview list for a teacher/admin: every student, sorted by weakest
// average mastery first. Teachers only see students enrolled in one of
// their own classes; admins see everyone.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['TEACHER', 'ADMIN']);
  if ('error' in auth) return auth.error;
  const { userId, role } = auth.user;

  const { searchParams } = new URL(req.url);
  const level = searchParams.get('level'); // optional: O_LEVEL | A_LEVEL
  const teacherScope = role === 'TEACHER' ? userId : null; // NULL bypasses the scope filter for admins

  try {
    const result = await pool.query(
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
      [level || null, teacherScope]
    );

    return NextResponse.json({ students: result.rows });
  } catch (error) {
    console.error('Fetching student overview failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
