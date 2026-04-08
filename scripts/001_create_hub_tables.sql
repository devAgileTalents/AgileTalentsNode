-- ============================================================
-- Hub tables migration
-- ============================================================

BEGIN;

-- 1) Hub users (extends auth hub_users concept into a full profile table)
CREATE TABLE IF NOT EXISTS hub_users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  photo         VARCHAR(512),
  title         VARCHAR(255) NOT NULL DEFAULT '',
  company       VARCHAR(255),
  hourly_rate   NUMERIC(10,2),
  role          VARCHAR(50) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  invoice_email VARCHAR(255),
  status        VARCHAR(50) NOT NULL DEFAULT 'Active',
  last_seen     TIMESTAMPTZ,

  -- address
  street_address VARCHAR(255),
  city           VARCHAR(255),
  postal_code    VARCHAR(50),
  region         VARCHAR(255),
  country        VARCHAR(255),

  -- banking
  account_holder_name VARCHAR(255),
  bank_name           VARCHAR(255),
  bank_country        VARCHAR(255),
  bank_address        VARCHAR(512),
  iban                VARCHAR(100),
  swift               VARCHAR(50),
  account_number      VARCHAR(100),
  routing_number      VARCHAR(100),
  currency            VARCHAR(10) DEFAULT 'EUR',
  payment_method      VARCHAR(50),

  -- legal
  legal_name          VARCHAR(255),
  legal_address       VARCHAR(512),
  registration_number VARCHAR(100),
  vat_id              VARCHAR(100),
  tax_id              VARCHAR(100),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Projects
CREATE TABLE IF NOT EXISTS hub_projects (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(512) NOT NULL,
  client_id       INT NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL DEFAULT '',
  start_date      DATE NOT NULL,
  end_date        DATE,
  weekly_target   INT NOT NULL DEFAULT 40,
  contracted_type VARCHAR(50) NOT NULL DEFAULT 'Full-time',
  contracted_hours INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Project access (many-to-many: which users have access to which project)
CREATE TABLE IF NOT EXISTS hub_project_access (
  project_id INT NOT NULL REFERENCES hub_projects(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

-- 4) Logged hours
CREATE TABLE IF NOT EXISTS hub_logged_hours (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
  project_id INT NOT NULL REFERENCES hub_projects(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  hours      NUMERIC(5,2) NOT NULL,
  task       VARCHAR(512) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5) Additional costs
CREATE TABLE IF NOT EXISTS hub_additional_costs (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
  project_id  INT NOT NULL REFERENCES hub_projects(id) ON DELETE CASCADE,
  month       VARCHAR(7) NOT NULL,  -- "2026-03"
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  description VARCHAR(512) NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6) Invoices
CREATE TABLE IF NOT EXISTS hub_invoices (
  id              SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
  project_id      INT NOT NULL REFERENCES hub_projects(id) ON DELETE CASCADE,
  month           VARCHAR(7) NOT NULL,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hours           NUMERIC(10,2) NOT NULL DEFAULT 0,
  hourly_rate     NUMERIC(10,2) NOT NULL DEFAULT 0,
  additional_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7) Project rates per user (optional override of user hourly_rate per project)
CREATE TABLE IF NOT EXISTS hub_project_rates (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
  project_id INT NOT NULL REFERENCES hub_projects(id) ON DELETE CASCADE,
  hourly_rate NUMERIC(10,2) NOT NULL,
  UNIQUE (user_id, project_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hub_logged_hours_user    ON hub_logged_hours(user_id);
CREATE INDEX IF NOT EXISTS idx_hub_logged_hours_project ON hub_logged_hours(project_id);
CREATE INDEX IF NOT EXISTS idx_hub_invoices_user        ON hub_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_hub_invoices_project     ON hub_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_hub_additional_costs_user ON hub_additional_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_hub_project_access_user  ON hub_project_access(user_id);

COMMIT;
