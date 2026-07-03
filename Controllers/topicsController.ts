import { Request, Response } from 'express';
import pool from '../Config/db';
import { createTopicSchema, parseBody } from '../Utils/validation';
import * as TopicModel from '../Models/topicModel';
import { indexContent } from '../Utils/ragIndexer';

export async function list(req: Request, res: Response) {
  try {
    const topics = await TopicModel.list(pool, req.query.subject_id as string | undefined);
    res.json({ topics });
  } catch (error) {
    console.error('Fetching topics failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function create(req: Request, res: Response) {
  const parsed = parseBody(createTopicSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }
  try {
    const { subject_id, title } = parsed.data;
    if (!(await TopicModel.subjectExists(pool, subject_id))) {
      res.status(404).json({ error: 'subject_id does not exist' });
      return;
    }
    const topic = await TopicModel.create(pool, subject_id, title);
    try {
      await indexContent('topic', topic.id, topic.title, { subjectId: topic.subject_id, topicId: topic.id });
    } catch (err) {
      console.error('Indexing topic for RAG failed (non-fatal):', err);
    }
    res.status(201).json({ topic });
  } catch (error) {
    console.error('Creating topic failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
