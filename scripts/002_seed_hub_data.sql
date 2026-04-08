-- ============================================================
-- Seed Hub tables with initial data from constants/data.ts
-- ============================================================

BEGIN;

-- ── Users ────────────────────────────────────────────────
INSERT INTO hub_users (id, name, photo, title, company, hourly_rate, role, email, status, last_seen,
  street_address, city, postal_code, region, country,
  account_holder_name, bank_name, bank_country, iban, swift, currency, payment_method,
  legal_name, legal_address, tax_id)
VALUES
  (1,  'Alice Johnson',             '/uploads/freelancers/freelancer1.jpg', 'Product Manager',       NULL,              12, 'Owner',           'alice.johnson@example.com',          'Active',    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (2,  'Charlie Davis',             '/uploads/freelancers/freelancer2.jpg', 'Front-End Developer',   NULL,              25, 'Admin',           'charlie.davis@example.com',          'Invited',   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (3,  'Bob Smith',                 '/uploads/freelancers/freelancer3.jpg', 'UI/UX Designer',        NULL,               3, 'Freelancer',      'bob.smith@example.com',              'Last been', NOW() - INTERVAL '2 hours',
       'Musterstraße 156', 'Berlin', '10783', 'Berlin', 'Germany',
       'Bob Smith', 'Deutsche Bank', 'Germany', 'DE8937999940888813000', 'DEUTDEDB', 'EUR', 'SEPA',
       'Robert Smith', 'Musterstraße 156, 10783 Berlin', 'DE123456789'),
  (4,  'Diana Prince',              '/uploads/freelancers/freelancer4.jpg', 'СЕО',                   'TechCorp GmbH',   35, 'Client',          'diana.prince@example.com',           'Disabled',  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (5,  'Ethan Hunt',                '/uploads/freelancers/freelancer5.jpg', 'Data Analyst',          NULL,              12, 'Recruiter',       'ethan.hunt@example.com',             'Archived',  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (6,  'Maximiliano Futherstone',   '/uploads/freelancers/freelancer6.jpg', 'Marketing Specialist',  NULL,              12, 'Marketing',       'maximiliano.futherstone@example.com','Active',    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (7,  'George Lucas',              NULL,                                   'Content Strategist',    NULL,              12, 'Sourcer',         'george.lucas@example.com',           'Active',    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (8,  'Hannah Baker',              NULL,                                   'Sales Executive',       NULL,              12, 'Sales Assistant', 'hannah.baker@example.com',           'Active',    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (9,  'Isaac Newton',              NULL,                                   'Quality Assurance',     NULL,              12, 'Freelancer',      'isaac.newton@example.com',           'Active',    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (10, 'Julia Roberts',             NULL,                                   'Human Resources',       NULL,              12, 'Sales',           'julia.roberts@example.com',          'Last been', NOW() - INTERVAL '24 hours', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (11, 'Karl Marx',                 NULL,                                   'Business Analyst',      NULL,              12, 'Finance',         'karl.marx@example.com',              'Last been', NOW() - INTERVAL '30 minutes', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

SELECT setval('hub_users_id_seq', (SELECT MAX(id) FROM hub_users));

-- ── Projects ─────────────────────────────────────────────
INSERT INTO hub_projects (id, name, client_id, title, start_date, end_date, weekly_target, contracted_type, contracted_hours)
VALUES
  (1, 'Project or table name',                                                                               4, 'Product Manager',       '2026-03-10', '2026-03-23', 40, 'Part-time',  NULL),
  (2, 'Project or table name can be huge, let me show you an example of it. Here, you see it?',              4, 'UI/UX Designer',        '2026-03-12', NULL,         40, 'Full-time',  8),
  (3, 'Project or table name',                                                                               4, 'Front-End Developer',   '2026-01-22', '2026-01-30', 33, 'Part-time',  NULL),
  (4, 'Project or table name',                                                                               4, 'Back-End Developer',    '2026-01-01', '2026-01-30', 40, 'Part-time',  NULL),
  (5, 'Project or table name',                                                                               4, 'Data Analyst',          '2026-03-15', '2026-03-31', 40, 'Full-time',  NULL),
  (6, 'Project or table name',                                                                               4, 'Marketing Specialist',  '2026-03-22', NULL,         38, 'Part-time',  NULL),
  (7, 'Project or table name',                                                                               4, 'Content Strategist',    '2026-04-18', '2026-04-30', 12, 'Full-time',  NULL),
  (8, 'Project or table name',                                                                               4, 'Sales Executive',       '2026-04-15', NULL,         26, 'Part-time',  NULL);

SELECT setval('hub_projects_id_seq', (SELECT MAX(id) FROM hub_projects));

-- ── Project access ───────────────────────────────────────
INSERT INTO hub_project_access (project_id, user_id) VALUES
  (1,1),(1,2),(1,3),
  (2,1),(2,2),(2,3),(2,4),(2,5),
  (3,1),(3,2),(3,3),
  (4,1),(4,4),
  (5,1),(5,2),
  (6,1),(6,6),
  (7,1),(7,7),
  (8,1),(8,8);

-- ── Logged hours (Charlie Davis, user 2) ─────────────────
INSERT INTO hub_logged_hours (user_id, project_id, date, hours, task) VALUES
  (2, 3, '2026-03-03', 6, 'Build project table layout'),
  (2, 3, '2026-03-05', 7, 'Implement table row states'),
  (2, 2, '2026-03-20', 8, 'Refactor page structure');

-- ── Logged hours (Bob Smith, user 3) ─────────────────────
INSERT INTO hub_logged_hours (user_id, project_id, date, hours, task) VALUES
  (3, 2, '2026-03-02', 7, 'Create dashboard page'),
  (3, 2, '2026-03-03', 8, 'Refine dashboard UI'),
  (3, 1, '2026-03-04', 8, 'Update content blocks'),
  (3, 1, '2026-03-06', 7, 'Prepare invoice layout'),
  (3, 2, '2026-03-07', 8, 'Polish time tracking page'),
  (3, 2, '2026-03-08', 4, 'Fix spacing and responsive states'),
  (3, 1, '2026-03-12', 6, 'Create summary card'),
  (3, 2, '2026-03-14', 6, 'Connect project filter UI'),
  (3, 1, '2026-03-15', 8, 'Review invoice generation section'),
  (3, 1, '2025-02-15', 8, 'Review invoice generation section');

-- ── Invoices (Bob Smith, user 3) ─────────────────────────
INSERT INTO hub_invoices (user_id, project_id, month, generated_at, hours, hourly_rate, additional_cost, total) VALUES
  (3, 1, '2026-03', '2026-03-20T10:30:00.000Z', 35, 3, 0,  105),
  (3, 2, '2026-03', '2026-03-20T10:35:00.000Z', 27, 3, 50, 131),
  (3, 1, '2025-02', '2025-02-28T17:00:00.000Z',  8, 3, 0,   24);

COMMIT;
