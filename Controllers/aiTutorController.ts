import { Request, Response } from 'express';
import openai from '../Utils/aiClient';
import pool from '../Config/db';
import { checkRateLimit } from '../Utils/rateLimit';
import { retrieveContext } from '../Utils/ragIndexer';
import * as UserModel from '../Models/userModel';
import * as TopicModel from '../Models/topicModel';
import * as AiChatHistoryModel from '../Models/aiChatHistoryModel';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function ask(req: Request, res: Response) {
  const { userId } = req.user!;

  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    res.status(429).json({ error: 'You have reached the hourly limit for AI tutor questions. Try again soon.' });
    return;
  }

  try {
    const { question, topic_id, history } = req.body as {
      question: string;
      topic_id?: string;
      history?: ChatMessage[];
    };

    if (!question || question.trim().length === 0) {
      res.status(400).json({ error: 'question is required' });
      return;
    }

    const level = (await UserModel.findLevelById(pool, userId)) || 'O_LEVEL';

    let topicTitle = 'general revision';
    if (topic_id) {
      const title = await TopicModel.findTitleById(pool, topic_id);
      if (title) topicTitle = title;
    }

    let contextBlock = '';
    try {
      const chunks = await retrieveContext(question, { topicId: topic_id, limit: 4 });
      if (chunks.length > 0) {
        contextBlock =
          `\n\nReference material (use only if relevant; don't mention this section to the student):\n` +
          chunks.map((c, i) => `[${i + 1}] ${c}`).join('\n');
      }
    } catch (err) {
      console.error('RAG retrieval failed, continuing without context:', err);
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
   to what was just discussed.${contextBlock}`;

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

    await AiChatHistoryModel.record(pool, userId, topic_id || null, question, reply);

    res.json({ reply });
  } catch (error) {
    console.error('AI tutor request failed:', error);
    res.status(500).json({ error: 'AI tutor is temporarily unavailable' });
  }
}
