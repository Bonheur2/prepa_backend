# PREPA Backend

Express (TypeScript) API for the PREPA exam-prep platform: auth, offline-sync,
content management, class/school grouping, teacher dashboards, adaptive
quizzes, and the AI tutor.

Structured as Config/Controllers/Models/Middleware/Routes/Utils: Routes wire
each HTTP verb+path to a Controller method; Controllers hold request/response
handling and orchestration; Models are thin functions wrapping the raw `pg`
queries for one table (or, for cross-table reporting like the dashboard, one
read-only concern) -- no ORM. `app.ts` builds the Express app; `server.ts`
starts it.

## Setup

The database is Neon (managed Postgres with the `vector` extension enabled) --
there is no local Postgres container. Run the three files under `db/` against
your Neon database once, in order (`00_schema.sql`, then
`01_classes_auth_pastpapers.sql`, then `02_rag_knowledge_base.sql`), e.g. via
Neon's SQL editor or `psql "$DATABASE_URL" -f db/00_schema.sql` (repeat per
file).

### Option A: Docker (fastest)

```bash
cp .env.example .env.local   # fill in DATABASE_URL (your Neon connection string), JWT_SECRET, GROQ_API_KEY
docker compose up --build
```

Runs the app at `http://localhost:3000`, connecting straight to Neon via
`DATABASE_URL` in `.env.local` (loaded through `env_file` in
`docker-compose.yml`).

### Option B: Local Node

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL (your Neon connection string), JWT_SECRET, GROQ_API_KEY
npm run dev
```

`npm run dev` runs the TypeScript directly via `tsx watch` (auto-restarts on
file changes); `npm run build` compiles with `tsc` to `dist/`; `npm start`
runs the compiled output with plain `node`. Requires Node 22+ (the `pgvector`
npm package's own requirement).

## Auth

All endpoints except `register`/`login`/`request-password-reset`/`reset-password`
require:

```
Authorization: Bearer <token>
```

Tokens are valid for 30 days (students may go long stretches without
connectivity, so short-lived tokens would force unnecessary re-logins).
`POST /auth/logout` revokes the specific token used to call it, via a
server-side revocation check on every subsequent request — see
`Middleware/requireAuth.ts` for why this needs a DB lookup despite JWTs
normally being stateless.

## Endpoints

| Method | Path                                     | Role              | Purpose                                             |
|--------|-------------------------------------------|-------------------|------------------------------------------------------|
| POST   | `/api/v1/auth/register`                   | public            | Create a student/teacher/admin account                |
| POST   | `/api/v1/auth/login`                      | public            | Get a JWT                                             |
| POST   | `/api/v1/auth/logout`                     | any authenticated | Revoke the current token                              |
| POST   | `/api/v1/auth/request-password-reset`     | public            | Issue a reset token (see note below on email)         |
| POST   | `/api/v1/auth/reset-password`             | public            | Consume a reset token, set a new password             |
| GET    | `/api/v1/sync/pull`                       | any authenticated | Curriculum deltas since `?last_sync=`                 |
| POST   | `/api/v1/sync/push`                       | student           | Upload offline quiz attempts (idempotent)              |
| POST   | `/api/v1/ai/tutor`                        | student           | Ask the AI tutor a question (rate-limited)             |
| GET    | `/api/v1/subjects`                        | any authenticated | List subjects                                          |
| POST   | `/api/v1/subjects`                        | teacher/admin     | Create a subject                                       |
| GET    | `/api/v1/topics?subject_id=`              | any authenticated | List topics, optionally filtered by subject            |
| POST   | `/api/v1/topics`                          | teacher/admin     | Create a topic                                         |
| GET    | `/api/v1/questions?topic_id=`             | any authenticated | List questions, optionally filtered by topic           |
| POST   | `/api/v1/questions`                       | teacher/admin     | Add a question                                         |
| GET    | `/api/v1/past-papers?subject_id=`         | any authenticated | List past papers                                       |
| POST   | `/api/v1/past-papers`                     | teacher/admin     | Add a past paper (metadata + externally-hosted file URL)|
| GET    | `/api/v1/quizzes`                         | any authenticated | List quizzes                                           |
| POST   | `/api/v1/quizzes`                         | teacher/admin     | Create a quiz with attached questions                  |
| POST   | `/api/v1/quizzes/adaptive`                | student           | Generate a quiz targeting the student's weak topics    |
| GET    | `/api/v1/classes`                         | any authenticated | List classes (own, taught, or all for admin)           |
| POST   | `/api/v1/classes`                         | teacher/admin     | Create a class, returns a student join code            |
| POST   | `/api/v1/classes/join`                    | student           | Join a class via its join code                         |
| GET    | `/api/v1/dashboard/students?level=`       | teacher/admin     | Class overview: accuracy + mastery per student          |
| GET    | `/api/v1/dashboard/students/:id`          | teacher/admin     | One student's gaps and recent attempts                  |
| GET    | `/api/v1/dashboard/gaps?subject_id=`      | teacher/admin     | Weakest topics, aggregated across a teacher's students   |
| GET    | `/api/v1/knowledge/documents?topic_id=`   | any authenticated | List RAG source documents, optionally filtered by topic |
| POST   | `/api/v1/knowledge/documents`             | teacher/admin     | Add a text document for the AI tutor to draw on         |

### RAG (AI tutor retrieval)

The AI tutor grounds its answers in curriculum content instead of relying purely on the
model's general knowledge. Every `topics`/`questions` row (and every `documents` row, added
via the endpoint above) gets embedded into `knowledge_chunks` on creation via
`indexContent()` in `Utils/ragIndexer.ts`. `past_papers` is excluded — that table only
stores an external `file_url`, no actual text to embed. Embeddings are generated locally
(`@xenova/transformers`, `Xenova/all-MiniLM-L6-v2`, no API key) since Groq -- the tutor's
completion provider -- has no embeddings API of its own, and stored in Postgres via
`pgvector`. On each tutor request, `retrieveContext()` embeds the student's question, runs a
cosine-similarity search (optionally filtered to the current `topic_id`), and folds the top
matches into the system prompt. Retrieval failures degrade gracefully to the tutor's
pre-RAG behavior rather than failing the request.

Existing rows created before this feature existed aren't embedded automatically -- run
`npm run backfill-embeddings` once against a populated database.

**Gotcha for future changes**: `@xenova/transformers` and `pgvector` are both pure-ESM
packages with no CommonJS export. This project compiles to CommonJS, and `tsc` silently
rewrites a plain `import(...)` into a `require(...)` call that throws `ERR_REQUIRE_ESM`
against them -- so both are loaded via the indirect-`Function` trick in
`Utils/dynamicImport.ts` instead. Don't switch either back to a static or plain dynamic
import. Also note `pgvector` requires Node 22+ (see the `Dockerfile`'s `node:22-alpine`).

### Sync design

- **Pull** (`GET /api/v1/sync/pull?last_sync=<ISO8601>`) returns every row
  in curriculum tables where `updated_at > last_sync`, plus a fresh
  `server_timestamp` the client should store and send as `last_sync` next
  time. A DB trigger (see `db/00_schema.sql`) keeps `updated_at` accurate
  without relying on the app layer to set it on every write.
- **Push** (`POST /api/v1/sync/push`) accepts a batch of quiz attempts.
  Each attempt must include a client-generated UUID as its `id` — this is
  what makes retries after a dropped connection safe: resending the same
  attempt updates it instead of creating a duplicate.

### Class/school scoping

Dashboards used to show every student in the database to any teacher —
not useful. Now: a teacher creates a `class` (`POST /api/v1/classes`),
gets back a 6-character `join_code`, and shares it with students, who
self-enroll via `POST /api/v1/classes/join`. Every dashboard endpoint
scopes results to students in the requesting teacher's own classes.
Admins bypass this scope and see everyone.

### Auth hardening

- **Logout**: JWTs can't be revoked by nature — `POST /auth/logout`
  records the token's `jti` in `revoked_tokens`, and `requireAuth` (in
  `lib/withAuth.ts`) checks that table on every request. This costs one
  extra DB query per request; swap for a Redis-backed check if that
  becomes a bottleneck.
- **Password reset**: `request-password-reset` issues a token valid for
  1 hour. **No email provider is wired up** — the token is currently only
  `console.log`'d server-side, which is fine for local development but
  must be replaced with a real email send (SES/SendGrid/Postmark) before
  this goes anywhere near production.

### Adaptive quiz logic

`POST /api/v1/quizzes/adaptive` (body: `{ subject_id?, question_count? }`)
looks up the student's lowest-`mastery_score` topics from `learning_gaps`,
then pulls questions from those topics, preferring ones the student
hasn't answered correctly in the last 7 days. New students with no
tracked gaps yet fall back to any topics in the requested subject/level.
The result is persisted as a normal `quizzes` row (`is_adaptive = TRUE`),
so attempts against it flow through the same sync/push path as a
teacher-assigned quiz.

## Not yet built

- Actual file upload for past papers (currently metadata + externally-
  hosted `file_url` only — needs S3/Cloudinary credentials to go further)
- Real email delivery for password reset (see note above)
- Redis-backed rate limiting (current limiter in `Utils/rateLimit.ts` is
  in-memory, single-instance only)
- Tests
- Production deployment config beyond the local Docker Compose here
  (no CI, no managed-Postgres setup, no secrets management)
#   p r e p a _ b a c k e n d  
 