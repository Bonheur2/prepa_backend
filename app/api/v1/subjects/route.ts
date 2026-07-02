import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';
import { createSubjectSchema, parseBody } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const result = await pool.query(
      'SELECT * FROM subjects WHERE is_deleted = FALSE ORDER BY level, name'
    );
    return NextResponse.json({ subjects: result.rows });
  } catch (error) {
    console.error('Fetching subjects failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['TEACHER', 'ADMIN']);
  if ('error' in auth) return auth.error;

  const parsed = parseBody(createSubjectSchema, await req.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json(parsed.error, { status: 400 });
  }

  try {
    const { name, level } = parsed.data;

    const existing = await pool.query(
      'SELECT id FROM subjects WHERE name = $1 AND level = $2 AND is_deleted = FALSE',
      [name, level]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'This subject already exists for this level' }, { status: 409 });
    }

    const result = await pool.query('INSERT INTO subjects (name, level) VALUES ($1, $2) RETURNING *', [
      name,
      level,
    ]);
    return NextResponse.json({ subject: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Creating subject failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
