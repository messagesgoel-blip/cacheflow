-- Migration: 007_users_email_lower_unique
-- Purpose: enforce case-insensitive uniqueness for user emails below the app layer

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT LOWER(email) AS normalized_email
      FROM users
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'Cannot create users_email_lower_key: duplicate emails exist when compared with LOWER(email)';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key
  ON users (LOWER(email));
