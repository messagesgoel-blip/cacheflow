const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const pool         = require('./db/client');
const authRoutes     = require('./routes/auth');
const filesRoutes    = require('./routes/files');
const sharesRoutes   = require('./routes/shares');
const conflictsRoutes = require('./routes/conflicts');
const adminRoutes = require('./routes/admin');
const storageRoutes = require('./routes/storage');
const remotesRoutes = require('./routes/remotes');
const tokensRoutes = require('./routes/tokens');
const healthRoutes = require('./routes/health');
const cacheRoutes = require('./routes/cache');
const transferRoutes = require('./routes/transfer');
const remoteUploadRoutes = require('./routes/remoteUpload');
const apiRoutes      = require('./routes/api');
const userRemotesRoutes = require('./routes/userRemotes');
const providersRoutes = require('./routes/providers');
const favoritesRoutes = require('./routes/favorites');
const activityRoutes = require('./routes/activity');
const requestTracker = require('./middleware/requestTracker');
const { auditMiddleware } = require('./middleware/audit');
const config = require('./config');

const rateLimit = require('express-rate-limit');
const app = express();
app.disable('etag');


app.use(requestTracker);

function isPrivateIp(ip = '') {
  const normalized = ip.replace(/^::ffff:/, '');
  if (normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost') return true;
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  const m = normalized.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

function requestIsLocal(req) {
  if (isPrivateIp(req.ip || '')) return true;
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') {
    const first = fwd.split(',')[0].trim();
    return isPrivateIp(first);
  }
  return false;
}

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

// Auth endpoints — stricter: 10 per 15 minutes (brute force protection)
const authLimiter = rateLimit({
  windowMs: config.authRateLimitWindowMs,
  max: config.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: process.env.AUTH_RATE_LIMIT_SKIP_SUCCESS !== 'false',
  skip: (req) => requestIsLocal(req),
  message: { error: 'Too many auth attempts, please try again later.' }
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

const corsAllowLocalhost = String(process.env.CACHEFLOW_ALLOW_LOCALHOST_CORS || '').toLowerCase() === 'true';
const corsAllowedOrigins = new Set([
  'https://cacheflow.goels.in',
]);

if (corsAllowLocalhost) {
  // Local QA only (explicitly gated)
  corsAllowedOrigins.add('http://localhost:3010');
  corsAllowedOrigins.add('http://127.0.0.1:3010');
  corsAllowedOrigins.add('http://localhost:3011');
  corsAllowedOrigins.add('http://127.0.0.1:3011');
  corsAllowedOrigins.add('http://localhost:3110');
  corsAllowedOrigins.add('http://127.0.0.1:3110');
  corsAllowedOrigins.add('http://localhost:3111');
  corsAllowedOrigins.add('http://127.0.0.1:3111');
  // Common Next dev ports
  corsAllowedOrigins.add('http://localhost:3000');
  corsAllowedOrigins.add('http://127.0.0.1:3000');
  corsAllowedOrigins.add('http://localhost:4010');
  corsAllowedOrigins.add('http://127.0.0.1:4010');
}

const corsMiddleware = cors({
  origin: (origin, cb) => {
    // Non-browser clients (curl, health checks) typically send no Origin
    if (!origin) return cb(null, true);
    return cb(null, corsAllowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Share-Password', 'X-Correlation-Id'],
  credentials: true,
  maxAge: 600,
});

app.use(corsMiddleware);
// cors middleware automatically handles preflight OPTIONS
morgan.token('requestId', (req) => req.requestId || '-');
morgan.token('correlationId', (req) => req.correlationId || '-');
app.use(morgan(':method :url :status :res[content-length] - :response-time ms [req::requestId] [corr::correlationId]'));
app.use(globalLimiter);
app.use(auditMiddleware);
app.use(express.json());

// API responses are user-specific and should never be cache-revalidated as 304.
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Health — checks DB connectivity
app.use('/health', healthRoutes);

app.use('/auth', authLimiter, authRoutes);
app.use('/files/upload', uploadLimiter);
app.use('/files',  filesRoutes);
app.use('/share',  sharesRoutes);   // public share-link downloads + creation
app.use('/conflicts', conflictsRoutes);
app.use('/admin', adminRoutes);
app.use('/storage', storageRoutes);
app.use('/remotes', remotesRoutes);
app.use('/tokens', tokensRoutes);
app.use('/cache', cacheRoutes);
app.use('/transfer', transferRoutes);
app.use('/remote-upload', remoteUploadRoutes);

// New production-grade API routes
app.use('/api', apiRoutes);
app.use('/api/remotes', userRemotesRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/activity', activityRoutes);

module.exports = app;

