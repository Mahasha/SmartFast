-- ─── Open-Ended Fasting / Overtime ───────────────────────────────────────────
-- Fasting sessions are no longer auto-completed at their planned goal. They stay
-- ACTIVE and count up in overtime until the user explicitly ends them.
--
-- This migration is additive and backward compatible:
--   - Both columns are nullable with no default change.
--   - Existing rows get NULL (interpreted as "never reached goal" / legacy).
--   - "durationFasted" already stores the ACTUAL seconds fasted and is the
--     analytics source of truth, so no separate actual-duration column is added
--     (a second field would be a duplicate, drift-prone source of truth).
--
-- Idempotent so it is safe to re-run.

ALTER TABLE fasting_sessions
  ADD COLUMN IF NOT EXISTS "goalReachedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "completedAt"   TIMESTAMPTZ;
