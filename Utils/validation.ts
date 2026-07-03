import { z } from 'zod';

export const createSubjectSchema = z.object({
  name: z.string().min(1).max(255),
  level: z.enum(['O_LEVEL', 'A_LEVEL']),
});

export const createTopicSchema = z.object({
  subject_id: z.string().uuid(),
  title: z.string().min(1).max(255),
});

export const adaptiveQuizSchema = z.object({
  subject_id: z.string().uuid().optional(),
  question_count: z.number().int().min(1).max(30).default(10),
});

export const registerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
  level: z.enum(['O_LEVEL', 'A_LEVEL']).optional(),
  school_name: z.string().max(255).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createQuestionSchema = z.object({
  topic_id: z.string().uuid().optional(),
  past_paper_id: z.string().uuid().optional(),
  question_type: z.enum(['MCQ', 'SHORT_ANSWER', 'ESSAY']).optional(),
  question_text: z.string().min(1),
  options: z.array(z.string()).optional(),
  correct_answer: z.string().min(1),
  explanation: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
});

export const createQuizSchema = z.object({
  title: z.string().min(1).max(255),
  subject_id: z.string().uuid(),
  topic_id: z.string().uuid().optional(),
  level: z.enum(['O_LEVEL', 'A_LEVEL']),
  is_adaptive: z.boolean().optional(),
  question_ids: z.array(z.string().uuid()).optional(),
});

export const syncPushSchema = z.object({
  attempts: z
    .array(
      z.object({
        id: z.string().uuid(),
        question_id: z.string().uuid(),
        quiz_id: z.string().uuid().optional().nullable(),
        student_answer: z.string(),
        is_correct: z.boolean(),
        time_spent_seconds: z.number().int().optional().nullable(),
        attempted_at: z.string(),
      })
    )
    .min(1),
});

export const createClassSchema = z.object({
  name: z.string().min(1).max(255),
  level: z.enum(['O_LEVEL', 'A_LEVEL']),
  subject_id: z.string().uuid().optional(),
  school_id: z.string().uuid().optional(),
});

export const joinClassSchema = z.object({
  join_code: z.string().min(4).max(10),
});

export const createPastPaperSchema = z.object({
  subject_id: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  term: z.string().max(50).optional(),
  file_url: z.string().url(),
});

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  subject_id: z.string().uuid().optional(),
  topic_id: z.string().uuid().optional(),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  new_password: z.string().min(8),
});

/**
 * Runs a zod schema against an already-parsed JSON body and returns either
 * the validated data or a ready-to-return 400 payload, so route handlers
 * don't each need their own try/catch + issue formatting.
 */
export function parseBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { data: T } | { error: { message: string; issues: z.ZodIssue[] } } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { error: { message: 'Validation failed', issues: result.error.issues } };
  }
  return { data: result.data };
}
