import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';
import { syncPushSchema, parseBody } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['STUDENT']);
  if ('error' in auth) return auth.error;
  const { userId } = auth.user;

  const parsed = parseBody(syncPushSchema, await req.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json(parsed.error, { status: 400 });
  }
  const { attempts } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const attempt of attempts) {
      // ON CONFLICT makes this idempotent: if a flaky connection causes the
      // device to resend an attempt it already pushed, this updates rather
      // than duplicates -- the client-generated id is what makes that safe.
      await client.query(
        `INSERT INTO student_attempts
           (id, student_id, quiz_id, question_id, student_answer, is_correct,
            time_spent_seconds, attempted_at, is_synced)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
         ON CONFLICT (id) DO UPDATE SET
           student_answer = EXCLUDED.student_answer,
           is_correct = EXCLUDED.is_correct,
           is_synced = TRUE`,
        [
          attempt.id,
          userId,
          attempt.quiz_id || null,
          attempt.question_id,
          attempt.student_answer,
          attempt.is_correct,
          attempt.time_spent_seconds || null,
          attempt.attempted_at,
        ]
      );

      // Roll the result into a running mastery score per topic so teacher
      // dashboards reflect offline work as soon as it lands, instead of
      // needing a separate nightly aggregation job.
      await client.query(
        `INSERT INTO learning_gaps (student_id, topic_id, mastery_score, attempts_count, last_reviewed_at)
         SELECT $1, q.topic_id, CASE WHEN $2 THEN 100 ELSE 0 END, 1, CURRENT_TIMESTAMP
         FROM questions q WHERE q.id = $3 AND q.topic_id IS NOT NULL
         ON CONFLICT (student_id, topic_id) DO UPDATE SET
           mastery_score = (learning_gaps.mastery_score * learning_gaps.attempts_count
                             + CASE WHEN $2 THEN 100 ELSE 0 END) / (learning_gaps.attempts_count + 1),
           attempts_count = learning_gaps.attempts_count + 1,
           last_reviewed_at = CURRENT_TIMESTAMP`,
        [userId, attempt.is_correct, attempt.question_id]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({ synced: attempts.length, server_timestamp: new Date().toISOString() });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Sync push failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
