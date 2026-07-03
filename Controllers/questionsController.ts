import { Request, Response } from 'express';
import pool from '../Config/db';
import { createQuestionSchema, parseBody } from '../Utils/validation';
import * as QuestionModel from '../Models/questionModel';
import { indexContent } from '../Utils/ragIndexer';

export async function list(req: Request, res: Response) {
  try {
    const questions = await QuestionModel.list(pool, req.query.topic_id as string | undefined);
    res.json({ questions });
  } catch (error) {
    console.error('Fetching questions failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function create(req: Request, res: Response) {
  const parsed = parseBody(createQuestionSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }

  try {
    const { topic_id, past_paper_id, question_type, question_text, options, correct_answer, explanation, difficulty } =
      parsed.data;

    const question = await QuestionModel.create(pool, {
      topicId: topic_id || null,
      pastPaperId: past_paper_id || null,
      questionType: question_type || null,
      questionText: question_text,
      options,
      correctAnswer: correct_answer,
      explanation: explanation || null,
      difficulty: difficulty || null,
    });

    const content =
      `[${question.question_type}] ${question.question_text}\nAnswer: ${question.correct_answer}` +
      (question.explanation ? `\nExplanation: ${question.explanation}` : '');
    try {
      await indexContent('question', question.id, content, { topicId: question.topic_id });
    } catch (err) {
      console.error('Indexing question for RAG failed (non-fatal):', err);
    }

    res.status(201).json({ question });
  } catch (error) {
    console.error('Creating question failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
