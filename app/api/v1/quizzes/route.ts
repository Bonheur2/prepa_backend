import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';
import { createQuizSchema, parseBody } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const result = await pool.query(
      'SELECT * FROM quizzes WHERE is_deleted = FALSE ORDER BY updated_at DESC LIMIT 50'
    );
    return NextResponse.json({ quizzes: result.rows });
  } catch (error) {
    console.error('Fetching quizzes failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['TEACHER', 'ADMIN']);
  if ('error' in auth) return auth.error;

  const parsed = parseBody(createQuizSchema, await req.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json(parsed.error, { status: 400 });
  }
  const { title, subject_id, topic_id, level, is_adaptive, question_ids } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const quizResult = await client.query(
      `INSERT INTO quizzes (title, subject_id, topic_id, level, created_by, is_adaptive)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE))
       RETURNING *`,
      [title, subject_id, topic_id || null, level, auth.user.userId, is_adaptive]
    );
    const quiz = quizResult.rows[0];

    if (Array.isArray(question_ids)) {
      for (let i = 0; i < question_ids.length; i++) {
        await client.query(
          'INSERT INTO quiz_questions (quiz_id, question_id, order_index) VALUES ($1, $2, $3)',
          [quiz.id, question_ids[i], i]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ quiz }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Creating quiz failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
