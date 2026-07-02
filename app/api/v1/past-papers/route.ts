import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';
import { createPastPaperSchema, parseBody } from '@/lib/validation';

// NOTE: this stores a reference (file_url) to a PDF hosted externally --
// it does not handle the actual file upload. Wiring up real upload
// (multipart/form-data -> S3/Cloudinary/etc.) needs storage credentials
// this environment doesn't have; add an `/upload` route once you've
// picked a provider, and have it return a file_url to pass in here.

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subject_id');

  try {
    const result = subjectId
      ? await pool.query(
          'SELECT * FROM past_papers WHERE subject_id = $1 AND is_deleted = FALSE ORDER BY year DESC',
          [subjectId]
        )
      : await pool.query('SELECT * FROM past_papers WHERE is_deleted = FALSE ORDER BY year DESC LIMIT 100');

    return NextResponse.json({ past_papers: result.rows });
  } catch (error) {
    console.error('Fetching past papers failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['TEACHER', 'ADMIN']);
  if ('error' in auth) return auth.error;

  const parsed = parseBody(createPastPaperSchema, await req.json().catch(() => ({})));
  if ('error' in parsed) {
    return NextResponse.json(parsed.error, { status: 400 });
  }

  try {
    const { subject_id, year, term, file_url } = parsed.data;
    const result = await pool.query(
      'INSERT INTO past_papers (subject_id, year, term, file_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [subject_id, year, term || null, file_url]
    );
    return NextResponse.json({ past_paper: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Creating past paper failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
