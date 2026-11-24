const express = require('express');
const pool = require('../db/pool');
const v = require('../utils/validate');
const { notFound } = require('../utils/errors');
const { toTicket, toTicketEvent } = require('../utils/mappers');
const { requireAuth } = require('../middleware/auth');
const { importTickets } = require('../services/ticketImport');
const { updateTicket } = require('../services/ticketUpdate');

const router = express.Router();
router.use(requireAuth); // every ticket route needs a logged-in user

// POST /api/tickets/import
router.post('/import', async (req, res) => {
  const result = await importTickets(req.body);
  res.json(result);
});

// GET /api/tickets?status=&category=&priority=&q=&page=&limit=
// All filters are optional and combine with AND (rule T-B4).
router.get('/', async (req, res) => {
  const { page, limit, offset } = v.pagination(req.query, 10, 100);

  // We build the WHERE clause from pieces, but user input NEVER goes into
  // the SQL text - it only goes into the params array ($1, $2 ...).
  const conditions = [];
  const params = [];

  if (req.query.status) {
    params.push(v.oneOf(req.query.status, 'status', v.ENUMS.ticketStatus));
    conditions.push(`status = $${params.length}`);
  }
  if (req.query.category) {
    params.push(v.oneOf(req.query.category, 'category', v.ENUMS.category));
    conditions.push(`category = $${params.length}`);
  }
  if (req.query.priority) {
    params.push(v.oneOf(req.query.priority, 'priority', v.ENUMS.priority));
    conditions.push(`priority = $${params.length}`);
  }
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    // % and _ are wildcards in LIKE. likePattern escapes them (and the escape
    // char \) so searching for "50%" finds the text "50%", not "50 anything".
    params.push(v.likePattern(req.query.q));
    conditions.push(`(subject ILIKE $${params.length} ESCAPE '\\' OR body ILIKE $${params.length} ESCAPE '\\')`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM tickets ${where}`, params);
  const { rows } = await pool.query(
    `SELECT * FROM tickets ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  res.json(v.paginated(rows.map(toTicket), page, limit, countResult.rows[0].total));
});

async function loadTicketWithEvents(id) {
  const ticket = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
  if (!ticket.rows[0]) throw notFound('Ticket not found');
  const events = await pool.query(
    'SELECT * FROM ticket_events WHERE ticket_id = $1 ORDER BY created_at DESC, id DESC',
    [id]
  );
  return { ticket: toTicket(ticket.rows[0]), events: events.rows.map(toTicketEvent) };
}

// GET /api/tickets/:id
router.get('/:id', async (req, res) => {
  if (!v.isValidId(req.params.id)) throw notFound('Ticket not found');
  res.json(await loadTicketWithEvents(req.params.id));
});

// PATCH /api/tickets/:id  - agent changes category / priority / status / assigneeId
router.patch('/:id', async (req, res) => {
  if (!v.isValidId(req.params.id)) throw notFound('Ticket not found');

  // The person who made the change: X-Agent header, or the logged-in user's email
  const header = (req.get('X-Agent') || '').trim();
  const actor = header ? header.slice(0, 254) : req.user.email;

  await updateTicket(req.params.id, req.body, actor);
  res.json(await loadTicketWithEvents(req.params.id));
});

module.exports = router;
module.exports.loadTicketWithEvents = loadTicketWithEvents;
