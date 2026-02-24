const express = require('express');
const { pool } = require('../db/client');
const { generateEmbedding } = require('../services/embeddings');
const authMw = require('../middleware/auth');

const router = express.Router();
router.use(authMw);

// GET /search?q=...
// Returns files ranked by semantic similarity + filename match
router.get('/', async (req, res) => {
  const query = req.query.q;

  // Validate query
  if (!query || query.trim().length < 3) {
    return res.status(400).json({ error: 'Query must be at least 3 characters' });
  }

  const userId = req.user.id;
  const tenantId = req.user.tenant_id;

  try {
    // 1. Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query.trim());

    if (!queryEmbedding) {
      // Fall back to basic filename search if embedding fails
      const filenameResults = await pool.query(
        `SELECT id, path, size_bytes, status, 'filename' as match_type, 1.0 as score
         FROM files
         WHERE user_id = $1 AND tenant_id = $2
           AND deleted_at IS NULL
           AND path ILIKE '%' || $3 || '%'
         LIMIT 20`,
        [userId, tenantId, query]
      );

      return res.json(filenameResults.rows);
    }

    // 2. Run semantic similarity search (cosine similarity)
    const semanticResults = await pool.query(
      `SELECT f.id, f.path, f.size_bytes, f.status,
              1 - (fe.embedding <=> $1::vector) AS score,
              'semantic' as match_type
       FROM file_embeddings fe
       JOIN files f ON f.id = fe.file_id
       WHERE f.user_id = $2 AND f.tenant_id = $3
         AND f.deleted_at IS NULL
       ORDER BY score DESC
       LIMIT 20`,
      [JSON.stringify(queryEmbedding), userId, tenantId]
    );

    // 3. Also run filename search
    const filenameResults = await pool.query(
      `SELECT id, path, size_bytes, status,
              'filename' as match_type, 1.0 as score
       FROM files
       WHERE user_id = $1 AND tenant_id = $2
         AND deleted_at IS NULL
         AND path ILIKE '%' || $3 || '%'`,
      [userId, tenantId, query]
    );

    // 4. Merge results
    const merged = new Map();

    // Add semantic results
    for (const row of semanticResults.rows) {
      merged.set(row.id, { ...row, score: parseFloat(row.score) });
    }

    // Add/boost filename results
    for (const row of filenameResults.rows) {
      if (merged.has(row.id)) {
        // Already in results, boost score and mark as 'both'
        const existing = merged.get(row.id);
        existing.score = Math.min(existing.score + 0.1, 1.5); // Cap at 1.5
        existing.match_type = 'both';
      } else {
        merged.set(row.id, { ...row, score: parseFloat(row.score) });
      }
    }

    // 5. Sort by final score and return top 20
    const finalResults = Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(row => ({
        id: row.id,
        path: row.path,
        size_bytes: row.size_bytes,
        status: row.status,
        score: Math.round(row.score * 100) / 100,
        match_type: row.match_type
      }));

    res.json(finalResults);
  } catch (err) {
    console.error('[search] Error:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
