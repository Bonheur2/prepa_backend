-- =====================================================================
-- PREPA: National Exam Preparation Platform (REB O-Level / A-Level)
-- PostgreSQL Schema
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 0. UTILITY: auto-update `updated_at` on every row change.
-- Your entire sync strategy depends on updated_at being trustworthy,
-- so don't rely on the app layer to set it correctly -- enforce it here.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
CREATE TYPE user_role       AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');
CREATE TYPE academic_level  AS ENUM ('O_LEVEL', 'A_LEVEL');
CREATE TYPE question_type   AS ENUM ('MCQ', 'SHORT_ANSWER', 'ESSAY');
CREATE TYPE difficulty_tier AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE sync_status     AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- ---------------------------------------------------------------------
-- 2. USERS & ROLES
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role NOT NULL DEFAULT 'STUDENT',
  level         academic_level,          -- NULL for TEACHER/ADMIN
  school_name   VARCHAR(255),
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_deleted    BOOLEAN DEFAULT FALSE
);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 3. CURRICULUM MAPPING
-- ---------------------------------------------------------------------
CREATE TABLE subjects (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(255) NOT NULL,
  level      academic_level NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);
CREATE TRIGGER trg_subjects_updated_at BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE topics (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);
CREATE TRIGGER trg_topics_updated_at BEFORE UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 4. LEARNING MATERIALS
-- ---------------------------------------------------------------------
CREATE TABLE past_papers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  year       INT NOT NULL,
  term       VARCHAR(50),
  file_url   TEXT,                      -- link to PDF, for online download
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);
CREATE TRIGGER trg_past_papers_updated_at BEFORE UPDATE ON past_papers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE questions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  past_paper_id  UUID REFERENCES past_papers(id) ON DELETE SET NULL,
  topic_id       UUID REFERENCES topics(id) ON DELETE SET NULL,
  question_type  question_type NOT NULL DEFAULT 'MCQ',
  question_text  TEXT NOT NULL,
  options        JSONB,                 -- e.g. ["A) ...","B) ...", ...] for MCQ
  correct_answer TEXT NOT NULL,
  explanation    TEXT,
  difficulty     difficulty_tier DEFAULT 'MEDIUM',
  updated_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_deleted     BOOLEAN DEFAULT FALSE
);
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 5. QUIZZES (teacher-assigned or adaptive-generated sets)
-- ---------------------------------------------------------------------
CREATE TABLE quizzes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(255) NOT NULL,
  subject_id  UUID REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id    UUID REFERENCES topics(id) ON DELETE SET NULL,
  level       academic_level NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL, -- teacher, NULL if system-generated
  is_adaptive BOOLEAN DEFAULT FALSE,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_deleted  BOOLEAN DEFAULT FALSE
);
CREATE TRIGGER trg_quizzes_updated_at BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE quiz_questions (
  quiz_id     UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  PRIMARY KEY (quiz_id, question_id)
);

-- ---------------------------------------------------------------------
-- 6. PERFORMANCE TRACKING
-- ---------------------------------------------------------------------
CREATE TABLE student_attempts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  quiz_id       UUID REFERENCES quizzes(id) ON DELETE SET NULL, -- NULL = ad-hoc practice
  question_id   UUID REFERENCES questions(id) ON DELETE CASCADE,
  student_answer TEXT NOT NULL,
  is_correct    BOOLEAN NOT NULL,
  time_spent_seconds INT,
  attempted_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- client-side time of attempt (offline-safe)
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_synced     BOOLEAN DEFAULT FALSE  -- flips true once server has ack'd it
);
CREATE TRIGGER trg_attempts_updated_at BEFORE UPDATE ON student_attempts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE learning_gaps (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  topic_id      UUID REFERENCES topics(id) ON DELETE CASCADE,
  mastery_score NUMERIC(4,1) DEFAULT 0.0, -- 0-100, recalculated from attempts
  attempts_count INT DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, topic_id)
);
CREATE TRIGGER trg_learning_gaps_updated_at BEFORE UPDATE ON learning_gaps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 7. AI TUTOR HISTORY
-- ---------------------------------------------------------------------
CREATE TABLE ai_chat_history (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  topic_id     UUID REFERENCES topics(id) ON DELETE SET NULL,
  question     TEXT NOT NULL,
  ai_response  TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_synced    BOOLEAN DEFAULT FALSE
);
CREATE TRIGGER trg_ai_chat_updated_at BEFORE UPDATE ON ai_chat_history
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 8. SYNC LOGS (audit trail per device, useful for debugging rural drops)
-- ---------------------------------------------------------------------
CREATE TABLE sync_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id     VARCHAR(255) NOT NULL,
  sync_started_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  sync_completed_at TIMESTAMPTZ,
  status        sync_status DEFAULT 'PENDING',
  records_pushed INT DEFAULT 0,
  records_pulled INT DEFAULT 0,
  error_message TEXT
);

-- ---------------------------------------------------------------------
-- 9. INDEXES — every table that participates in delta-sync needs its
--    updated_at indexed, since "WHERE updated_at > $lastSync" is the
--    hot path on every single sync call.
-- ---------------------------------------------------------------------
CREATE INDEX idx_users_updated_at        ON users(updated_at);
CREATE INDEX idx_subjects_updated_at     ON subjects(updated_at);
CREATE INDEX idx_topics_updated_at       ON topics(updated_at);
CREATE INDEX idx_past_papers_updated_at  ON past_papers(updated_at);
CREATE INDEX idx_questions_updated_at    ON questions(updated_at);
CREATE INDEX idx_quizzes_updated_at      ON quizzes(updated_at);
CREATE INDEX idx_attempts_updated_at     ON student_attempts(updated_at);
CREATE INDEX idx_attempts_student_sync   ON student_attempts(student_id, is_synced);
CREATE INDEX idx_learning_gaps_student   ON learning_gaps(student_id);
CREATE INDEX idx_ai_chat_updated_at      ON ai_chat_history(updated_at);
CREATE INDEX idx_ai_chat_student_sync    ON ai_chat_history(student_id, is_synced);
CREATE INDEX idx_questions_topic         ON questions(topic_id);
CREATE INDEX idx_topics_subject          ON topics(subject_id);
