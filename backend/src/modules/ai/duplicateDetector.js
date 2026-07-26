/*
 * Duplicate detection — finds similar tickets in the same unit within the last 30 days.
 * Uses a simple TF-IDF-like cosine similarity on ticket titles + descriptions.
 */

import { query } from '../../db/connection.js';

const DUPLICATE_WINDOW_DAYS = 30;
const SIMILARITY_THRESHOLD = 0.5;

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function tfidfVector(tokens, corpus) {
  const wordFreq = {};
  for (const t of tokens) {
    wordFreq[t] = (wordFreq[t] || 0) + 1;
  }

  const n = corpus.length;
  const vec = {};
  for (const [word, freq] of Object.entries(wordFreq)) {
    const containing = corpus.filter(doc => doc.includes(word)).length;
    const idf = containing > 0 ? Math.log(n / containing) + 1 : 1;
    vec[word] = freq * idf;
  }
  return vec;
}

function cosineSimilarity(vecA, vecB) {
  const union = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dot = 0, normA = 0, normB = 0;

  for (const key of union) {
    const a = vecA[key] || 0;
    const b = vecB[key] || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function findDuplicates(ticketId, unitId) {
  if (!unitId) return [];

  const windowDate = new Date();
  windowDate.setDate(windowDate.getDate() - DUPLICATE_WINDOW_DAYS);

  const result = await query(
    `SELECT id, title, description
     FROM tickets
     WHERE unit_id = $1
       AND id != $2
       AND created_at >= $3
       AND status NOT IN ('Cancelled', 'Archived')
     ORDER BY created_at DESC
     LIMIT 20`,
    [unitId, ticketId, windowDate]
  );

  if (result.rows.length === 0) return [];

  const source = await query('SELECT title, description FROM tickets WHERE id = $1', [ticketId]);
  if (source.rows.length === 0) return [];

  const sourceText = `${source.rows[0].title} ${source.rows[0].description}`;
  const sourceTokens = tokenize(sourceText);
  const allDocs = result.rows.map(r => tokenize(`${r.title} ${r.description}`));

  const sourceVec = tfidfVector(sourceTokens, [...allDocs, sourceTokens]);

  const matches = [];
  for (const row of result.rows) {
    const targetTokens = tokenize(`${row.title} ${row.description}`);
    const targetVec = tfidfVector(targetTokens, [...allDocs, sourceTokens]);
    const similarity = cosineSimilarity(sourceVec, targetVec);

    if (similarity >= SIMILARITY_THRESHOLD) {
      matches.push({
        duplicateTicketId: row.id,
        similarityScore: Math.round(similarity * 100) / 100,
        matchReason: similarity >= 0.8 ? 'Very similar description'
          : similarity >= 0.6 ? 'Similar description'
          : 'Partially similar',
      });
    }
  }

  matches.sort((a, b) => b.similarityScore - a.similarityScore);
  return matches;
}

/**
 * Pre-creation duplicate check: compares candidate text against recent
 * same-unit tickets. Returns matches with similarity >= threshold.
 */
async function checkForDuplicate(unitId, title, description, excludeId = null) {
  if (!unitId) return [];

  const windowDate = new Date();
  windowDate.setDate(windowDate.getDate() - DUPLICATE_WINDOW_DAYS);

  const params = [unitId, windowDate];
  let excludeClause = '';
  if (excludeId) {
    excludeClause = 'AND id != $3';
    params.push(excludeId);
  }

  const result = await query(
    `SELECT id, title, description
     FROM tickets
     WHERE unit_id = $1
       AND created_at >= $2
       ${excludeClause}
       AND status NOT IN ('Cancelled', 'Archived')
     ORDER BY created_at DESC
     LIMIT 20`,
    params
  );

  if (result.rows.length === 0) return [];

  const sourceText = `${title} ${description}`;
  const sourceTokens = tokenize(sourceText);
  const allDocs = result.rows.map(r => tokenize(`${r.title} ${r.description}`));
  const sourceVec = tfidfVector(sourceTokens, [...allDocs, sourceTokens]);

  const matches = [];
  for (const row of result.rows) {
    const targetTokens = tokenize(`${row.title} ${row.description}`);
    const targetVec = tfidfVector(targetTokens, [...allDocs, sourceTokens]);
    const similarity = cosineSimilarity(sourceVec, targetVec);

    if (similarity >= SIMILARITY_THRESHOLD) {
      matches.push({
        duplicateTicketId: row.id,
        title: row.title,
        similarityScore: Math.round(similarity * 100) / 100,
        matchReason: similarity >= 0.8 ? 'Very similar description'
          : similarity >= 0.6 ? 'Similar description'
          : 'Partially similar',
      });
    }
  }

  matches.sort((a, b) => b.similarityScore - a.similarityScore);
  return matches;
}

export { findDuplicates, checkForDuplicate, cosineSimilarity, tokenize, SIMILARITY_THRESHOLD };
