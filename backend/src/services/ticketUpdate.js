// Agent review of a ticket (rule T-B3).
//
// For each field that really changes we write one ticket_events row.
// Extra rules:
//   - category changed                  -> isHumanOverride = true
//   - category changed, OR status moved
//     away from OPEN                    -> isReviewed = true
//     (this is our definition of "reviewed", see SOLUTION.md)
const pool = require('../db/pool');
const v = require('../utils/validate');
const { badRequest, notFound } = require('../utils/errors');

const EDITABLE_FIELDS = ['category', 'priority', 'status', 'assigneeId'];
// API field name -> database column
const COLUMNS = { category: 'category', priority: 'priority', status: 'status', assigneeId: 'assignee_id' };

function validateChanges(body) {
  const input = body || {};
  const keys = Object.keys(input).filter((k) => EDITABLE_FIELDS.includes(k));
  if (keys.length === 0) {
    throw badRequest(`Send at least one of: ${EDITABLE_FIELDS.join(', ')}`);
  }

  const changes = {};
  if ('category' in input) changes.category = v.oneOf(input.category, 'category', v.ENUMS.category);
  if ('priority' in input) changes.priority = v.oneOf(input.priority, 'priority', v.ENUMS.priority);
  if ('status' in input) changes.status = v.oneOf(input.status, 'status', v.ENUMS.ticketStatus);
  if ('assigneeId' in input) {
    changes.assigneeId = input.assigneeId === null ? null : v.integer(input.assigneeId, 'assigneeId', 1, 2147483646);
  }
  return changes;
}

async function updateTicket(id, body, actor) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the row: two agents saving at the same moment are handled one
    // after the other, so the audit log always has correct old values.
    const found = await client.query('SELECT * FROM tickets WHERE id = $1 FOR UPDATE', [id]);
    const ticket = found.rows[0];
    if (!ticket) throw notFound('Ticket not found');

    // Validation comes after the path-id 404 (order of checks in the spec)
    const changes = validateChanges(body);

    // Referenced id check comes after validation
    if (changes.assigneeId != null) {
      const user = await client.query('SELECT 1 FROM users WHERE id = $1', [changes.assigneeId]);
      if (!user.rows[0]) throw notFound('Assignee user not found');
    }

    // Keep only the fields whose value is actually different
    const changedFields = Object.keys(changes).filter((field) => ticket[COLUMNS[field]] !== changes[field]);

    if (changedFields.length > 0) {
      const setParts = [];
      const params = [id];
      for (const field of changedFields) {
        params.push(changes[field]);
        setParts.push(`${COLUMNS[field]} = $${params.length}`);
      }

      const categoryChanged = changedFields.includes('category');
      const leftOpen = changedFields.includes('status') && ticket.status === 'OPEN';

      if (categoryChanged) setParts.push('is_human_override = true');
      if (categoryChanged || leftOpen) setParts.push('is_reviewed = true');
      setParts.push('updated_at = now()');

      // Column names come from our own COLUMNS map, never from the client
      await client.query(`UPDATE tickets SET ${setParts.join(', ')} WHERE id = $1`, params);

      // One audit row per changed field
      for (const field of changedFields) {
        const oldValue = ticket[COLUMNS[field]];
        const newValue = changes[field];
        await client.query(
          `INSERT INTO ticket_events (ticket_id, field, old_value, new_value, actor)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, field, oldValue == null ? null : String(oldValue), newValue == null ? null : String(newValue), actor]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { updateTicket };
