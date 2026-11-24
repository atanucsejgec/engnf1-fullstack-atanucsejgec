// The database uses snake_case column names, the API must return the
// exact camelCase names from the spec. These small functions convert one
// database row into the JSON object we send to the client.

const iso = (d) => (d ? new Date(d).toISOString() : null);

// passwordHash is intentionally NOT included - it must never leave the server
const toUser = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  createdAt: iso(r.created_at),
});

const toTicket = (r) => ({
  id: r.id,
  externalId: r.external_id,
  subject: r.subject,
  body: r.body,
  autoCategory: r.auto_category,
  category: r.category,
  isHumanOverride: r.is_human_override,
  priority: r.priority,
  status: r.status,
  assigneeId: r.assignee_id,
  isReviewed: r.is_reviewed,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

const toTicketEvent = (r) => ({
  id: r.id,
  ticketId: r.ticket_id,
  field: r.field,
  oldValue: r.old_value,
  newValue: r.new_value,
  actor: r.actor,
  createdAt: iso(r.created_at),
});

const toResource = (r) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  capacity: r.capacity,
  description: r.description,
  isActive: r.is_active,
  createdAt: iso(r.created_at),
});

const toBooking = (r) => ({
  id: r.id,
  resourceId: r.resource_id,
  userId: r.user_id,
  ticketId: r.ticket_id,
  startTime: iso(r.start_time),
  endTime: iso(r.end_time),
  purpose: r.purpose,
  status: r.status,
  decisionNote: r.decision_note,
  createdAt: iso(r.created_at),
  // Extra fields only present when the query joined them in
  ...(r.resource_name !== undefined && { resourceName: r.resource_name }),
  ...(r.user_name !== undefined && { userName: r.user_name }),
});

module.exports = { toUser, toTicket, toTicketEvent, toResource, toBooking };
