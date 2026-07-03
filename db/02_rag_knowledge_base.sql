-- =====================================================================
-- Migration 02: RAG knowledge base for the AI tutor
-- Run after 01_classes_auth_pastpapers.sql
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------
-- DOCUMENTS: teacher/admin-pasted study material (plain text, no file
-- upload) that the AI tutor can draw on alongside topics/questions.
-- ---------------------------------------------------------------------
CREATE TABLE documents (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      VARCHAR(255) NOT NULL,
  content    TEXT NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id   UUID REFERENCES topics(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_documents_updated_at ON documents(updated_at);
CREATE INDEX idx_documents_topic      ON documents(topic_id);

-- ---------------------------------------------------------------------
-- KNOWLEDGE_CHUNKS: derived embedding index over topics/questions/
-- documents, used for retrieval by the AI tutor. Server-side only --
-- never synced to clients -- so unlike every other table here it does
-- NOT get updated_at/is_deleted/trigger: indexContent() (lib/knowledgeBase.ts)
-- hard-deletes and reinserts a source's rows on every re-index instead.
-- ---------------------------------------------------------------------
CREATE TABLE knowledge_chunks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type TEXT NOT NULL CHECK (source_type IN ('topic', 'question', 'document')),
  source_id   UUID NOT NULL, -- polymorphic across 3 tables; app-enforced, no FK
  subject_id  UUID REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id    UUID REFERENCES topics(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL DEFAULT 0,
  content     TEXT NOT NULL,
  embedding   vector(384) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_chunks_source ON knowledge_chunks(source_type, source_id);
CREATE INDEX idx_knowledge_chunks_topic  ON knowledge_chunks(topic_id);

-- No ivfflat/hnsw vector index yet -- at expected scale (curriculum content
-- for a handful of REB subjects), an exact sequential scan over `<=>` is
-- fast and exact. Add one once row counts justify it (~50k+), e.g.:
--   CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
