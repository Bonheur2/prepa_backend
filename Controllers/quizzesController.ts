import { Request, Response } from 'express';
import pool from '../Config/db';
import { createQuizSchema, adaptiveQuizSchema, parseBody } from '../Utils/validation';
import * as QuizModel from '../Models/quizModel';
import * as QuizQuestionModel from '../Models/quizQuestionModel';
import * as LearningGapModel from '../Models/learningGapModel';
import * as TopicModel from '../Models/topicModel';
import * as QuestionModel from '../Models/questionModel';
import * as UserModel from '../Models/userModel';

export async function list(_req: Request, res: Response) {
  try {
    const quizzes = await QuizModel.list(pool);
    res.json({ quizzes });
  } catch (error) {
    console.error('Fetching quizzes failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function create(req: Request, res: Response) {
  const parsed = parseBody(createQuizSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }
  const { title, subject_id, topic_id, level, is_adaptive, question_ids } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const quiz = await QuizModel.create(client, {
      title,
      subjectId: subject_id,
      topicId: topic_id || null,
      level,
      createdBy: req.user!.userId,
      isAdaptive: is_adaptive,
    });

    if (Array.isArray(question_ids)) {
      await QuizQuestionModel.insertMany(client, quiz.id, question_ids);
    }

    await client.query('COMMIT');
    res.status(201).json({ quiz });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Creating quiz failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

export async function generateAdaptive(req: Request, res: Response) {
  const { userId } = req.user!;

  const parsed = parseBody(adaptiveQuizSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }
  const { subject_id, question_count: rawQuestionCount } = parsed.data;
  const question_count = rawQuestionCount ?? 10;

  const client = await pool.connect();
  try {
    // 1. Find the student's weakest tracked topics (lowest mastery first).
    const gaps = await LearningGapModel.findWeakestTopics(client, userId, subject_id || null);

    let topicIds: string[] = gaps.map((r) => r.topic_id);
    let resolvedSubjectId: string | null = subject_id || gaps[0]?.subject_id || null;

    // 2. New students have no tracked gaps yet -- fall back to any topics
    // in the requested subject (or matching the student's level).
    if (topicIds.length === 0) {
      const level = await UserModel.findLevelById(client, userId);
      const fallbackTopics = await TopicModel.findFallbackTopics(client, subject_id || null, level || null);
      topicIds = fallbackTopics.map((r) => r.id);
      resolvedSubjectId = resolvedSubjectId || fallbackTopics[0]?.subject_id || null;
    }

    if (topicIds.length === 0 || !resolvedSubjectId) {
      res.status(404).json({ error: 'No topics available to build a quiz from -- add subjects/topics/questions first' });
      return;
    }

    // 3. Pull questions from those topics, preferring ones the student
    // hasn't answered correctly in the last 7 days -- that's what makes
    // this "adaptive" rather than just a random quiz from the subject.
    let questionIds = await QuestionModel.findCandidatesForAdaptiveQuiz(client, topicIds, userId, question_count);

    // If excluding recently-correct answers leaves too few questions, top
    // up with any remaining questions from the same topics -- a repeat
    // question is better than an under-filled quiz.
    if (questionIds.length < question_count) {
      const topUp = await QuestionModel.findTopUpQuestions(
        client,
        topicIds,
        questionIds,
        question_count - questionIds.length
      );
      questionIds = [...questionIds, ...topUp];
    }

    if (questionIds.length === 0) {
      res.status(404).json({ error: 'No questions exist yet for these topics' });
      return;
    }

    // 4. Persist as a real quiz row so attempts/sync/history all flow
    // through the same path as a teacher-assigned quiz.
    const level = await UserModel.findLevelById(client, userId);

    await client.query('BEGIN');

    const quiz = await QuizModel.create(client, {
      title: `Adaptive Practice - ${new Date().toISOString().slice(0, 10)}`,
      subjectId: resolvedSubjectId,
      topicId: topicIds[0],
      level: level as string,
      createdBy: null,
      isAdaptive: true,
    });

    await QuizQuestionModel.insertMany(client, quiz.id, questionIds);

    await client.query('COMMIT');

    const fullQuestions = await QuizQuestionModel.findFullQuestionsForQuiz(client, quiz.id);

    res.status(201).json({ quiz, questions: fullQuestions });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Adaptive quiz generation failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}
