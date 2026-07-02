import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';
import { createTopicSchema, parseBody } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subject_id');

  try {
    const result = subjectId
      ? await pool.query(
          'SELECT * FROM topics WHERE subject_id = $1 AND is_deleted = FALSE ORDER BY title',
          [subjectId]
        )
      : await pool.query('SELECT * FROM topics WHERE is_deleted = FALSE ORDER BY title LIMIT 200');

    return NextResponse.json({ topics: result.rows });
  } catch (error) {
    console.error('Fetching topics failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['TEACHER', 'ADMIN']);
  if ('error' in auth) return auth.error;

  const parsed = parseBody(createTopicSchema, await req.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json(parsed.error, { status: 400 });
  }

  try {
    const { subject_id, title } = parsed.data;

    const subjectExists = await pool.query(
      'SELECT id FROM subjects WHERE id = $1 AND is_deleted = FALSE',
      [subject_id]
    );
    if (subjectExists.rows.length === 0) {
      return NextResponse.json({ error: 'subject_id does not exist' }, { status: 404 });
    }

    const result = await pool.query('INSERT INTO topics (subject_id, title) VALUES ($1, $2) RETURNING *', [
      subject_id,
      title,
    ]);
    return NextResponse.json({ topic: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Creating topic failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
