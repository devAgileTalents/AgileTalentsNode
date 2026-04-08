-- ============================================================
-- Add password_hash to hub_users and populate from env data
-- ============================================================

BEGIN;

-- Add password_hash column
ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Set password hash for all existing users
-- This is the bcrypt hash from your HUB_USERS_JSON (password: admin)
UPDATE hub_users
SET password_hash = '$2b$10$j9yxY/6xN3KLYMb/UH8fX.86K2BYgcB81hRP0hIFdMhDElSjeQE.S'
WHERE password_hash IS NULL;

COMMIT;
