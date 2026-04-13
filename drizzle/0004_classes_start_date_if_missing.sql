-- Idempotent: fixes DBs where `start_date` was never added (e.g. 0003 not applied to this branch).
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "start_date" timestamp;
