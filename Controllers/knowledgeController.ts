import { Request, Response } from 'express';
import pool from '../Config/db';
import { createDocumentSchema, parseBody } from '../Utils/validation';
import * as DocumentModel from '../Models/documentModel';
import { indexContent } from '../Utils/ragIndexer';

export async function list(req: Request, res: Response) {
  try {
    const documents = await DocumentModel.list(pool, req.query.topic_id as string | undefined);
    res.json({ documents });
  } catch (error) {
    console.error('Fetching documents failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function create(req: Request, res: Response) {
  const parsed = parseBody(createDocumentSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }

  try {
    const { title, content, subject_id, topic_id } = parsed.data;
    const document = await DocumentModel.create(pool, {
      title,
      content,
      subjectId: subject_id || null,
      topicId: topic_id || null,
      createdBy: req.user!.userId,
    });

    try {
      await indexContent('document', document.id, document.content, {
        subjectId: document.subject_id,
        topicId: document.topic_id,
      });
    } catch (err) {
      console.error('Indexing document for RAG failed (non-fatal):', err);
    }

    res.status(201).json({ document });
  } catch (error) {
    console.error('Creating document failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
