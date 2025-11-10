-- 002_add_study_sessions_is_focused.sql
-- Add a boolean flag to study_sessions to mark focused sessions

ALTER TABLE IF EXISTS study_sessions
  ADD COLUMN IF NOT EXISTS is_focused boolean DEFAULT false;

-- Ensure existing rows have a non-null value
UPDATE study_sessions SET is_focused = false WHERE is_focused IS NULL;
