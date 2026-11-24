const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { ENUMS } = require('../utils/validate');

const router = express.Router();

// Turns [{ key: 'BUG', count: 3 }] into { BILLING: 0, BUG: 3, ... }
// so every enum value is always present, even with a count of 0.
function countsFor(allKeys, rows) {
  const result = Object.fromEntries(allKeys.map((k) => [k, 0]));
  for (const row of rows) result[row.key] = row.count;
  return result;
}

async function getTicketStats() {
  const [byCategory, byPriority, byStatus, review] = await Promise.all([
    pool.query('SELECT category AS key, COUNT(*)::int AS count FROM tickets GROUP BY category'),
    pool.query('SELECT priority AS key, COUNT(*)::int AS count FROM tickets GROUP BY priority'),
    pool.query('SELECT status AS key, COUNT(*)::int AS count FROM tickets GROUP BY status'),
    // Model agreement = of the tickets an agent reviewed, how many still
    // have the category the classifier originally predicted?
    pool.query(`
      SELECT COUNT(*)::int AS reviewed,
             COUNT(*) FILTER (WHERE category = auto_category)::int AS agreed,
             (SELECT COUNT(*)::int FROM tickets) AS total
        FROM tickets WHERE is_reviewed = true`),
  ]);

  const { reviewed, agreed, total } = review.rows[0];
  return {
    total,
    byCategory: countsFor(ENUMS.category, byCategory.rows),
    byPriority: countsFor(ENUMS.priority, byPriority.rows),
    byStatus: countsFor(ENUMS.ticketStatus, byStatus.rows),
    reviewedCount: reviewed,
    // Percentage with one decimal. 0 when nothing is reviewed yet.
    modelAgreementRate: reviewed === 0 ? 0 : Math.round((agreed / reviewed) * 1000) / 10,
  };
}

// GET /api/stats
router.get('/', requireAuth, async (req, res) => {
  res.json(await getTicketStats());
});

module.exports = router;
module.exports.getTicketStats = getTicketStats;
