# SOLUTION

## Part A: Architecture and trace of an imported ticket

### Architecture

```
  Browser (React, Vercel)
  ┌───────────────────────────────────────────────────────────┐
  │ pages/TriageQueue ── components/tickets/* ── hooks/useApi  │
  │                │                                          │
  │          api/client.js  (fetch + Bearer token + errors)    │
  └────────────────┼──────────────────────────────────────────┘
                   │ HTTPS, JSON, /api/*
  ┌────────────────▼──────────────────────────────────────────┐
  │ Express API (Render)                                       │
  │ app.js ── middleware/auth.js (requireAuth / requireAdmin)  │
  │   routes/*.js      read request, check role/ownership      │
  │   services/*.js    business rules + transactions           │
  │   utils/           validate, errors, mappers (snake→camel) │
  └────────────────┼──────────────────────────────────────────┘
                   │ pg Pool (SSL)
  ┌────────────────▼──────────────────────────────────────────┐
  │ PostgreSQL (Neon)                                          │
  │ users, tickets, ticket_events, resources, bookings         │
  │ UNIQUE(external_id), EXCLUDE bookings_no_overlap, indexes  │
  └───────────────────────────────────────────────────────────┘
```

### Trace: from "Re-import feed" to the dashboard

1. **Click.** `reimportFeed()` in `frontend/src/pages/TriageQueue.jsx:50` sends `ticketFeed` (`frontend/src/data/ticketFeed.js`) with `api.post('/tickets/import', ...)`.
2. **Client.** `request()` in `frontend/src/api/client.js` adds `Authorization: Bearer <token>` and JSON-encodes the body.
3. **Auth.** `requireAuth` in `backend/src/middleware/auth.js:14` verifies the JWT and loads the user into `req.user`.
4. **Route.** `POST /import` in `backend/src/routes/tickets.js:14` calls `importTickets(req.body)`.
5. **Validate.** `validateFeed()` in `backend/src/services/ticketImport.js` checks every item first (externalId 1-100, subject 3-150, body 5-2000), so a bad item gives 400 before anything is written.
6. **Transaction.** `importTickets()` (`ticketImport.js:37`) opens `BEGIN`, then for each ticket:
   - `classifyTicket(subject, body)` (`backend/src/services/classifier.js:23`) lowercases the text and returns the first matching category rule and priority rule.
   - `INSERT ... ON CONFLICT (external_id) DO NOTHING RETURNING id` (`ticketImport.js:54`). A returned row means it is new: `importedCount++`.
   - Otherwise `SELECT ... FOR UPDATE` locks the existing row (`ticketImport.js:65`). If `is_human_override` is true, only subject/body are refreshed (`skippedOverrideCount++`); if not, the classifier result is written again (`updatedCount++`).
   - `COMMIT` (or `ROLLBACK` on any error).
7. **Response.** `{ importedCount, updatedCount, skippedOverrideCount, total }` goes back; the page shows it in a toast.
8. **Dashboard refresh.** The page calls `tickets.reload()` and `stats.reload()`:
   - `GET /api/tickets` (`routes/tickets.js:21`) builds a parameterised `WHERE` from the filters and returns one page, with `COUNT(*) OVER()` for the total.
   - `GET /api/stats` (`getTicketStats()` in `routes/stats.js:16`) returns counts by category / priority / status plus `modelAgreementRate`.
9. **Render.** `StatsStrip` draws the priority load bar; `TicketList` shows each row with its priority stripe. Subject and body are rendered as React text nodes, so HTML in a ticket is displayed, never executed.

### Definition of "reviewed"

A ticket becomes `isReviewed = true` when an agent makes a decision about it through `PATCH /api/tickets/:id`:

- the agent **changes the category** (this also sets `isHumanOverride = true`), or
- the agent **moves the status away from OPEN** (OPEN → IN_PROGRESS, RESOLVED or CLOSED).

Changing only priority or assignee does not count as a review, because it does not confirm or correct the classifier's work or move the ticket forward. Once true, `isReviewed` stays true. Code: `backend/src/services/ticketUpdate.js:66-69`.

**Model agreement rate** = reviewed tickets where `category = auto_category` ÷ all reviewed tickets × 100, with one decimal (0 when none are reviewed).

## Part B: Concurrency (B6) and idempotent human override (T-B2)

### B6: exactly one booking wins

The naive approach is "SELECT overlapping bookings; if none, INSERT". With 10 parallel requests, all 10 SELECTs can run before any INSERT, so all 10 see a free slot. That is a race condition.

Instead the overlap rule is enforced by the database (`backend/src/db/schema.sql:86-91`):

```sql
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status IN ('PENDING', 'APPROVED'));
```

- `resource_id WITH =` plus `tstzrange(...) WITH &&` means "same resource and overlapping time ranges are not allowed together".
- `'[)'` includes the start and excludes the end, so 10:00-10:30 and 10:30-11:00 do not overlap (back-to-back is allowed, rule B5).
- The `WHERE` makes the constraint apply only to PENDING and APPROVED rows, so REJECTED and CANCELLED bookings free the slot.
- `btree_gist` is needed to combine `=` on an integer with `&&` on a range in one GiST index.

Postgres checks the constraint inside the INSERT while holding the index entry, so concurrent inserts are serialised by the index: one succeeds, the others fail with SQLSTATE `23P01`, which `createBooking()` maps to 409 (`backend/src/services/bookings.js:84`).

The **3-booking limit** (B8) has its own race: two requests from the same user could both count 2 bookings. `createBooking()` locks the user row with `SELECT ... FROM users WHERE id = $1 FOR UPDATE` (`bookings.js:62`) before counting, so one user's booking requests run one at a time inside their transactions.

**Status changes** are a single conditional UPDATE (`changeStatus()`, `bookings.js:94`):
`UPDATE bookings SET status = $2 WHERE id = $1 AND status = ANY($4) AND start_time > now() RETURNING *`. Zero rows updated means the transition is not allowed, so the API returns 409. There is no gap between check and write.

**Proof:** `npm run race-test` (`backend/scripts/race-test.js`) sends 10 simultaneous requests for one slot, once from a single user and once from 10 different users:

```
Same user x10     : {"201":1,"409":9} -> PASS
10 different users: {"201":1,"409":9} -> PASS
```

### T-B2: idempotent re-import that respects human overrides

- **No duplicates:** `external_id` has a UNIQUE index. `INSERT ... ON CONFLICT (external_id) DO NOTHING` lets the index decide whether a ticket is new. This is safe even if two imports run at the same time, unlike "SELECT then INSERT".
- **No lost agent decisions:** for an existing ticket the row is locked with `FOR UPDATE`, then:
  - `is_human_override = true`: only `subject` and `body` are updated. `category`, `auto_category` and `priority` are not touched.
  - `is_human_override = false`: the classifier runs again and `auto_category`, `category` and `priority` are updated.
- **Which flag controls it:** `is_human_override` is set only in `updateTicket()` when an agent changes the category (`ticketUpdate.js:68`). The import never sets it back to false.
- **autoCategory:** agents can never change `auto_category` (it is not an editable field in PATCH). The classifier only rewrites it when there is no human override, which means the ticket text is still "owned" by the classifier.
- **Counts:** every existing ticket is counted as either `updatedCount` or `skippedOverrideCount`, so `importedCount + updatedCount + skippedOverrideCount = total`.
- The import and the agent PATCH both lock the ticket row, so an import running while an agent saves cannot overwrite the agent's category.

## Part C: Measure first, then optimise

**Endpoint:** `GET /api/tickets?limit=100`, plus three filtered variants.
**Data:** 2,019 tickets (19 seed + 2,000 from `node scripts/generate-tickets.js 2000`).
**Method:** `node scripts/measure-latency.js`: 5 warm-up calls, then 40 timed calls per query; median and p95 of full HTTP round-trip time.

### Before

Each request ran two queries (`SELECT COUNT(*)` and the page `SELECT`). `EXPLAIN ANALYZE` showed a **Seq Scan + Sort** on `tickets` for every request.

### Change (commit "Add ticket indexes and single-query count to speed up ticket list")

1. Indexes (`schema.sql`, bottom): `(created_at DESC, id DESC)` matches the list order; `(status, priority, created_at DESC)` and `(category, created_at DESC)` cover the filter bar; `pg_trgm` GIN indexes on `subject` and `body` support `ILIKE '%text%'`.
2. One round trip instead of two: `COUNT(*) OVER()` returns the total with each row (`routes/tickets.js`). A separate count runs only when the requested page is past the end.

### Results, local Docker Postgres (API and DB on the same machine)

| Query | Before median / p95 | After median / p95 |
|---|---|---|
| `limit=100` | 3.1 / 4.4 ms | 2.9 / 4.1 ms |
| `limit=100&status=OPEN&priority=HIGH` | 2.8 / 3.2 ms | 2.3 / 2.6 ms |
| `limit=100&q=crash` | 7.1 / 9.0 ms | 4.5 / 4.7 ms |
| `limit=100&category=BILLING&q=refund` | 3.4 / 3.7 ms | 2.7 / 3.2 ms |

`EXPLAIN ANALYZE` after the change: the filtered query uses `Index Scan using tickets_created_idx` (execution 0.41 ms → 0.16 ms). For `q=crash` on only ~2,000 rows the planner **still prefers a Seq Scan**, because reading the whole small table is cheaper than the trigram index. The gain there comes from removing the second round trip. The trigram index starts to pay off as the table grows.

Locally a database round trip costs well under 1 ms, so the absolute gains are small. On the hosted setup each round trip between Render and Neon costs several milliseconds, which is why removing one query per request matters more in production.

### Trade-off

Five extra indexes make **writes slower and the table bigger**: every imported ticket now updates 5 more indexes (the GIN trigram indexes are the most expensive), which slows bulk imports. We accept this because the queue is read far more often than tickets are imported. Also, `COUNT(*) OVER()` must find every matching row to count it, so a request can't stop after the first 100 rows. For very large tables an estimated count or keyset pagination would be better.

## Part D: What I would improve with one more day

1. **Batch the import.** `backend/src/services/ticketImport.js:45` runs 1-2 queries per ticket inside a loop. A single `INSERT ... SELECT FROM unnest($1::text[], ...) ON CONFLICT (external_id) DO UPDATE ... WHERE NOT tickets.is_human_override` would import 1,000 tickets in one statement.
2. **Safer token storage.** `frontend/src/api/client.js:18` keeps the JWT in `localStorage`. An httpOnly, SameSite cookie would keep it out of reach of any script.
3. **Real assignee picker.** `frontend/src/components/tickets/TicketPanel.jsx:53` only supports "assign to me". A small `GET /api/users` (agents only) would allow assigning to anyone.
4. **Live availability.** `frontend/src/components/SlotGrid.jsx:17` works from a one-time snapshot. Polling or server-sent events would show other people's bookings without a refresh.
5. **Automated tests.** Jest + supertest tests for the booking rules and the import/override rules, running in CI against a Postgres service container.
