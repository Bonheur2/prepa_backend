import { Queryable } from '../Config/db';

export async function upsert(
  db: Queryable,
  attempt: {
    id: string;
    studentId: string;
    quizId: string | null;
    questionId: string;
    studentAnswer: string;
    isCorrect: boolean;
    timeSpentSeconds: number | null;
    attemptedAt: string;
  }
): Promise<void> {
  // ON CONFLICT makes this idempotent: if a flaky connection causes the
  // device to resend an attempt it already pushed, this updates rather
  // than duplicates -- the client-generated id is what makes that safe.
  await db.query(
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
      attempt.studentId,
      attempt.quizId,
      attempt.questionId,
      attempt.studentAnswer,
      attempt.isCorrect,
      attempt.timeSpentSeconds,
      attempt.attemptedAt,
    ]
  );
}
