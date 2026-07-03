import { Request, Response } from 'express';
import pool from '../Config/db';
import { createSubjectSchema, parseBody } from '../Utils/validation';
import * as SubjectModel from '../Models/subjectModel';

export async function list(_req: Request, res: Response) {
  try {
    const subjects = await SubjectModel.list(pool);
    res.json({ subjects });
  } catch (error) {
    console.error('Fetching subjects failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function create(req: Request, res: Response) {
  const parsed = parseBody(createSubjectSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }

  try {
    const { name, level } = parsed.data;

    if (await SubjectModel.existsByNameLevel(pool, name, level)) {
      res.status(409).json({ error: 'This subject already exists for this level' });
      return;
    }

    const subject = await SubjectModel.create(pool, name, level);
    res.status(201).json({ subject });
  } catch (error) {
    console.error('Creating subject failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
