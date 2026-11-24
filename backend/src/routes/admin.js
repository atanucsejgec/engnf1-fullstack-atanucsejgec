const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { ENUMS } = require('../utils/validate');
const { getTicketStats } = require('./stats');

const router = express.Router();

// GET /api/admin/stats  (ADMIN)
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  const [active, byStatus, top, ticketStats] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM resources WHERE is_active = true'),
    pool.query('SELECT status, COUNT(*)::int AS count FROM bookings GROUP BY status'),
    // Top 3 resources by number of bookings that are (or will be) used
    pool.query(`
      SELECT r.id, r.name, r.type, COUNT(b.id)::int AS "bookingCount"
        FROM resources r
        JOIN bookings b ON b.resource_id = r.id AND b.status IN ('PENDING', 'APPROVED')
       GROUP BY r.id
       ORDER BY "bookingCount" DESC, r.name ASC
       LIMIT 3`),
    getTicketStats(),
  ]);

  // All 4 status keys must be present, even if 0
  const bookingsByStatus = Object.fromEntries(ENUMS.bookingStatus.map((s) => [s, 0]));
  for (const row of byStatus.rows) bookingsByStatus[row.status] = row.count;

  res.json({
    activeResources: active.rows[0].count,
    bookingsByStatus,
    topResources: top.rows,
    ticketStats,
  });
});

module.exports = router;
