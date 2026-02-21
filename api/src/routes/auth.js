const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/client');
const authMw  = require('../middleware/auth');

const router = express.Router();

// POST /auth/register
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)   return res.status(400).json({ error: 'email and password required' });
  if (password.length < 8)   return res.status(400).json({ error: 'password min 8 chars' });

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length)  return res.status(409).json({ error: 'email already registered' });

    const hash   = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email, created_at',
      [email, hash]
    );
    const user  = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.status(201).json({ user: { id: user.id, email: user.email, created_at: user.created_at }, token });
  } catch (err) {
    console.error('[auth] register:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user   = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({ user: { id: user.id, email: user.email }, token });
  } catch (err) {
    console.error('[auth] login:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /auth/me  (protected)
router.get('/me', authMw, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, created_at FROM users WHERE id=$1', [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'user not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('[auth] me:', err.message);
    res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
