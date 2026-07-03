import { Queryable } from '../Config/db';

export async function record(
  db: Queryable,
  studentId: string,
  topicId: string | null,
  question: string,
  reply: string
): Promise<void> {
  await db.query(
    `INSERT INTO ai_chat_history (student_id, topic_id, question, ai_response, is_synced)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [studentId, topicId, question, reply]
  );
}
