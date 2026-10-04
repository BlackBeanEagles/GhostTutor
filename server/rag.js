// Retrieval over the student's notes.
// Tiger Data (pgvector + keyword hybrid) when DATABASE_URL is set,
// else in-memory cosine on Gemma-side embeddings, else keyword scoring.
import pg from 'pg';
import { config } from './config.js';
import { embed, llmAvailable } from './llm.js';

let pool = null;
export let ragKind = 'keyword';

export async function initRag() {
  if (!config.pgUrl) return;
  try {
    pool = new pg.Pool({ connectionString: config.pgUrl, ssl: { rejectUnauthorized: false } });
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await pool.query(`CREATE TABLE IF NOT EXISTS note_chunks (
      id TEXT PRIMARY KEY, topic TEXT, text TEXT,
      embedding vector(768),
      tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS quiz_attempts (
      at TIMESTAMPTZ NOT NULL, topic TEXT, correct BOOLEAN, ms INT, difficulty INT)`);
    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS timescaledb`);
      await pool.query(`SELECT create_hypertable('quiz_attempts', 'at', if_not_exists => TRUE)`);
    } catch { /* plain Postgres is fine too */ }
    ragKind = 'tiger-pgvector-hybrid';
  } catch (e) {
    console.warn('[rag] Tiger Data unavailable, falling back:', e.message);
    pool = null;
  }
}

const STOP = new Set('what why how when which who does the and are for with that this from into explain tell about'.split(' '));
const words = (s) => (s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !STOP.has(w));

export function chunkText(text, size = 700) {
  const paras = text.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out = [];
  let cur = '';
  for (const p of paras) {
    if ((cur + '\n\n' + p).length > size && cur) { out.push(cur); cur = p; }
    else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) out.push(cur);
  return out.flatMap((c) => (c.length > size * 2 ? c.match(new RegExp(`[\\s\\S]{1,${size}}(?=\\s|$)`, 'g')) : [c]));
}

export async function indexChunks(chunks) {
  let vectors = null;
  if (await llmAvailable()) {
    try { vectors = await embed(chunks.map((c) => c.text)); } catch { vectors = null; }
  }
  chunks.forEach((c, i) => { if (vectors) c.embedding = vectors[i]; });
  if (pool && vectors) {
    for (const c of chunks) {
      await pool.query(
        'INSERT INTO note_chunks (id, topic, text, embedding) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',
        [c.id, c.topic, c.text, `[${c.embedding.join(',')}]`],
      );
    }
  }
  if (!pool && ragKind === 'keyword' && vectors) ragKind = 'in-memory-vector';
  return chunks;
}

export async function logAttemptTimeseries(a) {
  if (!pool) return;
  await pool.query('INSERT INTO quiz_attempts (at, topic, correct, ms, difficulty) VALUES ($1,$2,$3,$4,$5)',
    [new Date(a.at), a.topic, a.correct, a.ms, a.difficulty]).catch(() => {});
}

const cosine = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) || 1);
};

export async function search(query, allChunks, k = 4, topic = null) {
  const pool_ = topic ? allChunks.filter((c) => c.topic === topic) : allChunks;
  if (!pool_.length) return [];

  if (pool && (await llmAvailable())) {
    try {
      const [q] = await embed([query]);
      // Hybrid: reciprocal-rank fusion of vector and full-text ranks.
      const { rows } = await pool.query(
        `WITH v AS (SELECT id, RANK() OVER (ORDER BY embedding <=> $1) r FROM note_chunks
                    WHERE ($3::text IS NULL OR topic = $3) ORDER BY embedding <=> $1 LIMIT 20),
              t AS (SELECT id, RANK() OVER (ORDER BY ts_rank(tsv, plainto_tsquery('english',$2)) DESC) r
                    FROM note_chunks WHERE tsv @@ plainto_tsquery('english',$2)
                    AND ($3::text IS NULL OR topic = $3) LIMIT 20)
         SELECT c.id, c.topic, c.text,
                COALESCE(1.0/(60+v.r),0)+COALESCE(1.0/(60+t.r),0) score
         FROM note_chunks c LEFT JOIN v ON v.id=c.id LEFT JOIN t ON t.id=c.id
         WHERE v.id IS NOT NULL OR t.id IS NOT NULL ORDER BY score DESC LIMIT $4`,
        [`[${q.join(',')}]`, query, topic, k],
      );
      if (rows.length) return rows;
    } catch (e) { console.warn('[rag] hybrid search failed:', e.message); }
  }

  if (pool_.some((c) => c.embedding) && (await llmAvailable())) {
    try {
      const [q] = await embed([query]);
      return pool_.filter((c) => c.embedding)
        .map((c) => ({ ...c, score: cosine(q, c.embedding) }))
        .sort((a, b) => b.score - a.score).slice(0, k);
    } catch { /* fall through */ }
  }

  const qw = new Set(words(query));
  return pool_.map((c) => ({ ...c, score: words(c.text).filter((w) => qw.has(w)).length }))
    .sort((a, b) => b.score - a.score).slice(0, k);
}
