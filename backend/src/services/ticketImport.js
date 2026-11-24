// Idempotent ticket import (rules T-B1 + T-B2).
//
// For every incoming { externalId, subject, body }:
//   - new externalId          -> insert, classify            (importedCount)
//   - existing, no override   -> update text, re-classify   (updatedCount)
//   - existing, human override-> update text only, the agent's
//                                category is never touched   (skippedOverrideCount)
// importedCount + updatedCount + skippedOverrideCount === total
const pool = require('../db/pool');
const v = require('../utils/validate');
const { badRequest } = require('../utils/errors');
const { classifyTicket } = require('./classifier');

function validateFeed(body) {
  const tickets = body && body.tickets;
  if (!Array.isArray(tickets) || tickets.length === 0) {
    throw badRequest('tickets must be a non-empty array');
  }
  if (tickets.length > 1000) throw badRequest('You can import at most 1000 tickets at once');

  // Validate everything first, so a bad item in the middle doesn't leave a half-done import
  return tickets.map((t, i) => {
    const item = t || {};
    try {
      return {
        externalId: v.text(item.externalId, 'externalId', 1, 100),
        subject: v.text(item.subject, 'subject', 3, 150),
        body: v.text(item.body, 'body', 5, 2000),
      };
    } catch (err) {
      err.message = `tickets[${i}]: ${err.message}`;
      throw err;
    }
  });
}

async function importTickets(rawBody) {
  const tickets = validateFeed(rawBody);
  const result = { importedCount: 0, updatedCount: 0, skippedOverrideCount: 0, total: tickets.length };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const t of tickets) {
      const { category, priority } = classifyTicket(t.subject, t.body);

      // Try to insert. ON CONFLICT DO NOTHING means: if this externalId already
      // exists, insert nothing and return no row. This is safe even when two
      // imports run at the same time, because the UNIQUE index decides.
      const inserted = await client.query(
        `INSERT INTO tickets (external_id, subject, body, auto_category, category, priority)
         VALUES ($1, $2, $3, $4, $4, $5)
         ON CONFLICT (external_id) DO NOTHING
         RETURNING id`,
        [t.externalId, t.subject, t.body, category, priority]
      );
      if (inserted.rowCount === 1) {
        result.importedCount++;
        continue;
      }

      // Ticket already exists - lock its row so an agent PATCH can't interleave
      const { rows } = await client.query(
        'SELECT * FROM tickets WHERE external_id = $1 FOR UPDATE',
        [t.externalId]
      );
      const existing = rows[0];

      if (existing.is_human_override) {
        // T-B2: an agent chose the category, the classifier must not overwrite it.
        // Only the text is refreshed.
        await client.query(
          `UPDATE tickets SET subject = $2, body = $3, updated_at = now()
           WHERE id = $1 AND (subject <> $2 OR body <> $3)`,
          [existing.id, t.subject, t.body]
        );
        result.skippedOverrideCount++;
      } else {
        // No human override -> safe to re-run the classifier
        await client.query(
          `UPDATE tickets
              SET subject = $2, body = $3, auto_category = $4, category = $4, priority = $5, updated_at = now()
            WHERE id = $1
              AND (subject <> $2 OR body <> $3 OR category <> $4 OR priority <> $5)`,
          [existing.id, t.subject, t.body, category, priority]
        );
        result.updatedCount++;
      }
    }

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { importTickets };
