import { Queryable } from '../Config/db';
import dynamicImport from '../Utils/dynamicImport';

// pgvector is also pure ESM (see Utils/dynamicImport.ts) -- encapsulated
// here next to the `::vector` cast SQL it's paired with, rather than
// leaking the wire-format detail into callers.
async function toVectorSql(embedding: number[]): Promise<string> {
  const { toSql } = await dynamicImport('pgvector');
  return toSql(embedding);
}

export async function deleteBySource(db: Queryable, sourceType: string, sourceId: string): Promise<void> {
  await db.query('DELETE FROM knowledge_chunks WHERE source_type = $1 AND source_id = $2', [sourceType, sourceId]);
}

export async function insertChunk(
  db: Queryable,
  sourceType: string,
  sourceId: string,
  subjectId: string | null,
  topicId: string | null,
  chunkIndex: number,
  content: string,
  embedding: number[]
): Promise<void> {
  await db.query(
    `INSERT INTO knowledge_chunks (source_type, source_id, subject_id, topic_id, chunk_index, content, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [sourceType, sourceId, subjectId, topicId, chunkIndex, content, await toVectorSql(embedding)]
  );
}

export async function similaritySearch(
  db: Queryable,
  queryEmbedding: number[],
  topicId?: string | null,
  limit = 4
): Promise<string[]> {
  const vectorSql = await toVectorSql(queryEmbedding);
  const result = topicId
    ? await db.query(
        `SELECT content FROM knowledge_chunks WHERE topic_id = $2 ORDER BY embedding <=> $1::vector LIMIT $3`,
        [vectorSql, topicId, limit]
      )
    : await db.query(`SELECT content FROM knowledge_chunks ORDER BY embedding <=> $1::vector LIMIT $2`, [
        vectorSql,
        limit,
      ]);
  return result.rows.map((r) => r.content as string);
}
