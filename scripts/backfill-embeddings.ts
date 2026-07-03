import '../env';
import pool from '../Config/db';
import { indexContent } from '../Utils/ragIndexer';

async function main() {
  const topics = await pool.query('SELECT id, subject_id, title FROM topics WHERE is_deleted = FALSE');
  for (const t of topics.rows) {
    await indexContent('topic', t.id, t.title, { subjectId: t.subject_id, topicId: t.id });
  }

  const questions = await pool.query(
    'SELECT id, topic_id, question_type, question_text, correct_answer, explanation FROM questions WHERE is_deleted = FALSE'
  );
  for (const q of questions.rows) {
    const content =
      `[${q.question_type}] ${q.question_text}\nAnswer: ${q.correct_answer}` +
      (q.explanation ? `\nExplanation: ${q.explanation}` : '');
    await indexContent('question', q.id, content, { topicId: q.topic_id });
  }

  console.log(`Backfilled ${topics.rows.length} topics and ${questions.rows.length} questions.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
