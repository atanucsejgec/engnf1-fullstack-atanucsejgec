const express = require('express');
const pool = require('../db/pool');
const v = require('../utils/validate');
const { badRequest, notFound, conflict } = require('../utils/errors');
const { toResource } = require('../utils/mappers');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const isAdmin = (req) => req.user.role === 'ADMIN';

// Loads a resource or throws 404. Regular users can't see inactive resources,
// so for them an inactive resource is the same as "not found".
async function findResource(req, id) {
  if (!v.isValidId(id)) throw notFound('Resource not found');
  const { rows } = await pool.query('SELECT * FROM resources WHERE id = $1', [id]);
  const resource = rows[0];
  if (!resource || (!resource.is_active && !isAdmin(req))) throw notFound('Resource not found');
  return resource;
}

// Validates a create (all fields required) or update (any subset) body
function validateResource(body, isUpdate) {
  const input = body || {};
  const data = {};

  if (!isUpdate || 'name' in input) data.name = v.text(input.name, 'name', 3, 60);
  if (!isUpdate || 'type' in input) data.type = v.oneOf(input.type, 'type', v.ENUMS.resourceType);
  if (!isUpdate || 'capacity' in input) data.capacity = v.integer(input.capacity, 'capacity', 1, 500);
  if ('description' in input) {
    if (input.description === null || input.description === '') data.description = null;
    else if (typeof input.description !== 'string' || input.description.trim().length > 300) {
      throw badRequest('description must be at most 300 characters');
    } else data.description = input.description.trim();
  }
  if (isUpdate && 'isActive' in input) {
    if (typeof input.isActive !== 'boolean') throw badRequest('isActive must be true or false');
    data.isActive = input.isActive;
  }

  if (isUpdate && Object.keys(data).length === 0) {
    throw badRequest('Send at least one of: name, type, capacity, description, isActive');
  }
  return data;
}

// Unique index on lower(name) -> 23505 -> 409
function handleDuplicateName(err) {
  if (err.code === '23505') throw conflict('A resource with this name already exists');
  throw err;
}

// GET /api/resources?search=&type=&minCapacity=&page=
router.get('/', async (req, res) => {
  const { page, limit, offset } = v.pagination(req.query, 10, 50);
  const conditions = [];
  const params = [];

  if (!isAdmin(req)) conditions.push('is_active = true');

  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    params.push(v.likePattern(req.query.search));
    conditions.push(`name ILIKE $${params.length} ESCAPE '\\'`);
  }
  if (req.query.type) {
    params.push(v.oneOf(req.query.type, 'type', v.ENUMS.resourceType));
    conditions.push(`type = $${params.length}`);
  }
  if (req.query.minCapacity !== undefined && req.query.minCapacity !== '') {
    params.push(v.integer(req.query.minCapacity, 'minCapacity', 1, 500));
    conditions.push(`capacity >= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM resources ${where}`, params);
  const { rows } = await pool.query(
    `SELECT * FROM resources ${where}
     ORDER BY lower(name) ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  res.json(v.paginated(rows.map(toResource), page, limit, count.rows[0].total));
});

// GET /api/resources/:id
router.get('/:id', async (req, res) => {
  res.json(toResource(await findResource(req, req.params.id)));
});

// POST /api/resources  (ADMIN)
router.post('/', requireAdmin, async (req, res) => {
  const data = validateResource(req.body, false);
  try {
    const { rows } = await pool.query(
      `INSERT INTO resources (name, type, capacity, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.name, data.type, data.capacity, data.description ?? null]
    );
    res.status(201).json(toResource(rows[0]));
  } catch (err) {
    handleDuplicateName(err);
  }
});

// PATCH /api/resources/:id  (ADMIN)
router.patch('/:id', requireAdmin, async (req, res) => {
  const resource = await findResource(req, req.params.id);
  const data = validateResource(req.body, true);

  const columns = { name: 'name', type: 'type', capacity: 'capacity', description: 'description', isActive: 'is_active' };
  const params = [resource.id];
  const setParts = Object.entries(data).map(([field, value]) => {
    params.push(value);
    return `${columns[field]} = $${params.length}`;
  });

  try {
    const { rows } = await pool.query(
      `UPDATE resources SET ${setParts.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    res.json(toResource(rows[0]));
  } catch (err) {
    handleDuplicateName(err);
  }
});

// GET /api/resources/:id/availability?from=&to=
// Only shows startTime, endTime and status - never who booked or why (privacy rule).
router.get('/:id/availability', async (req, res) => {
  const resource = await findResource(req, req.params.id);
  const from = v.isoDate(req.query.from, 'from');
  const to = v.isoDate(req.query.to, 'to');
  if (to <= from) throw badRequest('to must be after from');
  if (to - from > 7 * 24 * 60 * 60 * 1000) throw badRequest('The range can be at most 7 days');

  // Same overlap rule as bookings: start < rangeEnd AND end > rangeStart
  const { rows } = await pool.query(
    `SELECT start_time, end_time, status FROM bookings
      WHERE resource_id = $1 AND status IN ('PENDING', 'APPROVED')
        AND start_time < $3 AND end_time > $2
      ORDER BY start_time`,
    [resource.id, from, to]
  );

  res.json({
    resourceId: resource.id,
    from: from.toISOString(),
    to: to.toISOString(),
    bookings: rows.map((r) => ({
      startTime: r.start_time.toISOString(),
      endTime: r.end_time.toISOString(),
      status: r.status,
    })),
  });
});

module.exports = router;
