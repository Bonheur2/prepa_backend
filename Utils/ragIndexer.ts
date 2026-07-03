import pool from '../Config/db';
import { embed } from './embeddings';
import * as KnowledgeChunkModel from '../Models/knowledgeChunkModel';

function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= chunkSize) return [trimmed];
  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    const end = Math.min(start + chunkSize, trimmed.length);
    chunks.push(trimmed.slice(start, end));
    if (end === trimmed.length) break;
    start = end - overlap;
  }
  return chunks;
}

export async function indexContent(
  sourceType: 'topic' | 'question' | 'document',
  sourceId: string,
  content: string,
  opts: { subjectId?: string | null; topicId?: string | null } = {}
): Promise<void> {
  const chunks = sourceType === 'document' ? chunkText(content) : [content];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await KnowledgeChunkModel.deleteBySource(client, sourceType, sourceId);
    for (let i = 0; i < chunks.length; i++) {
      const vector = await embed(chunks[i]);
      await KnowledgeChunkModel.insertChunk(
        client,
        sourceType,
        sourceId,
        opts.subjectId ?? null,
        opts.topicId ?? null,
        i,
        chunks[i],
        vector
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function retrieveContext(
  query: string,
  opts: { topicId?: string | null; limit?: number } = {}
): Promise<string[]> {
  const queryEmbedding = await embed(query);
  return KnowledgeChunkModel.similaritySearch(pool, queryEmbedding, opts.topicId, opts.limit ?? 4);
}
