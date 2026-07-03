import { Request, Response } from 'express';
import pool from '../Config/db';
import { createClassSchema, joinClassSchema, parseBody } from '../Utils/validation';
import * as ClassModel from '../Models/classModel';
import * as ClassStudentModel from '../Models/classStudentModel';

function generateJoinCode(): string {
  // 6 uppercase alphanumeric chars, no 0/O/1/I -- easy to read aloud and
  // type correctly on a low-end phone keyboard.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function list(req: Request, res: Response) {
  const { userId, role } = req.user!;

  try {
    let classes;
    if (role === 'ADMIN') {
      classes = await ClassModel.listForAdmin(pool);
    } else if (role === 'TEACHER') {
      classes = await ClassModel.listForTeacher(pool, userId);
    } else {
      classes = await ClassModel.listForStudent(pool, userId);
    }
    res.json({ classes });
  } catch (error) {
    console.error('Fetching classes failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function create(req: Request, res: Response) {
  const parsed = parseBody(createClassSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }

  try {
    const { name, level, subject_id, school_id } = parsed.data;

    // Retry on the rare join_code collision instead of trusting one
    // random draw to always be unique.
    let joinCode = generateJoinCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await ClassModel.joinCodeExists(pool, joinCode))) break;
      joinCode = generateJoinCode();
    }

    const cls = await ClassModel.create(pool, {
      name,
      level,
      subjectId: subject_id || null,
      schoolId: school_id || null,
      teacherId: req.user!.userId,
      joinCode,
    });

    res.status(201).json({ class: cls });
  } catch (error) {
    console.error('Creating class failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function join(req: Request, res: Response) {
  const parsed = parseBody(joinClassSchema, req.body);
  if ('error' in parsed) {
    res.status(400).json(parsed.error);
    return;
  }

  try {
    const { join_code } = parsed.data;

    const classId = await ClassModel.findIdByJoinCode(pool, join_code.toUpperCase());
    if (!classId) {
      res.status(404).json({ error: 'Invalid class code' });
      return;
    }

    await ClassStudentModel.enroll(pool, classId, req.user!.userId);

    res.json({ message: 'Joined class successfully', class_id: classId });
  } catch (error) {
    console.error('Joining class failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
