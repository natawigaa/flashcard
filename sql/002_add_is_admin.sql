-- 002_add_is_admin.sql
-- Add is_admin boolean to profiles for server-side admin checks
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
