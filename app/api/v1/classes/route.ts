import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';
import { createClassSchema, parseBody } from '@/lib/validation';

function generateJoinCode(): string {
  // 6 uppercase alphanumeric chars, no 0/O/1/I -- easy to read aloud and
  // type correctly on a low-end phone keyboard.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  const { userId, role } = auth.user;

  try {
    let result;
    if (role === 'ADMIN') {
      result = await pool.query('SELECT * FROM classes WHERE is_deleted = FALSE ORDER BY updated_at DESC');
    } else if (role === 'TEACHER') {
      result = await pool.query(
        'SELECT * FROM classes WHERE teacher_id = $1 AND is_deleted = FALSE ORDER BY updated_at DESC',
        [userId]
      );
    } else {
      result = await pool.query(
        `SELECT c.* FROM classes c
         JOIN class_students cs ON cs.class_id = c.id
         WHERE cs.student_id = $1 AND c.is_deleted = FALSE`,
        [userId]
      );
    }
    return NextResponse.json({ classes: result.rows });
  } catch (error) {
    console.error('Fetching classes failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['TEACHER', 'ADMIN']);
  if ('error' in auth) return auth.error;

  const parsed = parseBody(createClassSchema, await req.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json(parsed.error, { status: 400 });
  }

  try {
    const { name, level, subject_id, school_id } = parsed.data;

    // Retry on the rare join_code collision instead of trusting one
    // random draw to always be unique.
    let joinCode = generateJoinCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await pool.query('SELECT 1 FROM classes WHERE join_code = $1', [joinCode]);
      if (exists.rows.length === 0) break;
      joinCode = generateJoinCode();
    }

    const result = await pool.query(
      `INSERT INTO classes (name, level, subject_id, school_id, teacher_id, join_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, level, subject_id || null, school_id || null, auth.user.userId, joinCode]
    );

    return NextResponse.json({ class: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Creating class failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
