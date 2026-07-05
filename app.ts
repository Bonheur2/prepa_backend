import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './Routes/authRoutes';
import aiRoutes from './Routes/aiRoutes';
import syncRoutes from './Routes/syncRoutes';
import dashboardRoutes from './Routes/dashboardRoutes';
import subjectsRoutes from './Routes/subjectsRoutes';
import topicsRoutes from './Routes/topicsRoutes';
import questionsRoutes from './Routes/questionsRoutes';
import pastPapersRoutes from './Routes/pastPapersRoutes';
import quizzesRoutes from './Routes/quizzesRoutes';
import classesRoutes from './Routes/classesRoutes';
import knowledgeRoutes from './Routes/knowledgeRoutes';

const app: Express = express();

// CORS_ORIGIN is a comma-separated allowlist (e.g. the admin dashboard's
// deployed URL). Bearer-token auth means no cookies are involved, so
// `credentials` is left at its default (false) -- the client just sends
// the Authorization header itself.
//
// With no CORS_ORIGIN set: wide open outside production, so a local web
// dashboard on any port just works during development. Production requires
// an explicit allowlist -- silently allowing all origins there would defeat
// the point of CORS.
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : process.env.NODE_ENV !== 'production',
  })
);

app.use(express.json({ limit: '5mb' }));

// Preserve the pre-migration contract: malformed JSON gets the same JSON error
// shape parseBody produces for a normal validation failure (today, `await
// req.json().catch(() => ({}))` swallows parse failures into zod's normal 400
// path) -- Express's body-parser would otherwise fall through to its own
// plain-text "Bad Request" response instead.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { message: 'Validation failed', issues: [] } });
    return;
  }
  next(err);
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/subjects', subjectsRoutes);
app.use('/api/v1/topics', topicsRoutes);
app.use('/api/v1/questions', questionsRoutes);
app.use('/api/v1/past-papers', pastPapersRoutes);
app.use('/api/v1/quizzes', quizzesRoutes);
app.use('/api/v1/classes', classesRoutes);
app.use('/api/v1/knowledge', knowledgeRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Last-resort net only -- every controller already handles its own errors
// with a route-specific message; this should rarely fire.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
