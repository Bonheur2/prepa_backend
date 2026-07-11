-- =====================================================================
-- Migration 03: Allow 'past_paper' as a RAG source_type
-- Run after 02_rag_knowledge_base.sql
-- =====================================================================

ALTER TABLE knowledge_chunks DROP CONSTRAINT knowledge_chunks_source_type_check;
ALTER TABLE knowledge_chunks ADD CONSTRAINT knowledge_chunks_source_type_check
  CHECK (source_type IN ('topic', 'question', 'document', 'past_paper'));
