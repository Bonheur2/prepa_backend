import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req, ['TEACHER', 'ADMIN']);
  if ('error' in auth) return auth.error;
  const { userId, role } = auth.user;
  const studentId = params.id;

  try {
    // Teachers can only drill into students enrolled in one of their own
    // classes -- without this check, any teacher account could pull any
    // student's detailed history by id.
    if (role === 'TEACHER') {
      const accessCheck = await pool.query(
        `SELECT 1 FROM class_students cs
         JOIN classes c ON c.id = cs.class_id
         WHERE cs.student_id = $1 AND c.teacher_id = $2`,
        [studentId, userId]
      );
      if (accessCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const [studentResult, gapsResult, attemptsResult] = await Promise.all([
      pool.query(
        `SELECT id, name, email, level, school_name FROM users
         WHERE id = $1 AND role = 'STUDENT' AND is_deleted = FALSE`,
        [studentId]
      ),
      pool.query(
        `SELECT lg.topic_id, t.title AS topic_title, s.name AS subject_name,
                lg.mastery_score, lg.attempts_count, lg.last_reviewed_at
         FROM learning_gaps lg
         JOIN topics t ON t.id = lg.topic_id
         JOIN subjects s ON s.id = t.subject_id
         WHERE lg.student_id = $1
         ORDER BY lg.mastery_score ASC`,
        [studentId]
      ),
      pool.query(
        `SELECT sa.id, sa.question_id, q.question_text, sa.student_answer,
                sa.is_correct, sa.attempted_at
         FROM student_attempts sa
         JOIN questions q ON q.id = sa.question_id
         WHERE sa.student_id = $1
         ORDER BY sa.attempted_at DESC
         LIMIT 20`,
        [studentId]
      ),
    ]);

    if (studentResult.rows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json({
      student: studentResult.rows[0],
      learning_gaps: gapsResult.rows,
      recent_attempts: attemptsResult.rows,
    });
  } catch (error) {
    console.error('Fetching student detail failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
