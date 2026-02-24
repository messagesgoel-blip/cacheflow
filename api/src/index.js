require('dotenv').config();

// Global safety net to prevent crashes from unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection — process kept alive:', reason);
  // Log but DO NOT exit — let the request fail gracefully
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception — process kept alive:', err);
});

const app  = require('./app');
const PORT = process.env.PORT || 8100;

app.listen(PORT, () => {
  console.log(`[cacheflow] API listening on port ${PORT}`);
});
