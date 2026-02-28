-- Remove plainPassword column from users table (security fix)
-- This column stored passwords in plaintext alongside the bcrypt hash.
ALTER TABLE "users" DROP COLUMN IF EXISTS "plainPassword";
