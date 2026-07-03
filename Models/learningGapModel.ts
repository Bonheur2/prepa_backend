import { Queryable } from '../Config/db';

export async function findWeakestTopics(db: Queryable, studentId: string, subjectId: string | null) {
  const result = await db.query(
    `SELECT lg.topic_id, t.subject_id
     FROM learning_gaps lg
     JOIN topics t ON t.id = lg.topic_id
     WHERE lg.student_id = $1
       AND ($2::uuid IS NULL OR t.subject_id = $2)
     ORDER BY lg.mastery_score ASC
     LIMIT 5`,
    [studentId, subjectId]
  );
  return result.rows as { topic_id: string; subject_id: string }[];
}

// Rolls a graded attempt into a running mastery score (0-100) for the
// question's topic -- resolves topic_id via a join to `questions` rather
// than taking it directly, and no-ops if the question has no topic_id.
export async function upsertMasteryForQuestion(
  db: Queryable,
  studentId: string,
  isCorrect: boolean,
  questionId: string
): Promise<void> {
  await db.query(
    `INSERT INTO learning_gaps (student_id, topic_id, mastery_score, attempts_count, last_reviewed_at)
     SELECT $1, q.topic_id, CASE WHEN $2 THEN 100 ELSE 0 END, 1, CURRENT_TIMESTAMP
     FROM questions q WHERE q.id = $3 AND q.topic_id IS NOT NULL
     ON CONFLICT (student_id, topic_id) DO UPDATE SET
       mastery_score = (learning_gaps.mastery_score * learning_gaps.attempts_count
                         + CASE WHEN $2 THEN 100 ELSE 0 END) / (learning_gaps.attempts_count + 1),
       attempts_count = learning_gaps.attempts_count + 1,
       last_reviewed_at = CURRENT_TIMESTAMP`,
    [studentId, isCorrect, questionId]
  );
}
