import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';

// Aggregated across tracked students: which topics is the class
// struggling with most, on average? Teachers see only their own
// students' data; admins see everyone.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['TEACHER', 'ADMIN']);
  if ('error' in auth) return auth.error;
  const { userId, role } = auth.user;

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subject_id');
  const teacherScope = role === 'TEACHER' ? userId : null;

  try {
    const result = await pool.query(
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
      [subjectId || null, teacherScope]
    );

    return NextResponse.json({ topic_gaps: result.rows });
  } catch (error) {
    console.error('Fetching class-wide gaps failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
