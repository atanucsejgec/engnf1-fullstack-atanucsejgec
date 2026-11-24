const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { unauthenticated, forbidden } = require('../utils/errors');

// Checks the "Authorization: Bearer <token>" header and puts the
// logged-in user on req.user. Any problem -> 401.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthenticated();

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw unauthenticated('Your session has expired, please log in again');
  }

  // Load the user fresh from the DB so a deleted user or changed role is respected
  const { rows } = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [payload.sub]);
  if (!rows[0]) throw unauthenticated();

  req.user = rows[0];
  next();
}

// Use after requireAuth. Only ADMIN users may continue, others get 403.
function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') throw forbidden('Only admins can do this');
  next();
}

module.exports = { requireAuth, requireAdmin };
