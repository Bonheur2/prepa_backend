import { Queryable } from '../Config/db';

export async function list(db: Queryable, topicId?: string) {
  const result = topicId
    ? await db.query('SELECT * FROM questions WHERE topic_id = $1 AND is_deleted = FALSE ORDER BY updated_at DESC', [
        topicId,
      ])
    : await db.query('SELECT * FROM questions WHERE is_deleted = FALSE ORDER BY updated_at DESC LIMIT 100');
  return result.rows;
}

export async function create(
  db: Queryable,
  data: {
    topicId: string | null;
    pastPaperId: string | null;
    questionType: string | null;
    questionText: string;
    options: string[] | undefined;
    correctAnswer: string;
    explanation: string | null;
    difficulty: string | null;
  }
) {
  const result = await db.query(
    `INSERT INTO questions
       (topic_id, past_paper_id, question_type, question_text, options, correct_answer, explanation, difficulty)
     VALUES ($1, $2, COALESCE($3::question_type, 'MCQ'), $4, $5, $6, $7, COALESCE($8::difficulty_tier, 'MEDIUM'))
     RETURNING *`,
    [
      data.topicId,
      data.pastPaperId,
      data.questionType,
      data.questionText,
      data.options ? JSON.stringify(data.options) : null,
      data.correctAnswer,
      data.explanation,
      data.difficulty,
    ]
  );
  return result.rows[0];
}

export async function findUpdatedSince(db: Queryable, since: string) {
  const result = await db.query('SELECT * FROM questions WHERE updated_at > $1', [since]);
  return result.rows;
}

export async function findCandidatesForAdaptiveQuiz(
  db: Queryable,
  topicIds: string[],
  studentId: string,
  count: number
): Promise<string[]> {
  const result = await db.query(
    `SELECT id FROM questions
     WHERE topic_id = ANY($1::uuid[]) AND is_deleted = FALSE
       AND id NOT IN (
         SELECT question_id FROM student_attempts
         WHERE student_id = $2 AND is_correct = TRUE
           AND attempted_at > NOW() - INTERVAL '7 days'
       )
     ORDER BY random()
     LIMIT $3`,
    [topicIds, studentId, count]
  );
  return result.rows.map((r) => r.id);
}

export async function findTopUpQuestions(
  db: Queryable,
  topicIds: string[],
  excludeIds: string[],
  count: number
): Promise<string[]> {
  const result = await db.query(
    `SELECT id FROM questions
     WHERE topic_id = ANY($1::uuid[]) AND is_deleted = FALSE AND id != ALL($2::uuid[])
     ORDER BY random()
     LIMIT $3`,
    [topicIds, excludeIds, count]
  );
  return result.rows.map((r) => r.id);
}
