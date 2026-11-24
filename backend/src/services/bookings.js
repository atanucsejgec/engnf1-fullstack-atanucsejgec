// Booking rules (B1-B12) live here, so the route file stays small.
const pool = require('../db/pool');
const v = require('../utils/validate');
const { badRequest, notFound, conflict } = require('../utils/errors');

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const MAX_ACTIVE_BOOKINGS = 3;

// B1-B4: time grid, duration and "how far ahead" rules
function checkTimes(start, end) {
  const onGrid = (d) => d.getUTCMinutes() % 30 === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  if (!onGrid(start) || !onGrid(end)) {
    throw badRequest('startTime and endTime must be on :00 or :30 (UTC) with no seconds');
  }

  const minutes = (end - start) / MINUTE;
  if (minutes < 30 || minutes > 240) throw badRequest('A booking must be 30 to 240 minutes long');

  const now = Date.now();
  if (start.getTime() <= now) throw badRequest('startTime must be in the future');
  if (start.getTime() > now + 30 * DAY) throw badRequest('startTime can be at most 30 days ahead');
}

function validateNewBooking(body) {
  const input = body || {};
  const data = {
    resourceId: v.integer(input.resourceId, 'resourceId', 1, 2147483646),
    startTime: v.isoDate(input.startTime, 'startTime'),
    endTime: v.isoDate(input.endTime, 'endTime'),
    purpose: v.text(input.purpose, 'purpose', 5, 200),
    ticketId: null,
  };
  if (input.ticketId !== undefined && input.ticketId !== null && input.ticketId !== '') {
    data.ticketId = v.integer(input.ticketId, 'ticketId', 1, 2147483646);
  }
  checkTimes(data.startTime, data.endTime);
  return data;
}

async function createBooking(user, body) {
  const data = validateNewBooking(body);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Referenced ids -> 404
    const res = await client.query('SELECT id, is_active FROM resources WHERE id = $1', [data.resourceId]);
    if (!res.rows[0]) throw notFound('Resource not found');
    if (data.ticketId) {
      const ticket = await client.query('SELECT 1 FROM tickets WHERE id = $1', [data.ticketId]);
      if (!ticket.rows[0]) throw notFound('Linked ticket not found');
    }

    // B7: only active resources can be booked
    if (!res.rows[0].is_active) throw conflict('This resource is not active');

    // B8: max 3 future PENDING/APPROVED bookings per user.
    // Locking the user's row makes requests from the SAME user wait for each
    // other, so two parallel requests can't both see "2 bookings" and both insert.
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    const active = await client.query(
      `SELECT COUNT(*)::int AS count FROM bookings
        WHERE user_id = $1 AND status IN ('PENDING', 'APPROVED') AND start_time > now()`,
      [user.id]
    );
    if (active.rows[0].count >= MAX_ACTIVE_BOOKINGS) {
      throw conflict(`You can have at most ${MAX_ACTIVE_BOOKINGS} upcoming bookings`);
    }

    // B5 + B6: the exclusion constraint "bookings_no_overlap" checks overlap
    // atomically during this INSERT. If the slot is taken, Postgres raises 23P01.
    const { rows } = await client.query(
      `INSERT INTO bookings (resource_id, user_id, ticket_id, start_time, end_time, purpose)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.resourceId, user.id, data.ticketId, data.startTime, data.endTime, data.purpose]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23P01') throw conflict('This time slot is already booked');
    throw err;
  } finally {
    client.release();
  }
}

// B10-B11: status changes. The WHERE clause contains the allowed "from"
// statuses and "start is in the future", so the check and the update are
// one atomic statement. If no row was updated, the transition is not allowed -> 409.
async function changeStatus(bookingId, fromStatuses, toStatus, note = null) {
  const { rows } = await pool.query(
    `UPDATE bookings
        SET status = $2, decision_note = COALESCE($3, decision_note)
      WHERE id = $1 AND status = ANY($4) AND start_time > now()
      RETURNING *`,
    [bookingId, toStatus, note, fromStatuses]
  );
  if (!rows[0]) {
    throw conflict(`Only ${fromStatuses.join('/')} bookings that have not started can be ${toStatus.toLowerCase()}`);
  }
  return rows[0];
}

module.exports = { createBooking, changeStatus };
