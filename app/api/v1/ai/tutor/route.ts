import { NextRequest, NextResponse } from 'next/server';
import openai from '@/lib/aiClient';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';
import { checkRateLimit } from '@/lib/rateLimit';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['STUDENT']);
  if ('error' in auth) return auth.error;
  const { userId } = auth.user;

  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'You have reached the hourly limit for AI tutor questions. Try again soon.' },
      { status: 429 }
    );
  }

  try {
    const { question, topic_id, history } = (await req.json()) as {
      question: string;
      topic_id?: string;
      history?: ChatMessage[];
    };

    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }

    const userResult = await pool.query('SELECT level FROM users WHERE id = $1', [userId]);
    const level = userResult.rows[0]?.level || 'O_LEVEL';

    let topicTitle = 'general revision';
    if (topic_id) {
      const topicResult = await pool.query('SELECT title FROM topics WHERE id = $1', [topic_id]);
      if (topicResult.rows[0]) topicTitle = topicResult.rows[0].title;
    }

    const systemPrompt = `You are "PREPA AI Tutor," an expert Rwandan secondary school teacher
aligned to the REB curriculum. Your student is at the ${level} tier, currently
studying "${topicTitle}."

Rules:
1. Be supportive, patient, and encouraging -- never condescending.
2. If the student makes a conceptual error, guide them toward the answer
   with questions rather than stating it outright, unless they are clearly
   stuck after two attempts.
3. Keep explanations concise -- this may be read on a low-bandwidth device.
4. Format any math using plain-text notation (e.g. x^2, not LaTeX), since
   the mobile client does not render LaTeX.
5. End every response with one short follow-up practice question related
   to what was just discussed.`;

    // Cap history to keep token costs predictable and bounded regardless
    // of how long the client's local conversation log has grown.
    const trimmedHistory = (history || []).slice(-6);

    const completion = await openai.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...trimmedHistory,
        { role: 'user', content: question },
      ],
      temperature: 0.4,
      max_tokens: 500,
    });

    const reply = completion.choices[0]?.message?.content || '';

    await pool.query(
      `INSERT INTO ai_chat_history (student_id, topic_id, question, ai_response, is_synced)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [userId, topic_id || null, question, reply]
    );

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('AI tutor request failed:', error);
    return NextResponse.json({ error: 'AI tutor is temporarily unavailable' }, { status: 500 });
  }
}
