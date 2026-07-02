import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';
import { createQuestionSchema, parseBody } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get('topic_id');

  try {
    const result = topicId
      ? await pool.query(
          'SELECT * FROM questions WHERE topic_id = $1 AND is_deleted = FALSE ORDER BY updated_at DESC',
          [topicId]
        )
      : await pool.query(
          'SELECT * FROM questions WHERE is_deleted = FALSE ORDER BY updated_at DESC LIMIT 100'
        );

    return NextResponse.json({ questions: result.rows });
  } catch (error) {
    console.error('Fetching questions failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['TEACHER', 'ADMIN']);
  if ('error' in auth) return auth.error;

  const parsed = parseBody(createQuestionSchema, await req.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json(parsed.error, { status: 400 });
  }

  try {
    const {
      topic_id,
      past_paper_id,
      question_type,
      question_text,
      options,
      correct_answer,
      explanation,
      difficulty,
    } = parsed.data;

    const result = await pool.query(
      `INSERT INTO questions
         (topic_id, past_paper_id, question_type, question_text, options, correct_answer, explanation, difficulty)
       VALUES ($1, $2, COALESCE($3, 'MCQ'), $4, $5, $6, $7, COALESCE($8, 'MEDIUM'))
       RETURNING *`,
      [
        topic_id || null,
        past_paper_id || null,
        question_type || null,
        question_text,
        options ? JSON.stringify(options) : null,
        correct_answer,
        explanation || null,
        difficulty || null,
      ]
    );

    return NextResponse.json({ question: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Creating question failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
