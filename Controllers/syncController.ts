import { Request, Response } from 'express';
import pool from '../Config/db';
import { syncPushSchema, parseBody } from '../Utils/validation';
import * as SubjectModel from '../Models/subjectModel';
import * as TopicModel from '../Models/topicModel';
import * as PastPaperModel from '../Models/pastPaperModel';
import * as QuestionModel from '../Models/questionModel';
import * as QuizModel from '../Models/quizModel';
import * as QuizQuestionModel from '../Models/quizQuestionModel';
import * as StudentAttemptModel from '../Models/studentAttemptModel';
import * as LearningGapModel from '../Models/learningGapModel';

// Any authenticated user (student, teacher, or admin) can pull curriculum
// content -- it's identical for everyone, so it isn't role-restricted.
export async function pull(req: Request, res: Response) {
  try {
    const lastSync = (req.query.last_sync as string) || '1970-01-01T00:00:00.000Z';

    const [subjects, topics, pastPapers, questions, quizzes, quizQuestions] = await Promise.all([
      SubjectModel.findUpdatedSince(pool, lastSync),
      TopicModel.findUpdatedSince(pool, lastSync),
      PastPaperModel.findUpdatedSince(pool, lastSync),
      QuestionModel.findUpdatedSince(pool, lastSync),
      QuizModel.findUpdatedSince(pool, lastSync),
      QuizQuestionModel.findForRecentlyUpdatedQuizzes(pool, lastSync),
    ]);

    // Capture this BEFORE returning so the client's next `last_sync` never
    // skips records written between the query above and the response --
    // it's fine (and expected) for the client to re-fetch a few
    // already-seen rows on the next pull; it must never miss one.
    const serverTimestamp = new Date().toISOString();

    res.json({
      server_timestamp: serverTimestamp,
      deltas: {
        subjects,
        topics,
        past_papers: pastPapers,
        questions,
        quizzes,
        quiz_questions: quizQuestions,
      },
    });
  } catch (error) {
    console.error('Sync pull failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function push(req: Request, res: Response) {
  const { userId } = req.user!;

  const parsed = parseBody(syncPushSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }
  const { attempts } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const attempt of attempts) {
      await StudentAttemptModel.upsert(client, {
        id: attempt.id,
        studentId: userId,
        quizId: attempt.quiz_id || null,
        questionId: attempt.question_id,
        studentAnswer: attempt.student_answer,
        isCorrect: attempt.is_correct,
        timeSpentSeconds: attempt.time_spent_seconds || null,
        attemptedAt: attempt.attempted_at,
      });

      // Roll the result into a running mastery score per topic so teacher
      // dashboards reflect offline work as soon as it lands, instead of
      // needing a separate nightly aggregation job.
      await LearningGapModel.upsertMasteryForQuestion(client, userId, attempt.is_correct, attempt.question_id);
    }

    await client.query('COMMIT');

    res.json({ synced: attempts.length, server_timestamp: new Date().toISOString() });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Sync push failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}
