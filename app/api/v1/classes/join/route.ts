import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';
import { joinClassSchema, parseBody } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['STUDENT']);
  if ('error' in auth) return auth.error;

  const parsed = parseBody(joinClassSchema, await req.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json(parsed.error, { status: 400 });
  }

  try {
    const { join_code } = parsed.data;

    const classResult = await pool.query(
      'SELECT id FROM classes WHERE join_code = $1 AND is_deleted = FALSE',
      [join_code.toUpperCase()]
    );
    if (classResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid class code' }, { status: 404 });
    }
    const classId = classResult.rows[0].id;

    await pool.query(
      'INSERT INTO class_students (class_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [classId, auth.user.userId]
    );

    return NextResponse.json({ message: 'Joined class successfully', class_id: classId });
  } catch (error) {
    console.error('Joining class failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
