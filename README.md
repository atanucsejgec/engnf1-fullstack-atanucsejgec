# TriageSync

## 1. Overview

TriageSync is a support triage and resource booking web app.

- **Ticket triage:** support tickets are imported from a feed and automatically given a category and priority by a deterministic keyword classifier. Re-importing the same feed never creates duplicates and never overwrites a category an agent has chosen.
- **Agent review:** agents filter and search the queue, change category / priority / status / assignee with instant (optimistic) UI updates, and every change is written to an audit trail (`ticket_events`).
- **Resource booking:** agents book rooms, labs and equipment in 30-minute slots. Admins approve or reject requests. Double booking is prevented by the database, even under concurrent requests.

## 2. Live links

| What | URL |
|---|---|
| Frontend | https://triagesync.atanu.tech (also https://engnf1-fullstack-atanucsejgec.vercel.app) |
| API | https://engnf1-fullstack-atanucsejgec.onrender.com/api (health check: [`/api/health`](https://engnf1-fullstack-atanucsejgec.onrender.com/api/health)) |
| Repository | https://github.com/atanucsejgec/engnf1-fullstack-atanucsejgec |

The API runs on Render's free plan, which sleeps after 15 minutes without traffic. The first request after that can take up to a minute while it wakes up; after that it responds normally.

### Screenshots

Taken from the live site (`docs/screenshots/`).

| Triage queue | Ticket panel (agent override + history) |
|---|---|
| ![Triage queue](docs/screenshots/02-triage-queue.png) | ![Ticket panel](docs/screenshots/03-ticket-panel.png) |

| Resources | Slot grid and booking form |
|---|---|
| ![Resources](docs/screenshots/04-resources.png) | ![Slot grid](docs/screenshots/05-booking-slot-grid.png) |

| My bookings | Admin analytics |
|---|---|
| ![My bookings](docs/screenshots/06-my-bookings.png) | ![Admin analytics](docs/screenshots/07-admin-analytics.png) |

| Admin booking requests | Admin resources |
|---|---|
| ![Admin bookings](docs/screenshots/08-admin-bookings.png) | ![Admin resources](docs/screenshots/09-admin-resources.png) |

| Login | Phone (390 px) |
|---|---|
| ![Login](docs/screenshots/01-login.png) | <img src="docs/screenshots/10-mobile-queue.png" alt="Triage queue on a phone" width="260"> |

## 3. Seeded credentials

| Role | Email | Password |
|---|---|---|
| ADMIN | admin@triagesync.test | Admin@123 |
| USER | user@triagesync.test | User@123 |

The login page also has "Demo accounts" buttons that fill these in.

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + Vite, Tailwind CSS 4, React Router | Fast dev server, utility CSS keeps styles next to markup |
| Backend | Node.js + Express 5 | Small and explicit; Express 5 forwards async errors to one error handler |
| Database | PostgreSQL (Neon in production, Docker locally) with plain SQL via `pg` | Exclusion constraints give atomic overlap protection; no ORM so every query is visible |
| Auth | bcryptjs (cost 10) + JSON Web Tokens (12 h expiry) | Own auth logic, no auth-as-a-service |
| Hosting | Vercel (frontend), Render (API), Neon (database) | Free HTTPS hosting |

## 5. Folder structure

```
.
├── backend/
│   ├── scripts/
│   │   ├── race-test.js          # 10 parallel bookings for the same slot (rule B6)
│   │   ├── generate-tickets.js   # bulk test tickets for latency measurement
│   │   └── measure-latency.js    # median / p95 of GET /api/tickets?limit=100
│   └── src/
│       ├── server.js             # starts the HTTP server
│       ├── app.js                # express setup, routes, central error handler
│       ├── db/                   # pool, schema.sql, migrate.js, seed.js, seedData.js
│       ├── middleware/auth.js    # requireAuth (JWT) and requireAdmin
│       ├── routes/               # auth, tickets, stats, resources, bookings, admin
│       ├── services/             # business rules: classifier, ticketImport, ticketUpdate, bookings
│       └── utils/                # errors, validation, row -> JSON mappers
├── frontend/
│   └── src/
│       ├── api/client.js         # fetch wrapper (token, error shape)
│       ├── context/              # AuthContext, ToastContext
│       ├── hooks/useApi.js       # loading / error / data state for API calls
│       ├── components/           # layout, UI kit, ticket components, slot grid, booking list
│       ├── data/ticketFeed.js    # the feed sent by the "Re-import feed" button
│       └── pages/                # queue, resources, bookings, admin pages
├── docs/screenshots/            # screenshots of the live app used in this README
├── render.yaml                   # Render blueprint for the API
├── README.md  SOLUTION.md  AI_USAGE.md
```

Layering in the backend: **routes** read the request and send the response, **services** hold the business rules and transactions, **db** owns the schema.

## 6. Local setup and idempotent seed

Requirements: Node 20+, Docker (or any PostgreSQL 14+).

```bash
# 1. Database
docker run -d --name triagesync-db -e POSTGRES_USER=triage -e POSTGRES_PASSWORD=triage \
  -e POSTGRES_DB=triagesync -p 5544:5432 postgres:16-alpine

# 2. Backend
cd backend
cp .env.example .env          # set DATABASE_URL=postgres://triage:triage@localhost:5544/triagesync
npm install
npm run migrate               # creates tables, constraints and indexes (safe to re-run)
npm run seed                  # demo users, resources, tickets, bookings (safe to re-run)
npm run dev                   # API on http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev                   # app on http://localhost:5173
```

**The seed is idempotent.** Every insert uses `ON CONFLICT ... DO NOTHING` on a unique key (user email, resource name, ticket `externalId`), and demo bookings are only added when the demo user has none. Running `npm run seed` twice prints `0 new tickets, 0 new bookings` the second time.

Useful scripts (backend folder, API running):

```bash
npm run race-test                          # expects exactly one 201 and nine 409
node scripts/generate-tickets.js 2000      # add 2000 PERF-xxxxx tickets
node scripts/measure-latency.js            # latency of GET /api/tickets?limit=100
```

## 7. Database schema

```
users          id, name, email (unique lower()), password_hash, role USER|ADMIN, created_at
tickets        id, external_id UNIQUE, subject, body, auto_category, category,
               is_human_override, priority, status, assignee_id -> users, is_reviewed,
               created_at, updated_at
ticket_events  id, ticket_id -> tickets, field, old_value, new_value, actor, created_at
resources      id, name (unique lower()), type ROOM|LAB|EQUIPMENT, capacity 1-500,
               description, is_active, created_at
bookings       id, resource_id -> resources, user_id -> users, ticket_id -> tickets (nullable),
               start_time, end_time, purpose, status PENDING|APPROVED|REJECTED|CANCELLED,
               decision_note, created_at
```

Constraints worth noting:

- CHECK constraints on every enum column, capacity range, and `end_time > start_time`.
- `bookings_no_overlap`: `EXCLUDE USING gist (resource_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&) WHERE (status IN ('PENDING','APPROVED'))`, so the database itself rejects overlapping active bookings.
- Indexes for the ticket list: `(created_at DESC, id DESC)`, `(status, priority, created_at DESC)`, `(category, created_at DESC)` and trigram GIN indexes on `subject` and `body`.

Columns are snake_case in the database. The API returns the exact camelCase names from the spec (`utils/mappers.js`).

## 8. API summary

Base path `/api`. Errors are always `{ "error": { "code", "message" } }`. Lists return `{ data, page, pageSize, total, totalPages }`.

| # | Method & path | Access | Notes |
|---|---|---|---|
| 1 | POST /auth/register | Public | Always creates a USER |
| 2 | POST /auth/login | Public | Returns `{ token, user }` |
| 3 | GET /auth/me | Logged in | |
| 4 | POST /tickets/import | Logged in | Idempotent, keeps human overrides |
| 5 | GET /tickets | Logged in | `status, category, priority, q, page, limit` combined with AND |
| 6 | GET /tickets/:id | Logged in | `{ ticket, events }` |
| 7 | PATCH /tickets/:id | Logged in | `category, priority, status, assigneeId` + `X-Agent` header |
| 8 | GET /stats | Logged in | Counts + `modelAgreementRate` |
| 9 | GET /resources | Logged in | `search, type, minCapacity, page`; USER sees active only |
| 10 | GET /resources/:id | Logged in | 404 for inactive when USER |
| 11 | POST /resources | ADMIN | 409 on duplicate name |
| 12 | PATCH /resources/:id | ADMIN | Includes `isActive` toggle |
| 13 | GET /resources/:id/availability | Logged in | `from, to` (max 7 days), only start/end/status |
| 14 | POST /bookings | Logged in | Race-safe, 409 on overlap / limit / inactive |
| 15 | GET /bookings/mine | Logged in | `status, page` |
| 16 | GET /bookings/:id | Owner / ADMIN | |
| 17 | GET /bookings | ADMIN | `status, resourceId, from, to, page` |
| 18 | PATCH /bookings/:id/cancel | Owner | |
| 19 | PATCH /bookings/:id/approve | ADMIN | |
| 20 | PATCH /bookings/:id/reject | ADMIN | `note` required (5-200 chars) |
| 21 | GET /admin/stats | ADMIN | `activeResources, bookingsByStatus, topResources, ticketStats` |

Order of checks follows the spec: 401 → 403 (role) → 404 (path id) → 403 (ownership) → 400 (validation) → 404 (referenced id) → 409.

## 9. Completed features checklist

- [x] Register / login / me with bcrypt and 12 h JWT; registration is USER only
- [x] Deterministic auto-triage on import (T-B1)
- [x] Idempotent re-import that keeps human overrides (T-B2)
- [x] Agent PATCH with human override flag, `isReviewed` and `ticket_events` audit trail (T-B3)
- [x] Combined, injection-safe filtering and search (T-B4)
- [x] XSS-safe rendering of HTML in tickets (T-B5), seeded with a `<script>` ticket
- [x] Stats with model agreement rate
- [x] Resource CRUD, active toggle, search / type / capacity filters, pagination
- [x] Booking rules B1-B12, including the 3-booking limit and status transitions
- [x] Atomic overlap protection: 10 simultaneous requests give one 201 and nine 409 (`npm run race-test`)
- [x] Availability endpoint that reveals only start, end and status
- [x] Admin stats with all 4 booking status keys and top 3 resources
- [x] Frontend: triage queue with stats strip, live filters, re-import button, ticket panel with optimistic updates and rollback message
- [x] Frontend: resources list, slot grid + booking form, my bookings with cancel confirmation, admin resources, admin bookings, admin analytics
- [x] Loading, error and empty states on every page; responsive at 375 / 768 / 1280 px
- [x] Times shown in the browser's timezone, sent to the API as UTC
- [x] Idempotent seed script

## 10. Known limitations

- The assignee control only offers "Assign to me" / "Unassign", because the spec has no endpoint that lists users.
- The JWT is kept in `localStorage`. An httpOnly cookie would be safer against token theft by XSS (React escaping is the protection used here).
- The slot grid does not update live; another user's booking appears after a refresh or after you submit.
- The auto-classifier uses plain substring matching, so e.g. "charger" contains "charge" and is classed as BILLING.
- If the user's timezone is not a whole or half hour offset from UTC (e.g. Nepal, UTC+5:45), the local slot labels do not line up with the UTC 30-minute grid.
- No automated test suite. Behaviour was checked with curl scripts and the race-test script.
