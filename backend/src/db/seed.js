// Idempotent seed: running it many times never creates duplicates.
// Every insert uses ON CONFLICT DO NOTHING on a unique key
// (email, resource name, ticket externalId).
// Usage: npm run seed   (run "npm run migrate" first)
const bcrypt = require('bcryptjs');
const pool = require('./pool');
const data = require('./seedData');
const { classifyTicket } = require('../services/classifier');

async function seedUsers(client) {
  for (const u of data.users) {
    const hash = await bcrypt.hash(u.password, 10);
    await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT ((lower(email))) DO NOTHING`,
      [u.name, u.email, hash, u.role]
    );
  }
  const { rows } = await client.query('SELECT id, email FROM users WHERE email = ANY($1)', [data.users.map((u) => u.email)]);
  return Object.fromEntries(rows.map((r) => [r.email, r.id]));
}

async function seedResources(client) {
  for (const r of data.resources) {
    await client.query(
      `INSERT INTO resources (name, type, capacity, description, is_active) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ((lower(name))) DO NOTHING`,
      [r.name, r.type, r.capacity, r.description, r.isActive ?? true]
    );
  }
}

async function seedTickets(client, agentId) {
  const agentEmail = 'user@triagesync.test';
  let created = 0;

  for (const t of data.tickets) {
    const auto = classifyTicket(t.subject, t.body);
    const priority = t.priority || auto.priority;

    const inserted = await client.query(
      `INSERT INTO tickets (external_id, subject, body, auto_category, category, priority)
       VALUES ($1, $2, $3, $4, $4, $5)
       ON CONFLICT (external_id) DO NOTHING
       RETURNING id`,
      [t.externalId, t.subject, t.body, auto.category, priority]
    );
    if (inserted.rowCount === 0 || !t.review) {
      created += inserted.rowCount;
      continue;
    }
    created++;

    // Simulate an agent review: update the ticket and write the audit events
    const id = inserted.rows[0].id;
    const newCategory = t.review.category || auto.category;
    await client.query(
      `UPDATE tickets SET category = $2, status = $3, assignee_id = $4,
              is_human_override = $5, is_reviewed = true, updated_at = now()
        WHERE id = $1`,
      [id, newCategory, t.review.status, agentId, newCategory !== auto.category]
    );

    const events = [['status', 'OPEN', t.review.status], ['assigneeId', null, String(agentId)]];
    if (newCategory !== auto.category) events.push(['category', auto.category, newCategory]);
    for (const [field, oldValue, newValue] of events) {
      await client.query(
        'INSERT INTO ticket_events (ticket_id, field, old_value, new_value, actor) VALUES ($1, $2, $3, $4, $5)',
        [id, field, oldValue, newValue, agentEmail]
      );
    }
  }
  return created;
}

// A few demo bookings so "My Bookings" and the admin views are not empty.
// Only added when the demo user has no bookings yet (keeps the seed idempotent).
async function seedBookings(client, userId) {
  const existing = await client.query('SELECT 1 FROM bookings WHERE user_id = $1 LIMIT 1', [userId]);
  if (existing.rowCount > 0) return 0;

  const { rows } = await client.query(
    "SELECT id, name FROM resources WHERE is_active = true AND name = ANY($1)",
    [['Huddle Room A', 'Network Lab', 'Oscilloscope Kit']]
  );
  const byName = Object.fromEntries(rows.map((r) => [r.name, r.id]));

  // Times on the 30-minute grid, 1-3 days from now
  const slot = (daysAhead, hour, minutes) => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + daysAhead);
    start.setUTCHours(hour, 0, 0, 0);
    return [start, new Date(start.getTime() + minutes * 60 * 1000)];
  };

  const demo = [
    { resource: 'Huddle Room A', time: slot(1, 9, 60), purpose: 'Screen share with customer about SSO login', status: 'PENDING', note: null },
    { resource: 'Network Lab', time: slot(2, 11, 90), purpose: 'Reproduce dashboard 500 error under load', status: 'APPROVED', note: null },
    { resource: 'Oscilloscope Kit', time: slot(3, 14, 30), purpose: 'Check faulty card reader from ticket', status: 'REJECTED', note: 'Kit is reserved for hardware team that day' },
  ];
  for (const b of demo) {
    await client.query(
      `INSERT INTO bookings (resource_id, user_id, start_time, end_time, purpose, status, decision_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [byName[b.resource], userId, b.time[0], b.time[1], b.purpose, b.status, b.note]
    );
  }
  return demo.length;
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userIds = await seedUsers(client);
    await seedResources(client);
    const tickets = await seedTickets(client, userIds['user@triagesync.test']);
    const bookings = await seedBookings(client, userIds['user@triagesync.test']);
    await client.query('COMMIT');
    console.log(`Seed finished: ${tickets} new tickets, ${bookings} new bookings`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
