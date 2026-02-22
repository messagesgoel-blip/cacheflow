const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const pool         = require('./db/client');
const authRoutes   = require('./routes/auth');
const filesRoutes  = require('./routes/files');
const sharesRoutes = require('./routes/shares');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
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
app.use('/files',  filesRoutes);
app.use('/share',  sharesRoutes);   // public share-link downloads + creation

module.exports = app;
