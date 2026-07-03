import { Request, Response } from 'express';
import pool from '../Config/db';
import * as DashboardModel from '../Models/dashboardModel';

export async function listStudents(req: Request, res: Response) {
  const { userId, role } = req.user!;
  const level = (req.query.level as string) || null;
  const teacherScope = role === 'TEACHER' ? userId : null; // NULL bypasses the scope filter for admins

  try {
    const students = await DashboardModel.studentsOverview(pool, level, teacherScope);
    res.json({ students });
  } catch (error) {
    console.error('Fetching student overview failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getStudent(req: Request, res: Response) {
  const { userId, role } = req.user!;
  const studentId = req.params.id as string;

  try {
    if (role === 'TEACHER' && !(await DashboardModel.teacherHasStudentInClass(pool, studentId, userId))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const [student, learning_gaps, recent_attempts] = await Promise.all([
      DashboardModel.findStudentProfile(pool, studentId),
      DashboardModel.findStudentLearningGaps(pool, studentId),
      DashboardModel.findStudentRecentAttempts(pool, studentId),
    ]);

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    res.json({ student, learning_gaps, recent_attempts });
  } catch (error) {
    console.error('Fetching student detail failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listGaps(req: Request, res: Response) {
  const { userId, role } = req.user!;
  const subjectId = (req.query.subject_id as string) || null;
  const teacherScope = role === 'TEACHER' ? userId : null;

  try {
    const topic_gaps = await DashboardModel.gapsBySubject(pool, subjectId, teacherScope);
    res.json({ topic_gaps });
  } catch (error) {
    console.error('Fetching class-wide gaps failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
