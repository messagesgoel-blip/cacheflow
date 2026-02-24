const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Supported file types for text extraction
const TEXT_EXTRACTORS = {
  '.txt': async (filePath) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.substring(0, 8000); // Truncate to 8000 chars
  },
  '.md': async (filePath) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.substring(0, 8000);
  },
  '.js': async (filePath) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.substring(0, 8000);
  },
  '.ts': async (filePath) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.substring(0, 8000);
  },
  '.tsx': async (filePath) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.substring(0, 8000);
  },
  '.py': async (filePath) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.substring(0, 8000);
  },
  '.json': async (filePath) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.substring(0, 8000);
  },
  '.csv': async (filePath) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.substring(0, 8000);
  },
  // .docx would need special extraction library
};

/**
 * Extract text from a file based on its extension
 */
async function extractText(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();

  if (TEXT_EXTRACTORS[ext]) {
    try {
      const text = await TEXT_EXTRACTORS[ext](filePath);
      return text;
    } catch (err) {
      console.error(`[embeddings] Failed to extract text from ${filePath}:`, err.message);
      return null;
    }
  }

  // For .docx files, check if we have extraction capability
  if (ext === '.docx') {
    console.log(`[embeddings] No text extractor for .docx: ${filePath}`);
    return null;
  }

  // Unsupported file type
  console.log(`[embeddings] No text extractor for ${ext} (${mimeType}): ${filePath}`);
  return null;
}

/**
 * Generate embedding using Anthropic API
 */
async function generateEmbedding(text) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    console.warn('[embeddings] ANTHROPIC_API_KEY not set, skipping embedding generation');
    return null;
  }

  try {
    // Using Claude 3.5 Sonnet for embeddings (check current Anthropic docs)
    const response = await fetch('https://api.anthropic.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022', // Use appropriate model for embeddings
        input: text,
        dimensions: 1536
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (err) {
    console.error('[embeddings] Failed to generate embedding:', err.message);
    return null;
  }
}

/**
 * Generate and store embedding for a file (fire-and-forget)
 */
async function generateEmbeddingForFile(fileId, filePath, mimeType) {
  try {
    // Extract text
    const text = await extractText(filePath, mimeType);
    if (!text || text.trim().length === 0) {
      console.log(`[embeddings] No text extracted for file ${fileId}`);
      return;
    }

    // Generate embedding
    const embedding = await generateEmbedding(text);
    if (!embedding) {
      console.log(`[embeddings] Failed to generate embedding for file ${fileId}`);
      return;
    }

    // Calculate text hash for deduplication
    const textHash = crypto.createHash('sha256').update(text).digest('hex');

    // Store in database
    const { pool } = require('../db/client.js');
    await pool.query(
      `INSERT INTO file_embeddings (file_id, embedding, text_hash, model)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (file_id) DO UPDATE
       SET embedding = $2, text_hash = $3, model = $4, created_at = NOW()`,
      [fileId, JSON.stringify(embedding), textHash, 'anthropic-embed-v1']
    );

    console.log(`[embeddings] Embedding generated and stored for file ${fileId}`);
  } catch (err) {
    console.error(`[embeddings] Error processing file ${fileId}:`, err.message);
    // Don't throw - this is best-effort background task
  }
}

/**
 * Check ANTHROPIC_API_KEY on startup
 */
function checkApiKey() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[embeddings] WARNING: ANTHROPIC_API_KEY not set. Embeddings will be skipped.');
  } else {
    console.log('[embeddings] ANTHROPIC_API_KEY is set, embeddings enabled');
  }
}

module.exports = {
  extractText,
  generateEmbedding,
  generateEmbeddingForFile,
  checkApiKey
};