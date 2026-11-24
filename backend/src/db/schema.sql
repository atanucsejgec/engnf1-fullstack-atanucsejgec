-- TriageSync database schema.
-- Every statement uses IF NOT EXISTS so running the migration twice is safe.

-- btree_gist lets us mix "=" (resource_id) and "&&" (time range overlap)
-- in one exclusion constraint on the bookings table (see bottom).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(50)  NOT NULL,
  email         VARCHAR(254) NOT NULL,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(10)  NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- Case-insensitive unique email: "A@x.com" and "a@x.com" are the same user
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS tickets (
  id                SERIAL PRIMARY KEY,
  external_id       VARCHAR(100) NOT NULL UNIQUE,   -- used to make imports idempotent
  subject           VARCHAR(150) NOT NULL,
  body              TEXT         NOT NULL,
  auto_category     VARCHAR(20)  NOT NULL,          -- what the classifier said (never changed by agents)
  category          VARCHAR(20)  NOT NULL,          -- current category (agent may change it)
  is_human_override BOOLEAN      NOT NULL DEFAULT false,
  priority          VARCHAR(10)  NOT NULL,
  status            VARCHAR(15)  NOT NULL DEFAULT 'OPEN',
  assignee_id       INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  is_reviewed       BOOLEAN      NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (auto_category IN ('BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY')),
  CHECK (category      IN ('BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY')),
  CHECK (priority      IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  CHECK (status        IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'))
);

-- Audit trail: one row per changed field, rows are only ever inserted
CREATE TABLE IF NOT EXISTS ticket_events (
  id         SERIAL PRIMARY KEY,
  ticket_id  INTEGER     NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  field      VARCHAR(20) NOT NULL CHECK (field IN ('category', 'priority', 'status', 'assigneeId')),
  old_value  TEXT,
  new_value  TEXT,
  actor      VARCHAR(254) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_events_ticket_idx ON ticket_events (ticket_id, created_at);

CREATE TABLE IF NOT EXISTS resources (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(60)  NOT NULL,
  type        VARCHAR(10)  NOT NULL CHECK (type IN ('ROOM', 'LAB', 'EQUIPMENT')),
  capacity    INTEGER      NOT NULL CHECK (capacity BETWEEN 1 AND 500),
  description VARCHAR(300),
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS resources_name_lower_idx ON resources (lower(name));

CREATE TABLE IF NOT EXISTS bookings (
  id            SERIAL PRIMARY KEY,
  resource_id   INTEGER      NOT NULL REFERENCES resources(id),
  user_id       INTEGER      NOT NULL REFERENCES users(id),
  ticket_id     INTEGER      REFERENCES tickets(id) ON DELETE SET NULL,
  start_time    TIMESTAMPTZ  NOT NULL,
  end_time      TIMESTAMPTZ  NOT NULL,
  purpose       VARCHAR(200) NOT NULL,
  status        VARCHAR(10)  NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  decision_note VARCHAR(200),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id, start_time);

-- THE race-condition guard (rule B6).
-- Postgres itself refuses to store two PENDING/APPROVED bookings of the
-- same resource whose time ranges overlap. '[)' means start is included and
-- end is excluded, so 10:00-10:30 and 10:30-11:00 do NOT overlap.
-- Because the database checks this inside the insert, 10 simultaneous
-- requests cannot all pass: exactly one insert wins, the rest get error 23P01.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
      EXCLUDE USING gist (
        resource_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
      ) WHERE (status IN ('PENDING', 'APPROVED'));
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Performance indexes for GET /api/tickets (see SOLUTION.md part C).
-- Added AFTER measuring: without them every list request did a full
-- sequential scan + sort of the tickets table.
-- ---------------------------------------------------------------------
-- pg_trgm splits text into 3-letter pieces so ILIKE '%crash%' can use an index
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Default sort of the queue (newest first): rows come out already ordered
CREATE INDEX IF NOT EXISTS tickets_created_idx ON tickets (created_at DESC, id DESC);
-- Filter combinations used by the filter bar
CREATE INDEX IF NOT EXISTS tickets_status_priority_idx ON tickets (status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS tickets_category_idx ON tickets (category, created_at DESC);
-- Free-text search on subject and body
CREATE INDEX IF NOT EXISTS tickets_subject_trgm_idx ON tickets USING gin (subject gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tickets_body_trgm_idx ON tickets USING gin (body gin_trgm_ops);
