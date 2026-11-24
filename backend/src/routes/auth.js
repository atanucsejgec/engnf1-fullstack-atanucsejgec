const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const v = require('../utils/validate');
const { badRequest, unauthenticated, conflict } = require('../utils/errors');
const { toUser } = require('../utils/mappers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function createToken(user) {
  // Spec: token must expire within 24 hours
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
}

// POST /api/auth/register  - always creates a USER, never an ADMIN
router.post('/register', async (req, res) => {
  const body = req.body || {};
  const name = v.text(body.name, 'name', 2, 50);
  const email = v.email(body.email);
  const password = v.password(body.password);

  const passwordHash = await bcrypt.hash(password, 10); // cost 10 as required

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'USER') RETURNING *`,
      [name, email, passwordHash]
    );
    res.status(201).json({ user: toUser(rows[0]) });
  } catch (err) {
    // 23505 = unique violation on lower(email)
    if (err.code === '23505') throw conflict('An account with this email already exists');
    throw err;
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const body = req.body || {};
  if (typeof body.email !== 'string' || typeof body.password !== 'string' || !body.email || !body.password) {
    throw badRequest('email and password are required');
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE lower(email) = lower($1)', [body.email.trim()]);
  const user = rows[0];

  // Same message for "no such user" and "wrong password" so attackers
  // can't find out which emails are registered
  const ok = user && (await bcrypt.compare(body.password, user.password_hash));
  if (!ok) throw unauthenticated('Wrong email or password');

  res.json({ token: createToken(user), user: toUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  res.json({ user: toUser(rows[0]) });
});

module.exports = router;
