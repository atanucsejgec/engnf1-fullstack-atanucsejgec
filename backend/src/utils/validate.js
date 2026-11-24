// Small validation helpers. Each one returns the cleaned value or throws
// a 400 VALIDATION_ERROR with a message the frontend can show directly.
const { badRequest } = require('./errors');

const ENUMS = {
  category: ['BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY'],
  priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  ticketStatus: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  resourceType: ['ROOM', 'LAB', 'EQUIPMENT'],
  bookingStatus: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
};

// A trimmed string with a min/max length
function text(value, field, min, max) {
  if (typeof value !== 'string') throw badRequest(`${field} is required`);
  const v = value.trim();
  if (v.length < min || v.length > max) {
    throw badRequest(`${field} must be ${min} to ${max} characters`);
  }
  return v;
}

function oneOf(value, field, allowed) {
  if (!allowed.includes(value)) {
    throw badRequest(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

function integer(value, field, min, max) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw badRequest(`${field} must be a whole number from ${min} to ${max}`);
  }
  return n;
}

function email(value) {
  if (typeof value !== 'string') throw badRequest('email is required');
  const v = value.trim().toLowerCase();
  if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    throw badRequest('email must be a valid email address');
  }
  return v;
}

function password(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 64) {
    throw badRequest('password must be 8 to 64 characters');
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    throw badRequest('password must contain at least one letter and one digit');
  }
  return value;
}

// Reads ?page=&limit= query values. Invalid values give a 400.
function pagination(query, defaultLimit = 10, maxLimit = 100) {
  const page = query.page === undefined ? 1 : integer(query.page, 'page', 1, 100000);
  const limit = query.limit === undefined ? defaultLimit : integer(query.limit, 'limit', 1, maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

// Builds the standard paginated response shape from the spec
function paginated(data, page, pageSize, total) {
  return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

// Path ids like /tickets/:id must be positive integers, otherwise 404
function isValidId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0 && Number(value) < 2147483647;
}

module.exports = { ENUMS, text, oneOf, integer, email, password, pagination, paginated, isValidId };
