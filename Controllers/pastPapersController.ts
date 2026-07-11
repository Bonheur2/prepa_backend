import { Request, Response } from 'express';
import pool from '../Config/db';
import { createPastPaperSchema, createPastPaperUploadSchema, parseBody } from '../Utils/validation';
import * as PastPaperModel from '../Models/pastPaperModel';
import { uploadPdf } from '../Utils/storage';
import { extractPdfText } from '../Utils/pdfExtract';
import { indexContent } from '../Utils/ragIndexer';

export async function list(req: Request, res: Response) {
  try {
    const past_papers = await PastPaperModel.list(pool, req.query.subject_id as string | undefined);
    res.json({ past_papers });
  } catch (error) {
    console.error('Fetching past papers failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function create(req: Request, res: Response) {
  const parsed = parseBody(createPastPaperSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }

  try {
    const { subject_id, year, term, file_url } = parsed.data;
    const past_paper = await PastPaperModel.create(pool, {
      subjectId: subject_id,
      year,
      term: term || null,
      fileUrl: file_url,
    });
    res.status(201).json({ past_paper });
  } catch (error) {
    console.error('Creating past paper failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createFromUpload(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({ error: 'file is required' });
    return;
  }

  const parsed = parseBody(createPastPaperUploadSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }

  try {
    const { subject_id, year, term } = parsed.data;
    const file_url = await uploadPdf(req.file.buffer, 'past-papers');
    const past_paper = await PastPaperModel.create(pool, {
      subjectId: subject_id,
      year,
      term: term || null,
      fileUrl: file_url,
    });

    try {
      const text = await extractPdfText(req.file.buffer);
      if (text) {
        await indexContent('past_paper', past_paper.id, text, { subjectId: subject_id, topicId: null });
      }
    } catch (err) {
      console.error('Indexing past paper for RAG failed (non-fatal):', err);
    }

    res.status(201).json({ past_paper });
  } catch (error) {
    console.error('Uploading past paper failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
