const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const pool         = require('./db/client');
const authRoutes     = require('./routes/auth');
const filesRoutes    = require('./routes/files');
const sharesRoutes   = require('./routes/shares');
const conflictsRoutes = require('./routes/conflicts');
const searchRoutes = require('./routes/search');
const { checkApiKey } = require('./services/embeddings');

const rateLimit = require('express-rate-limit');
const app = express();

// Check ANTHROPIC_API_KEY on startup
checkApiKey();

// Basic throttle — shift-left from Days 79-80 to protect infra_cacheflow during QA
// 200 req/min per IP globally; upload endpoint stricter at 30/min
app.set('trust proxy', 1); // Trust Cloudflare/proxy X-Forwarded-For headers

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1',
  message: { error: 'Too many requests, please slow down.' }
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1',
  message: { error: 'Upload rate limit exceeded.' }
});

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(globalLimiter);
app.use(express.json());

// Health — checks DB connectivity
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

app.use('/auth',   authRoutes);
app.use('/files/upload', uploadLimiter);
app.use('/files',  filesRoutes);
app.use('/share',  sharesRoutes);   // public share-link downloads + creation
app.use('/conflicts', conflictsRoutes);
app.use('/search', searchRoutes);

module.exports = app;
