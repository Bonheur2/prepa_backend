import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';

// Any authenticated user (student, teacher, or admin) can pull curriculum
// content -- it's identical for everyone, so it isn't role-restricted.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const lastSync = searchParams.get('last_sync') || '1970-01-01T00:00:00.000Z';

    const [subjects, topics, pastPapers, questions, quizzes, quizQuestions] = await Promise.all([
      pool.query('SELECT * FROM subjects WHERE updated_at > $1', [lastSync]),
      pool.query('SELECT * FROM topics WHERE updated_at > $1', [lastSync]),
      pool.query('SELECT * FROM past_papers WHERE updated_at > $1', [lastSync]),
      pool.query('SELECT * FROM questions WHERE updated_at > $1', [lastSync]),
      pool.query('SELECT * FROM quizzes WHERE updated_at > $1', [lastSync]),
      pool.query(
        `SELECT qq.* FROM quiz_questions qq
         JOIN quizzes q ON q.id = qq.quiz_id
         WHERE q.updated_at > $1`,
        [lastSync]
      ),
    ]);

    // Capture this BEFORE returning so the client's next `last_sync` never
    // skips records written between the query above and the response --
    // it's fine (and expected) for the client to re-fetch a few
    // already-seen rows on the next pull; it must never miss one.
    const serverTimestamp = new Date().toISOString();

    return NextResponse.json({
      server_timestamp: serverTimestamp,
      deltas: {
        subjects: subjects.rows,
        topics: topics.rows,
        past_papers: pastPapers.rows,
        questions: questions.rows,
        quizzes: quizzes.rows,
        quiz_questions: quizQuestions.rows,
      },
    });
  } catch (error) {
    console.error('Sync pull failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
