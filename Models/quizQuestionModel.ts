import { Queryable } from '../Config/db';

export async function insertMany(db: Queryable, quizId: string, questionIds: string[]): Promise<void> {
  for (let i = 0; i < questionIds.length; i++) {
    await db.query('INSERT INTO quiz_questions (quiz_id, question_id, order_index) VALUES ($1, $2, $3)', [
      quizId,
      questionIds[i],
      i,
    ]);
  }
}

export async function findFullQuestionsForQuiz(db: Queryable, quizId: string) {
  const result = await db.query(
    `SELECT q.* FROM questions q
     JOIN quiz_questions qq ON qq.question_id = q.id
     WHERE qq.quiz_id = $1
     ORDER BY qq.order_index`,
    [quizId]
  );
  return result.rows;
}

export async function findForRecentlyUpdatedQuizzes(db: Queryable, since: string) {
  const result = await db.query(
    `SELECT qq.* FROM quiz_questions qq
     JOIN quizzes q ON q.id = qq.quiz_id
     WHERE q.updated_at > $1`,
    [since]
  );
  return result.rows;
}
