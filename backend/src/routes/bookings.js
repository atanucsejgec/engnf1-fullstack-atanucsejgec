const express = require('express');
const pool = require('../db/pool');
const v = require('../utils/validate');
const { notFound, forbidden } = require('../utils/errors');
const { toBooking } = require('../utils/mappers');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createBooking, changeStatus } = require('../services/bookings');

const router = express.Router();
router.use(requireAuth);

// Bookings joined with resource + user names, so the UI can show them
const SELECT_BOOKINGS = `
  SELECT b.*, r.name AS resource_name, u.name AS user_name
    FROM bookings b
    JOIN resources r ON r.id = b.resource_id
    JOIN users u ON u.id = b.user_id`;

async function findBooking(id) {
  if (!v.isValidId(id)) throw notFound('Booking not found');
  const { rows } = await pool.query(`${SELECT_BOOKINGS} WHERE b.id = $1`, [id]);
  if (!rows[0]) throw notFound('Booking not found');
  return rows[0];
}

// Runs a paginated bookings query with the given WHERE pieces
async function listBookings(conditions, params, { page, limit, offset }) {
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM bookings b ${where}`, params);
  const { rows } = await pool.query(
    `${SELECT_BOOKINGS} ${where}
     ORDER BY b.start_time DESC, b.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return v.paginated(rows.map(toBooking), page, limit, count.rows[0].total);
}

// POST /api/bookings
router.post('/', async (req, res) => {
  const booking = await createBooking(req.user, req.body);
  res.status(201).json(toBooking(booking));
});

// GET /api/bookings/mine  - must be registered BEFORE /:id,
// otherwise Express would treat "mine" as an id
router.get('/mine', async (req, res) => {
  const paging = v.pagination(req.query, 10, 50);
  const conditions = ['b.user_id = $1'];
  const params = [req.user.id];
  if (req.query.status) {
    params.push(v.oneOf(req.query.status, 'status', v.ENUMS.bookingStatus));
    conditions.push(`b.status = $${params.length}`);
  }
  res.json(await listBookings(conditions, params, paging));
});

// GET /api/bookings  (ADMIN) ?status=&resourceId=&from=&to=&page=
router.get('/', requireAdmin, async (req, res) => {
  const paging = v.pagination(req.query, 10, 50);
  const conditions = [];
  const params = [];

  if (req.query.status) {
    params.push(v.oneOf(req.query.status, 'status', v.ENUMS.bookingStatus));
    conditions.push(`b.status = $${params.length}`);
  }
  if (req.query.resourceId) {
    params.push(v.integer(req.query.resourceId, 'resourceId', 1, 2147483646));
    conditions.push(`b.resource_id = $${params.length}`);
  }
  // from/to keep bookings that OVERLAP the range
  if (req.query.from) {
    params.push(v.isoDate(req.query.from, 'from'));
    conditions.push(`b.end_time > $${params.length}`);
  }
  if (req.query.to) {
    params.push(v.isoDate(req.query.to, 'to'));
    conditions.push(`b.start_time < $${params.length}`);
  }
  res.json(await listBookings(conditions, params, paging));
});

// GET /api/bookings/:id  - owner or admin
router.get('/:id', async (req, res) => {
  const booking = await findBooking(req.params.id);
  if (req.user.role !== 'ADMIN' && booking.user_id !== req.user.id) {
    throw forbidden('This is not your booking');
  }
  res.json(toBooking(booking));
});

// PATCH /api/bookings/:id/cancel  - owner only
router.patch('/:id/cancel', async (req, res) => {
  const booking = await findBooking(req.params.id);
  if (booking.user_id !== req.user.id) throw forbidden('Only the owner can cancel this booking');
  await changeStatus(booking.id, ['PENDING', 'APPROVED'], 'CANCELLED');
  res.json(toBooking(await findBooking(booking.id)));
});

// PATCH /api/bookings/:id/approve  (ADMIN)
router.patch('/:id/approve', requireAdmin, async (req, res) => {
  const booking = await findBooking(req.params.id);
  await changeStatus(booking.id, ['PENDING'], 'APPROVED');
  res.json(toBooking(await findBooking(booking.id)));
});

// PATCH /api/bookings/:id/reject  (ADMIN) body: { note }
router.patch('/:id/reject', requireAdmin, async (req, res) => {
  const booking = await findBooking(req.params.id);
  const note = v.text((req.body || {}).note, 'note', 5, 200);
  await changeStatus(booking.id, ['PENDING'], 'REJECTED', note);
  res.json(toBooking(await findBooking(booking.id)));
});

module.exports = router;
