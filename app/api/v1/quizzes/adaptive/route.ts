import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';
import { adaptiveQuizSchema, parseBody } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['STUDENT']);
  if ('error' in auth) return auth.error;
  const { userId } = auth.user;

  const parsed = parseBody(adaptiveQuizSchema, await req.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json(parsed.error, { status: 400 });
  }
  const { subject_id, question_count: rawQuestionCount } = parsed.data;
  const question_count = rawQuestionCount ?? 10;

  const client = await pool.connect();
  try {
    // 1. Find the student's weakest tracked topics (lowest mastery first).
    const gapsResult = await client.query(
      `SELECT lg.topic_id, t.subject_id
       FROM learning_gaps lg
       JOIN topics t ON t.id = lg.topic_id
       WHERE lg.student_id = $1
         AND ($2::uuid IS NULL OR t.subject_id = $2)
       ORDER BY lg.mastery_score ASC
       LIMIT 5`,
      [userId, subject_id || null]
    );

    let topicIds: string[] = gapsResult.rows.map((r) => r.topic_id);
    let resolvedSubjectId: string | null = subject_id || gapsResult.rows[0]?.subject_id || null;

    // 2. New students have no tracked gaps yet -- fall back to any topics
    // in the requested subject (or matching the student's level).
    if (topicIds.length === 0) {
      const userResult = await client.query('SELECT level FROM users WHERE id = $1', [userId]);
      const level = userResult.rows[0]?.level;

      const fallbackTopics = await client.query(
        `SELECT t.id, t.subject_id FROM topics t
         JOIN subjects s ON s.id = t.subject_id
         WHERE t.is_deleted = FALSE
           AND ($1::uuid IS NULL OR t.subject_id = $1)
           AND ($2::academic_level IS NULL OR s.level = $2)
         LIMIT 5`,
        [subject_id || null, level || null]
      );
      topicIds = fallbackTopics.rows.map((r) => r.id);
      resolvedSubjectId = resolvedSubjectId || fallbackTopics.rows[0]?.subject_id || null;
    }

    if (topicIds.length === 0 || !resolvedSubjectId) {
      return NextResponse.json(
        { error: 'No topics available to build a quiz from -- add subjects/topics/questions first' },
        { status: 404 }
      );
    }

    // 3. Pull questions from those topics, preferring ones the student
    // hasn't answered correctly in the last 7 days -- that's what makes
    // this "adaptive" rather than just a random quiz from the subject.
    const questionsResult = await client.query(
      `SELECT id FROM questions
       WHERE topic_id = ANY($1::uuid[]) AND is_deleted = FALSE
         AND id NOT IN (
           SELECT question_id FROM student_attempts
           WHERE student_id = $2 AND is_correct = TRUE
             AND attempted_at > NOW() - INTERVAL '7 days'
         )
       ORDER BY random()
       LIMIT $3`,
      [topicIds, userId, question_count]
    );

    let questionIds: string[] = questionsResult.rows.map((r) => r.id);

    // If excluding recently-correct answers leaves too few questions, top
    // up with any remaining questions from the same topics -- a repeat
    // question is better than an under-filled quiz.
    if (questionIds.length < question_count) {
      const topUp = await client.query(
        `SELECT id FROM questions
         WHERE topic_id = ANY($1::uuid[]) AND is_deleted = FALSE AND id != ALL($2::uuid[])
         ORDER BY random()
         LIMIT $3`,
        [topicIds, questionIds, question_count - questionIds.length]
      );
      questionIds = [...questionIds, ...topUp.rows.map((r) => r.id)];
    }

    if (questionIds.length === 0) {
      return NextResponse.json({ error: 'No questions exist yet for these topics' }, { status: 404 });
    }

    // 4. Persist as a real quiz row so attempts/sync/history all flow
    // through the same path as a teacher-assigned quiz.
    const userResult = await client.query('SELECT level FROM users WHERE id = $1', [userId]);
    const level = userResult.rows[0]?.level;

    await client.query('BEGIN');

    const quizResult = await client.query(
      `INSERT INTO quizzes (title, subject_id, topic_id, level, created_by, is_adaptive)
       VALUES ($1, $2, $3, $4, NULL, TRUE)
       RETURNING *`,
      [`Adaptive Practice - ${new Date().toISOString().slice(0, 10)}`, resolvedSubjectId, topicIds[0], level]
    );
    const quiz = quizResult.rows[0];

    for (let i = 0; i < questionIds.length; i++) {
      await client.query(
        'INSERT INTO quiz_questions (quiz_id, question_id, order_index) VALUES ($1, $2, $3)',
        [quiz.id, questionIds[i], i]
      );
    }

    await client.query('COMMIT');

    const fullQuestions = await client.query(
      `SELECT q.* FROM questions q
       JOIN quiz_questions qq ON qq.question_id = q.id
       WHERE qq.quiz_id = $1
       ORDER BY qq.order_index`,
      [quiz.id]
    );

    return NextResponse.json({ quiz, questions: fullQuestions.rows }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Adaptive quiz generation failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
